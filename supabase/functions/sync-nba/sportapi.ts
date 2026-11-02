export type RecordJson = Record<string, any>;
export class SportApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const PREFIX = "sportapi:";
const validId = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error("Invalid SportAPI identifier");
  return PREFIX + value;
};
const amount = (n: unknown): number | null => { const v = typeof n === "string" && /^\d+(?:\.\d+)?$/.test(n) ? Number(n) : n; return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null; };
const coalesceNumber = (...values: unknown[]) => values.map(amount).find(v => v !== null) ?? null;
const year = (s: unknown) => {
  const match = /^([12]\d{3})/.exec(String(s ?? ""));
  if (!match) throw new Error("Missing NBA season");
  return Number(match[1]);
};
const etDate = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(iso));
  const field = (type: string) => parts.find(p => p.type === type)?.value;
  return field("year") + "-" + field("month") + "-" + field("day");
};
export const easternDate = (date: Date) => etDate(date.toISOString());
export function offsetDate(date: string, days: number) {
  return new Date(new Date(date + "T12:00:00Z").getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
export function normalizeSportTeam(t: RecordJson) {
  return { id: validId(t.id), name: String(t.name || "").trim(),
    abbreviation: String(t.abbreviation || "").trim(), conference: t.conference ?? null };
}
export function normalizeSportGame(g: RecordJson) {
  if (g.league?.slug !== "nba") throw new Error("Ignoring non-NBA game");
  const starts = String(g.start ?? "");
  if (!starts || !Number.isFinite(Date.parse(starts))) throw new Error("NBA tipoff must be ISO timestamp");
  const code = String(g.status ?? "").toUpperCase();
  const status = ["FT", "AOT"].includes(code) ? "final"
    : ["NS", "TBD"].includes(code) ? "scheduled"
    : ["POST"].includes(code) ? "postponed"
    : ["CANC"].includes(code) ? "canceled"
    : g.live === true || /^Q[1-4]$|^H[1-2]$|^OT\d*$|^HT$/.test(code) ? "live" : "unknown";
  const home = normalizeSportTeam(g.home), away = normalizeSportTeam(g.away);
  return { id: validId(g.id), provider_date: etDate(starts), starts_at: new Date(starts).toISOString(),
    season: year(g.season), status, home_team_id: home.id, away_team_id: away.id,
    home_score: status === "scheduled" ? null : amount(g.home.score),
    away_score: status === "scheduled" ? null : amount(g.away.score),
    postseason: ["playoffs", "play-in"].includes(String(g.stage ?? "").toLowerCase()) };
}
export function normalizeSportGames(items: RecordJson[]) {
  const teams = new Map<string, ReturnType<typeof normalizeSportTeam>>();
  const games: ReturnType<typeof normalizeSportGame>[] = [];
  for (const item of items) {
    if (item.league?.slug !== "nba") continue;
    const game = normalizeSportGame(item);
    games.push(game);
    for (const t of [item.home, item.away]) {
      const team = normalizeSportTeam(t); teams.set(team.id, team);
    }
  }
  return { teams: [...teams.values()], games };
}
export function sportMinutes(n: unknown): number | null {
  if (typeof n === "number") return Number.isFinite(n) && n >= 0 && n <= 80 ? n : null;
  if (typeof n !== "string") return null;
  const s = n.trim();
  if (!/^\d+(?::[0-5]\d)?(?:\.\d+)?$/.test(s)) return null;
  const [whole, part] = s.split(":");
  const result = Number(whole) + (part === undefined ? 0 : Number(part) / 60);
  return result <= 80 ? result : null;
}
export function normalizeSportRoster(teamId: number, items: RecordJson[]) {
  return items.filter(p => p?.id && p.name).map(p => ({
    id: validId(p.id), name: String(p.name), position: p.position ?? null,
    team_id: validId(teamId), active: true
  }));
}
export function normalizeSportBoxScore(gameRaw: RecordJson, response: RecordJson) {
  const normGame = normalizeSportGame(gameRaw);
  if (normGame.status !== "final") return { players: [], boxes: [] };
  const teams = new Map([["home", normGame.home_team_id], ["away", normGame.away_team_id]]);
  const data = response.data;
  if (!data || !Array.isArray(data.home) || !Array.isArray(data.away))
    throw new Error("SportAPI player box score is missing home/away arrays");
  if (response.game?.id !== undefined && response.game.id !== gameRaw.id)
    throw new Error("SportAPI player box score references another game");
  const players = new Map<string, RecordJson>(), boxes: RecordJson[] = [];
  for (const side of ["home", "away"]) {
    const teamId = teams.get(side)!;
    for (const s of data[side] as RecordJson[]) {
      const p = s?.player;
      if (!p?.id || !p.name) continue;
      const playerId = validId(p.id), minutes = sportMinutes(s.minutes);
      const didNotPlay = Boolean(s.dnp);
      const stats = {
        pts: coalesceNumber(s.pts, s.points),
        reb: coalesceNumber(s.reb, s.rebounds, s.treb),
        ast: coalesceNumber(s.ast, s.assists),
        fg3m: coalesceNumber(s.fg3m, s.tpm, s.three_pt_made),
        stl: coalesceNumber(s.stl, s.steals),
        blk: coalesceNumber(s.blk, s.blocks),
        turnover: coalesceNumber(s.turnover, s.tov, s.turnovers),
        fga: coalesceNumber(s.fga, s.field_goals_attempted),
        fgm: coalesceNumber(s.fgm, s.field_goals_made),
        fta: coalesceNumber(s.fta, s.free_throws_attempted)
      };
      players.set(playerId, { id: playerId, name: String(p.name), position: p.position ?? null, team_id: teamId, active: true });
      boxes.push({ game_id: normGame.id, player_id: playerId, team_id: teamId,
        played_at: normGame.starts_at, minutes, played: !didNotPlay && minutes !== null && minutes > 0, stats });
    }
  }
  return { players: [...players.values()], boxes };
}
export class SportApiProvider {
  calls = 0;
  constructor(private key: string, private limit = 40, private fetcher: typeof fetch = fetch) {}
  async get(path: string, params: Record<string, string> = {}): Promise<RecordJson> {
    if (this.calls >= this.limit) throw new SportApiError(429, "Safe request budget reached for this run");
    const url = new URL("https://sportapi.ai/api/basketball/" + path.replace(/^\/+/, ""));
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    for (let attempt = 0; attempt < 3; attempt++) {
      this.calls++;
      let response: Response;
      try {
        response = await this.fetcher(url, {headers: {"X-Api-Key": this.key, Accept: "application/json"},
          signal: AbortSignal.timeout(12000)});
      } catch {
        if (attempt === 2) throw new SportApiError(504, "NBA API timed out");
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      if (response.status === 401 || response.status === 403)
        throw new SportApiError(response.status, "SportAPI authorization failed or endpoint unavailable");
      if (response.status === 429)
        throw new SportApiError(429, "SportAPI free quota reached; sync will retry at the next scheduled run");
      if (!response.ok) {
        if (response.status >= 500 && attempt < 2) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
        throw new SportApiError(response.status, "SportAPI rejected the request");
      }
      let payload: RecordJson;
      try { payload = await response.json(); }
      catch { throw new SportApiError(502, "SportAPI returned invalid JSON"); }
      if (payload.success !== true) throw new SportApiError(502, "SportAPI returned an unsuccessful response");
      return payload;
    }
    throw new SportApiError(503, "NBA provider unavailable");
  }
}
