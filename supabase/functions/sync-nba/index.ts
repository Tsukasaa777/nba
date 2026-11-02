import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { SportApiProvider, SportApiError, easternDate, offsetDate, nbaScheduleFetchDates,
  normalizeSportGames, normalizeSportRoster, normalizeSportBoxScore, normalizeSportTeam } from "./sportapi.ts";
const respond = (status: number, value: unknown) => new Response(JSON.stringify(value),
  { status, headers: { "content-type": "application/json", "cache-control": "no-store" }});
Deno.serve(async request => {
  if (request.method !== "POST") return respond(405, { error: "POST required" });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(token)) return respond(401, { error: "Unauthorized" });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } });
  const owner = crypto.randomUUID();
  const { data: claimed, error: claimError } = await db.rpc("claim_nba_sync", { p_token: token, p_owner: owner });
  if (claimError || !claimed) return respond(409, { error: "Unauthorized or sync already running" });
  let statsOk = false, rosterOk = false;
  let nextCursor: string | null = null;
  const counts = { games: 0, boxes: 0 };
  const finish = async (state: string, message: string) => {
    const { error } = await db.rpc("finish_nba_sync", { p_owner: owner, p_state: state,
      p_message: message, p_counts: counts, p_stats: statsOk, p_injuries: false,
      p_roster: rosterOk, p_cursor: nextCursor });
    if (error) throw new Error("Could not save sync completion");
  };
  const ingest = async (payload: Record<string, unknown>) => {
    const { error } = await db.rpc("ingest_nba_batch", { p_owner: owner, p_payload: payload });
    if (error) throw new Error("Database rejected NBA data batch");
  };
  try {
    // Resolve encrypted key through service-role-only RPC; never expose it to browsers.
    const { data: vaultKey, error: vaultError } = await db.rpc("get_sportapi_provider_key");
    const key = Deno.env.get("SPORTAPI_API_KEY") || (!vaultError && typeof vaultKey === "string" ? vaultKey : null);
    if (!key) {
      await finish("awaiting_provider", "SportAPI sync ready, but SPORTAPI_API_KEY has not been configured");
      return respond(200, { state: "awaiting_provider", ...counts });
    }
    const api = new SportApiProvider(key, 45);
    const now = new Date();
    const todayET = easternDate(now);
    const { data: health, error: healthError } = await db.from("data_health").select("*").eq("id", "nba").single();
    if (healthError) throw new Error("Could not read sync checkpoint");
    // Always refresh current/recent games, plus future schedules hourly (and
    // two days ahead every six hours). Missing future fixtures caused an
    // incomplete Philippine-Time matchup selector even though SportAPI had them.
    const recent = nbaScheduleFetchDates(now);
    const allGames = new Map<number, Record<string, any>>();
    for (const date of recent) {
      const payload = await api.get("games/date/" + date, { tz: "America/New_York", league: "nba" });
      if (!Array.isArray(payload.data)) throw new Error("SportAPI schedule response has no games array");
      for (const g of payload.data) if (g?.league?.slug === "nba") allGames.set(g.id, g);
    }
    const schedule = normalizeSportGames([...allGames.values()]);
    await ingest(schedule);
    counts.games = schedule.games.length;
    // Fetch a final box score on first discovery, then periodically refresh within 24 hours for corrections.
    const finals = [...allGames.values()].filter(g => ["FT","AOT"].includes(String(g.status).toUpperCase()) && g.has_boxscore !== false);
    const ids = finals.map(g => "sportapi:" + g.id);
    const { data: stored, error: storedError } = ids.length
      ? await db.from("box_scores").select("game_id,fetched_at").in("game_id", ids).limit(1000)
      : { data: [], error: null };
    if (storedError) throw new Error("Could not check existing box scores");
    const stamps = new Map<string, number>();
    for (const box of (stored ?? [])) stamps.set(box.game_id, Math.max(stamps.get(box.game_id) ?? 0, Date.parse(box.fetched_at)));
    for (const raw of finals) {
      const last = stamps.get("sportapi:" + raw.id) ?? 0;
      const age = now.getTime() - Date.parse(raw.start);
      // Never request already-stored historical games every 15 minutes.
      if (last && (age > 86_400_000 || now.getTime() - last < 6 * 3_600_000)) continue;
      const response = await api.get("games/" + raw.id + "/players");
      const normalized = normalizeSportBoxScore(raw, response);
      if (!normalized.boxes.length) continue;
      await ingest({ players: normalized.players, boxes: normalized.boxes });
      counts.boxes += normalized.boxes.length;
    }
    statsOk = true;
    // Refresh rosters only once per day; otherwise game-player lists have no active searchable players.
    if (!health.roster_success || Date.now() - Date.parse(health.roster_success) > 86_400_000) {
      // NBA league profile provides data.teams; roster updates are batched across
      // successive scheduler runs rather than risking the free provider's quota.
      const league = await api.get("leagues/nba");
      const teamsRaw = league.data?.teams;
      if (!Array.isArray(teamsRaw) || teamsRaw.length < 20)
        throw new Error("SportAPI NBA league team directory unavailable");
      await ingest({ teams: teamsRaw.map(normalizeSportTeam) });
      const { data: currentRosters, error: rosterQueryError } = await db.from("players")
        .select("team_id,fetched_at").eq("active",true).limit(800);
      if (rosterQueryError) throw new Error("Cannot check NBA roster freshness");
      const threshold = now.getTime() - 86_400_000;
      const freshTeamIds = new Set((currentRosters ?? [])
        .filter((p: any) => Number.isFinite(Date.parse(p.fetched_at))
          && Date.parse(p.fetched_at) >= threshold)
        .map((p: any) => p.team_id));
      const staleTeams = teamsRaw.filter((t: any) => !freshTeamIds.has("sportapi:" + t.id));
      const selected = staleTeams.slice(0, 10);
      const players = [];
      for (const t of selected) {
        const roster = await api.get("teams/" + t.id + "/roster");
        if (!Array.isArray(roster.data)) throw new Error("NBA roster response has no player list");
        players.push(...normalizeSportRoster(t.id, roster.data));
      }
      if (players.length) await ingest({ players });
      // Mark full-roster success only after every team was refreshed recently.
      rosterOk = staleTeams.length <= selected.length;
    }
    // Import historic games by date for ALL teams, not just the selected opponent.
    // Two historical basketball dates per run help keep the 15-minute worker within
    // free-tier request budgets and the six-minute scheduler lock. Source records
    // are upserted idempotently and the cursor advances only after successful writes.
    // Historical data is available across regular season and playoffs; do not
    // count preseason games as NBA prop research unless explicitly supported later.
    const seasonYear = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const currentSeasonStart = seasonYear + "-10-01";
    const historyFloor = (seasonYear - 1) + "-03-01";
    let cursor = health.backfill_cursor || offsetDate(todayET, -2);
    if (cursor < currentSeasonStart && cursor > (seasonYear - 1) + "-07-01") {
      // Skip the empty summer/offseason gap. Prior-season regular games and playoffs
      // matter for L10/L20 in the first weeks of a new NBA season.
      cursor = seasonYear + "-06-30";
    }
    for (let dayIndex = 0; dayIndex < 2 && cursor >= historyFloor; dayIndex++) {
      const archiveDay = cursor;
      const archive = await api.get("games/date/" + archiveDay, { tz: "America/New_York", league: "nba" });
      if (!Array.isArray(archive.data)) throw new Error("SportAPI history response has no games array");
      const historical = archive.data.filter((g: any) =>
        g?.league?.slug === "nba" && !/preseason|summer/i.test(String(g.stage ?? "")));
      await ingest(normalizeSportGames(historical));
      for (const raw of historical.filter((g: any) =>
        ["FT", "AOT"].includes(String(g.status).toUpperCase()) && g.has_boxscore !== false)) {
        const response = await api.get("games/" + raw.id + "/players");
        const normalized = normalizeSportBoxScore(raw, response);
        if (normalized.boxes.length) {
          await ingest({ players: normalized.players, boxes: normalized.boxes });
          counts.boxes += normalized.boxes.length;
        }
      }
      cursor = offsetDate(archiveDay, -1);
      if (cursor < currentSeasonStart && cursor > (seasonYear - 1) + "-07-01") {
        cursor = seasonYear + "-06-30";
      }
      nextCursor = cursor;
    }
    await finish("current", "SportAPI NBA schedules and final box scores synchronized; injuries and defender tracking unavailable from this source.");
    return respond(200, { state: "current", ...counts, provider: "SportAPI" });
  } catch (error) {
    const message = error instanceof SportApiError ? error.message : "NBA synchronization failed; verified records retained";
    try { await finish("error", message); } catch { console.error("Could not record NBA sync status", owner); }
    return respond(503, { state: "error", message });
  }
});
