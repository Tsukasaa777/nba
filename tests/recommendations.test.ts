import test from 'node:test';
import assert from 'node:assert/strict';
import {rankNbaSlate} from '../src/lib/recommendations';
import type {HistoricalStat} from '../src/lib/recommendations';
import type {Game,Player,Team,Injury} from '../src/lib/types';
const bos:Team={id:'sportapi:2',name:'Boston Celtics',abbreviation:'BOS'};
const ny:Team={id:'sportapi:3',name:'New York Knicks',abbreviation:'NY'};
const game:Game={id:'sportapi:2000',season:2026,provider_date:'2026-11-11',
 starts_at:'2026-11-11T00:30:00Z',status:'scheduled',home_team_id:ny.id,away_team_id:bos.id,
 home_team:ny,away_team:bos,home_score:null,away_score:null,source:'SportAPI',fetched_at:'2026-11-09T12:00:00Z',postseason:false};
const player:Player={id:'sportapi:100',name:'Verified Guard',team_id:bos.id,team:bos,position:'G'};
const numbers=[27,26,29,28,25,19,20,18,21,23];
function makeRows(valueSource=numbers):HistoricalStat[]{
 return valueSource.map((pts,i)=>({
  game_id:'sportapi:'+(1000+i),player_id:player.id,team_id:bos.id,
  played_at:new Date(Date.UTC(2026,10,9-i)).toISOString(),
  minutes:32+(i%3),played:true,stats:{pts,reb:4,ast:6,fg3m:2},
  game:{status:'final',starts_at:new Date(Date.UTC(2026,10,9-i)).toISOString(),
   home_team_id:bos.id,away_team_id:ny.id}
 }));
}
const slate=(rows:HistoricalStat[],extra:Partial<Parameters<typeof rankNbaSlate>[0]>={})=>
 rankNbaSlate({date:'2026-11-11',games:[game],players:[player],logs:rows,injuries:[],injuryFeedFresh:false,...extra});
test('assigns one candidate per actual matchup player using only past completed game samples',()=>{
 const r=slate(makeRows());assert.equal(r.matches.length,1);
 assert.ok(r.matches[0].candidates.length>0);
 const pts=r.matches[0].candidates.find(c=>c.market==='pts');
 assert.ok(pts);assert.equal(pts.side,'over');
 assert.equal(pts.referenceLine,20.5);
 assert.equal(pts.sample,10);
 assert.equal(pts.last5Hit,5);
 assert.ok(pts.rankScore>60);
 assert.ok(pts.caveats.some(s=>s.includes('Injury availability not verified')));
 assert.equal(r.matches[0].away,'BOS');
});
test('excludes future, non-final, traded and DNP game records',()=>{
 const source=makeRows().map((r,i)=>i<4?{...r,game:{...r.game,status:'scheduled'}}:r);
 assert.equal(slate(source).matches[0].candidates.length,0);
 const other=makeRows().map((r,i)=>i<4?{...r,team_id:ny.id}:r);
 assert.equal(slate(other).matches[0].candidates.length,0);
 const future=makeRows().map((r,i)=>i<4?{...r,played_at:'2026-11-12T00:00:00Z',game:{...r.game,starts_at:'2026-11-12T00:00:00Z'}}:r);
 assert.equal(slate(future).matches[0].candidates.length,0);
});
test('never invents odds, certainty or picks for absent/injured players',()=>{
 assert.equal(slate([]).matches[0].candidates.length,0);
 const injury={player_id:player.id,status:'Out',fetched_at:'2026-11-10T01:00:00Z'} as Injury;
 const blocked=slate(makeRows(),{injuries:[injury],injuryFeedFresh:true});
 assert.equal(blocked.totalCandidates,0);
 const unknown=slate(makeRows(),{injuries:[injury],injuryFeedFresh:false});
 assert.ok(unknown.totalCandidates>0);
});
test('does not create recommendations for a completed or empty NBA slate',()=>{
 const completed=slate(makeRows(),{games:[{...game,status:'final'}]});
 assert.equal(completed.matches.length,0);
 const empty=slate(makeRows(),{games:[]});
 assert.equal(empty.totalCandidates,0);
});
test('needs at least 8 real games and excludes low-minute or incomplete-market data',()=>{
 assert.equal(slate(makeRows().slice(0,7)).totalCandidates,0);
 const low=makeRows().map(r=>({...r,minutes:9}));
 assert.equal(slate(low).totalCandidates,0);
 const missing=makeRows().map(r=>({...r,stats:{}}));
 assert.equal(slate(missing).totalCandidates,0);
});
test('each game retains its own matchup and at most three unique players',()=>{
 const second={...player,id:'sportapi:101',name:'Second Guard'};
 const third={...player,id:'sportapi:102',name:'Third Guard'};
 const fourth={...player,id:'sportapi:103',name:'Fourth Guard'};
 const logs=[...makeRows(),...makeRows().map(r=>({...r,player_id:second.id})),
  ...makeRows().map(r=>({...r,player_id:third.id})),...makeRows().map(r=>({...r,player_id:fourth.id}))];
 const r=slate(logs,{players:[player,second,third,fourth]});
 assert.ok(r.matches[0].candidates.length<=3);
 assert.equal(new Set(r.matches[0].candidates.map(x=>x.playerId)).size,r.matches[0].candidates.length);
});
