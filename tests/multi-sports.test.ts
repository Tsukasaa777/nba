import test from 'node:test';
import assert from 'node:assert/strict';
import {adjacentUtcDates,assertSportsDate,filterSportsSlate,normalizeWnbaScoreboard,normalizeMlbSchedule,normalizeWnbaBoxscore,normalizeMlbBoxscore} from '../src/lib/sports';

test('PHT day fetches the prior UTC calendar date and current date',()=>{
 assert.deepEqual(adjacentUtcDates('2026-11-01'),['2026-10-31','2026-11-01']);
 assert.throws(()=>assertSportsDate('2026-02-01;drop table'));
});
test('WNBA schedule keeps league identity and parses final scores',()=>{
 const data={events:[{id:'401918311',date:'2026-11-01T00:00Z',status:{type:{name:'STATUS_FINAL'}},
  competitions:[{venue:{fullName:'Test Arena'},competitors:[
   {homeAway:'away',team:{displayName:'Atlanta Dream',abbreviation:'ATL'},score:'63'},
   {homeAway:'home',team:{displayName:'Golden State Valkyries',abbreviation:'GS'},score:'68'}
  ]}]}]};
 const games=normalizeWnbaScoreboard(data);
 assert.equal(games[0].id,'wnba:401918311');
 assert.equal(games[0].status,'final');
 assert.equal(games[0].home.score,68);
 assert.equal(filterSportsSlate(games,'2026-11-01').length,1);
 assert.equal(filterSportsSlate(games,'2026-10-31').length,0);
 assert.equal(filterSportsSlate([...games,...games],'2026-11-01').length,1);
});
test('MLB schedule does not bleed into WNBA and uses MLB team formats',()=>{
 const games=normalizeMlbSchedule({dates:[{games:[{gamePk:849803,gameDate:'2026-10-28T00:00:00Z',
  status:{abstractGameState:'Final'},venue:{name:'Tropicana Field'},
  teams:{away:{team:{name:'Milwaukee Brewers'},score:3},home:{team:{name:'Tampa Bay Rays'},score:4}}
 }]}]});
 assert.equal(games.length,1);
 assert.equal(games[0].id,'mlb:849803');
 assert.equal(games[0].home.score,4);
 assert.equal(filterSportsSlate(games,'2026-10-28').length,1);
 assert.equal(filterSportsSlate(games,'2026-10-27').length,0);
});
test('WNBA stat mapping uses actual ESPN group names and DNP exclusion',()=>{
 const rows=normalizeWnbaBoxscore({boxscore:{players:[{team:{displayName:'Atlanta Dream'},
  statistics:[{names:['MIN','PTS','REB','AST','3PT'],athletes:[
   {athlete:{id:'22',displayName:'Player A',position:{abbreviation:'F'}},stats:['30','21','8','4','2-5']},
   {didNotPlay:true,athlete:{id:'23',displayName:'Player B'},stats:[]}
  ]}]}]}});
 assert.equal(rows.length,1);
 assert.equal(rows[0].playerId,'wnba:22');
 assert.equal(rows[0].metrics.PTS,'21');
 assert.equal(rows[0].metrics.REB,'8');
});
test('MLB stats separate batting, pitching and correctly derive total bases',()=>{
 const rows=normalizeMlbBoxscore({teams:{
  away:{team:{name:'Away'},players:{ID1:{person:{id:1,fullName:'Batter'},position:{abbreviation:'RF'},
    stats:{batting:{hits:3,doubles:1,triples:0,homeRuns:1,atBats:4,rbi:3}}}}},
  home:{team:{name:'Home'},players:{ID2:{person:{id:2,fullName:'Pitcher'},position:{abbreviation:'P'},
    stats:{pitching:{inningsPitched:'6.0',strikeOuts:7,earnedRuns:2}}}}}
 }});
 assert.equal(rows.length,2);
 assert.equal(rows[0].category,'batting');
 assert.equal(rows[0].metrics.TB,7); // 3 hits + one double upgrade + three extra for homer = 7
 assert.equal(rows[1].category,'pitching');
 assert.equal(rows[1].metrics.SO,7);
});
test('reject provider response errors instead of inventing games',()=>{
 assert.throws(()=>normalizeWnbaScoreboard({}));
 assert.throws(()=>normalizeMlbSchedule({}));
 assert.throws(()=>normalizeMlbBoxscore({teams:{}}));
});
