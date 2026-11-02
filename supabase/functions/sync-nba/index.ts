import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { SportApiProvider, SportApiError, easternDate, offsetDate,
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
    const key = Deno.env.get("SPORTAPI_API_KEY");
    if (!key) {
      await finish("awaiting_provider", "SportAPI sync ready, but SPORTAPI_API_KEY has not been configured");
      return respond(200, { state: "awaiting_provider", ...counts });
    }
    const api = new SportApiProvider(key, 45);
    const now = new Date();
    const todayET = easternDate(now);
    const { data: health, error: healthError } = await db.from("data_health").select("*").eq("id", "nba").single();
    if (healthError) throw new Error("Could not read sync checkpoint");
    // Two US basketball dates per 15-minute run, instead of all dates, to protect the 14k/month free cap.
    const recent = [offsetDate(todayET, -1), todayET];
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
      const league = await api.get("leagues/nba");
      const teamsRaw = league.data?.teams;
      if (!Array.isArray(teamsRaw) || !teamsRaw.length) throw new Error("SportAPI NBA league roster list unavailable");
      const players = [];
      for (const t of teamsRaw) {
        const result = await api.get("teams/" + t.id + "/roster");
        if (!Array.isArray(result.data)) throw new Error("SportAPI roster response missing player array");
        players.push(...normalizeSportRoster(t.id, result.data));
      }
      await ingest({ teams: teamsRaw.map(normalizeSportTeam), players });
      rosterOk = true;
    }
    // Slow historical backfill, four dates/day maximum, respecting the 14k/month free quota.
    if (now.getUTCHours() % 6 === 0 && now.getUTCMinutes() < 15) {
      const previous = health.backfill_cursor || offsetDate(todayET, -4);
      const seasonYear = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      const firstDay = seasonYear + "-10-01";
      if (previous >= firstDay) {
        const archive = await api.get("games/date/" + previous, { tz: "America/New_York", league: "nba" });
        if (!Array.isArray(archive.data)) throw new Error("SportAPI archive is missing games array");
        const older = archive.data.filter((g: any) => g?.league?.slug === "nba");
        await ingest(normalizeSportGames(older));
        for (const raw of older.filter((g: any) => ["FT","AOT"].includes(String(g.status).toUpperCase()) && g.has_boxscore !== false)) {
          const response = await api.get("games/" + raw.id + "/players");
          const normalized = normalizeSportBoxScore(raw, response);
          if (normalized.boxes.length) {
            await ingest({ players: normalized.players, boxes: normalized.boxes });
            counts.boxes += normalized.boxes.length;
          }
        }
        nextCursor = offsetDate(previous, -1);
      }
    }
    await finish("current", "SportAPI NBA schedules and final box scores synchronized; injuries and defender tracking unavailable from this source.");
    return respond(200, { state: "current", ...counts, provider: "SportAPI" });
  } catch (error) {
    const message = error instanceof SportApiError ? error.message : "NBA synchronization failed; verified records retained";
    try { await finish("error", message); } catch { console.error("Could not record NBA sync status", owner); }
    return respond(503, { state: "error", message });
  }
});
