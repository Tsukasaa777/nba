import test from 'node:test';
import assert from 'node:assert/strict';
import {findScheduleEventId,extractEarlyGame,isEarlyMarket,mergeEarlyStats} from '../src/lib/early-game';
import {valueOf,qualifying,MARKETS} from '../src/lib/analytics';
import {normalizeSportBoxScore} from '../supabase/functions/sync-nba/sportapi';
import type {BoxScore,Player,Team,Market} from '../src/lib/types';
const home:Team={id:'sportapi:11',name:'Boston Celtics',abbreviation:'BOS'};
const away:Team={id:'sportapi:12',name:'Los Angeles Lakers',abbreviation:'LAL'};
const player:Player={id:'sportapi:98',name:'Test Player',position:'G',team_id:home.id,team:home};
const row:BoxScore={game_id:'sportapi:1555',player_id:player.id,team_id:home.id,minutes:31,played:true,
 stats:{pts:20,reb:4,ast:6,fgm:8,fg3m:2,fta:4,fga:17},
 game:{id:'sportapi:1555',provider_date:'2026-11-05',starts_at:'2026-11-06T00:00:00Z',
  season:2026,status:'final',home_team_id:home.id,away_team_id:away.id,
  home_team:home,away_team:away,source:'SportAPI',fetched_at:'2026-11-06T04:00:00Z',postseason:false,home_score:100,away_score:95},
 fetched_at:'2026-11-06T04:00:00Z'};
const summary={header:{competitions:[{status:{type:{completed:true}},competitors:[{linescores:[{displayValue:'4'}]},{linescores:[{displayValue:'4'}]}]}]},
 boxscore:{players:[{team:{abbreviation:'BOS'},statistics:[{athletes:[{athlete:{id:'123',displayName:'Test Player'},didNotPlay:false}]}]},
  {team:{abbreviation:'LAL'},statistics:[{athletes:[{athlete:{id:'321',displayName:'Opponent'},didNotPlay:false}]}]}]},
 plays:[
  {period:{number:1},sequenceNumber:'1',type:{text:'Jumpball'},scoringPlay:false},
  {period:{number:1},sequenceNumber:'2',scoringPlay:true,scoreValue:1,text:'Test Player makes free throw 1 of 2',participants:[{athlete:{id:'123'}}]},
  {period:{number:1},sequenceNumber:'3',scoringPlay:true,scoreValue:3,text:'Opponent makes three-pointer (Test Player assists)',participants:[{athlete:{id:'321'}},{athlete:{id:'123'}}]},
  {period:{number:1},sequenceNumber:'4',type:{text:'Defensive Rebound'},text:'Test Player defensive rebound',scoringPlay:false,participants:[{athlete:{id:'123'}}]},
  {period:{number:1},sequenceNumber:'5',scoringPlay:true,scoreValue:2,text:'Test Player makes layup',participants:[{athlete:{id:'123'}}]},
  {period:{number:1},sequenceNumber:'6',scoringPlay:true,scoreValue:2,text:'Opponent makes layup',participants:[{athlete:{id:'321'}}]},
  {period:{number:1},sequenceNumber:'100',type:{text:'End Period'},scoringPlay:false}
 ]};
test('full-game added player props map to the correct raw box-score keys',()=>{
 const fixture={id:1555,league:{slug:'nba'},season:'2026-27',stage:'regular',start:'2026-11-06T00:00:00Z',
 status:'FT',home:{id:11,name:'Boston Celtics',abbreviation:'BOS',score:100},away:{id:12,name:'Lakers',abbreviation:'LAL',score:95}};
 const normalized=normalizeSportBoxScore(fixture,{game:{id:1555},data:{home:[{
  player:{id:98,name:'Test Player'},minutes:31,pts:22,tpm:2,tpa:7,fga:17,fta:4,ftm:3,pf:4,stl:2,blk:1
 }],away:[]}});
 const stat=normalized.boxes[0].stats;
 assert.equal(stat.fg3a,7);assert.equal(stat.ftm,3);assert.equal(stat.pf,4);
 assert.equal(stat.stl,2);assert.equal(stat.blk,1);
 assert.equal(MARKETS.fg3a.short,'3PA');assert.equal(MARKETS.pf.short,'PF');
});
test('matches an ESPN event only with exact team sides and close official tip-off time',()=>{
 const schedule={events:[{id:'401999999',date:'2026-11-06T00:00:00Z',competitions:[{competitors:[
  {homeAway:'home',team:{abbreviation:'BOS'}},{homeAway:'away',team:{abbreviation:'LAL'}}
 ]}]}]};
 assert.equal(findScheduleEventId(schedule,row),'401999999');
 assert.equal(findScheduleEventId({events:[{...schedule.events[0],date:'2026-11-06T02:00:00Z'}]},row),null);
 assert.equal(findScheduleEventId({events:[{...schedule.events[0],competitions:[{competitors:[
  {homeAway:'home',team:{abbreviation:'LAL'}},{homeAway:'away',team:{abbreviation:'BOS'}}]}]}]},row),null);
});
test('first points scorer includes free throws and Q1 PTS AST REB are attributed to athlete IDs',()=>{
 const v=extractEarlyGame(summary,player,row);
 assert.ok(v);
 assert.equal(v.first_score,1);
 assert.equal(v.q1_pts,3);
 assert.equal(v.q1_ast,1);
 assert.equal(v.q1_reb,1);
 const m=mergeEarlyStats([row],[v]);
 assert.equal(valueOf(m[0],'first_score'),1);
 assert.equal(valueOf(m[0],'q1_ast'),1);
 assert.equal(qualifying(m,'q1_pts').length,1);
});
test('quarter box scores are withheld without complete verified ESPN period',()=>{
 const incomplete={...summary,plays:summary.plays.slice(0,-1)};
 assert.equal(extractEarlyGame(incomplete,player,row),null);
 const badScore={...summary,header:{competitions:[{...summary.header.competitions[0],competitors:[{linescores:[{displayValue:'20'}]},{linescores:[{displayValue:'4'}]}]}]}};
 assert.equal(extractEarlyGame(badScore,player,row),null);
 assert.equal(extractEarlyGame(summary,{...player,name:'Wrong Player'},row),null);
 assert.equal(valueOf(row,'q1_pts'),null);
 assert.equal(mergeEarlyStats([row],[])[0].stats.first_score,undefined);
});
test('ESPN early-market research never confuses a 0 first-score result with missing data',()=>{
 const rival={...player,name:'Opponent',team_id:away.id,team:away};
 const rivalRow={...row,player_id:rival.id,team_id:away.id};
 const e=extractEarlyGame(summary,rival,rivalRow);
 assert.ok(e);assert.equal(e.first_score,0);assert.equal(e.q1_pts,5);
 assert.ok(isEarlyMarket('first_score'));
 assert.ok(isEarlyMarket('q1_ast'));
 assert.equal(isEarlyMarket('fga'),false);
});
