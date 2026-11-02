import test from "node:test";
import assert from "node:assert/strict";
import { SportApiProvider, normalizeSportGame, normalizeSportGames, normalizeSportBoxScore, normalizeSportRoster, sportMinutes, easternDate } from "../supabase/functions/sync-nba/sportapi";
const home = { id: 11, name: "Denver Nuggets", abbreviation: "DEN" };
const away = { id: 16, name: "Golden State Warriors", abbreviation: "GSW" };
const fixture = { id: 1520, league: { slug: "nba" }, season: "2026-27", stage: "regular",
  start: "2026-10-27T02:00:00Z", status: "AOT", live: false,
  home: { ...home, score: 114 }, away: { ...away, score: 134 }, has_boxscore: true };
test("NBA game normalization is namespaced and honors ET schedule", () => {
  const game = normalizeSportGame(fixture);
  assert.equal(game.id, "sportapi:1520");
  assert.equal(game.provider_date, "2026-10-26");
  assert.equal(game.status, "final");
  assert.equal(game.season, 2026);
  assert.equal(game.home_score, 114);
  assert.equal(game.away_score, 134);
  assert.equal(easternDate(new Date("2026-10-27T02:00:00Z")), "2026-10-26");
});
test("scheduled zero scores are not shown as game results", () => {
  const g = normalizeSportGame({ ...fixture, status: "NS", home: { ...home, score: 0 } });
  assert.equal(g.status, "scheduled");
  assert.equal(g.home_score, null);
});
test("non NBA games are excluded", () => {
  assert.equal(normalizeSportGames([{ ...fixture, league: { slug: "wnba" } }]).games.length, 0);
});
test("minutes safely reject DNP and malformed values", () => {
  assert.equal(sportMinutes("32:30"), 32.5);
  assert.equal(sportMinutes("DNP"), null);
  assert.equal(sportMinutes("15:90"), null);
  assert.equal(sportMinutes(36), 36);
});
test("boxes preserve player identity, DNP and null stats", () => {
  const output = normalizeSportBoxScore(fixture, { success: true, game: { id: fixture.id }, data: {
    home: [{ player: { id: 134, name: "Player One", position: "G" }, minutes: 36,
      pts: 19, reb: 5, ast: 7, fg3m: 2, turnover: 3 }],
    away: [{ player: { id: 177, name: "Player Two" }, minutes: null, dnp: "Coach decision" }]
  }});
  assert.equal(output.boxes.length, 2);
  assert.equal(output.boxes[0].player_id, "sportapi:134");
  assert.equal(output.boxes[0].team_id, "sportapi:11");
  assert.equal(output.boxes[0].stats.reb, 5);
  assert.equal(output.boxes[0].stats.fga, null);
  assert.equal(output.boxes[1].played, false);
});
test("only final games produce historical box scores", () => {
  const g = { ...fixture, status: "Q3", live: true };
  assert.equal(normalizeSportBoxScore(g, { data: {home: [],away:[]} }).boxes.length, 0);
});
test("roster updates player active flags and team ownership", () => {
  assert.deepEqual(normalizeSportRoster(11, [{id:134,name:"Player One",position:"G"}])[0],
    {id:"sportapi:134",name:"Player One",position:"G",team_id:"sportapi:11",active:true});
});
test("SportAPI requests use X-Api-Key and parse documented success data", async () => {
  let auth = ""; let path = "";
  const mock = async (request: any, options: any) => { path=String(request); auth=options.headers["X-Api-Key"];
    return new Response(JSON.stringify({success:true,data:[]})); };
  const provider = new SportApiProvider("test-key", 5, mock as typeof fetch);
  await provider.get("games/date/2026-11-01",{league:"nba"});
  assert.equal(auth,"test-key");
  assert.match(path,/basketball\/games\/date\/2026-11-01/);
  assert.match(path,/league=nba/);
  assert.equal(provider.calls,1);
});
test("SportAPI HTTP errors don't expose secret body", async () => {
  let tries=0;
  const mock=async()=>{ tries++;return new Response("private info", {status:401}); };
  await assert.rejects(()=>new SportApiProvider("private-test",5,mock as typeof fetch).get("games/live"),/authorization failed/);
  assert.equal(tries,1);
});
test("SportAPI request budget prevents excess calls", async () => {
  const mock=async()=>new Response(JSON.stringify({success:true,data:[]}));
  const api=new SportApiProvider("test",1,mock as typeof fetch);
  await api.get("games/live");
  await assert.rejects(()=>api.get("games/live"),/Safe request budget/);
});
