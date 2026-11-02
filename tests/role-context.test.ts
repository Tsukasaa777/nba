import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoleContext,roleGroup} from '../src/lib/role-context';
import {normalizeInjuryFeed} from '../src/lib/injury-feed';
import type {Game,Player} from '../src/lib/types';
const home={id:'sportapi:21',name:'Detroit Pistons',abbreviation:'DET'};
const away={id:'sportapi:30',name:'Boston Celtics',abbreviation:'BOS'};
const game:Game={id:'sportapi:7',home_team_id:home.id,away_team_id:away.id,
 home_team:home,away_team:away,starts_at:'2026-11-04T00:00:00+00:00',provider_date:'2026-11-03',status:'scheduled',
 home_score:null,away_score:null,season:2026,source:'fixture',fetched_at:'2026-11-02T00:00:00Z',postseason:false};
const players:Player[]=[
 {id:'sportapi:1',name:'Scoring Wing',position:'F',team_id:away.id},
 {id:'sportapi:2',name:'Opponent Wing',position:'F',team_id:home.id},
 {id:'sportapi:3',name:'Opponent Guard',position:'G',team_id:home.id},
 {id:'sportapi:4',name:'High Scoring Teammate',position:'G',team_id:away.id},
 {id:'sportapi:5',name:'Bench Center',position:'C',team_id:home.id}
];
const samples=players.flatMap(p=>Array.from({length:3},(_,i)=>({
 player_id:p.id,team_id:p.team_id!,minutes:p.id==='sportapi:5'?4:32,
 played:true,played_at:'2026-10-2'+(i+1)+'T23:00:00Z',
 stats:{pts:p.id==='sportapi:4'?24:15,ast:p.id==='sportapi:4'?7:3,reb:5}
})));
test('position compatible, recent-minute opponent shortlisted, not bench center or unrelated guard',()=>{
 const context=buildRoleContext(game,players[0],players,samples);
 assert.equal(context.defenders[0]?.name,'Opponent Wing');
 assert.ok(!context.defenders.some(d=>d.name==='Bench Center'));
 assert.ok(!context.defenders.some(d=>d.name==='Opponent Guard'));
 assert.equal(context.teammates[0]?.name,'High Scoring Teammate');
 assert.equal(context.teammates[0]?.pts,24);
});
test('no recent minutes means no invented defender names',()=>{
 assert.equal(buildRoleContext(game,players[0],players,[]).defenders.length,0);
 assert.equal(buildRoleContext(game,players[0],players,[]).teammates.length,0);
});
test('verified position abbreviations survive injury response',()=>{
 const feed=normalizeInjuryFeed({status:'success',timestamp:'2026-11-02T00:00:00Z',injuries:[
  {displayName:'Detroit Pistons',injuries:[
   {id:'123',status:'Out',athlete:{displayName:'Player C',position:{abbreviation:'C'}}},
   {id:'124',status:'Questionable',athlete:{displayName:'Player Unknown',position:{abbreviation:'UNKNOWN'}}}
  ]}]},'2026-11-02T00:00:10Z');
 assert.equal(feed.reports[0].position,'C');
 assert.equal(feed.reports[1].position,null);
});
test('guard, wing and big role grouping is transparent',()=>{
 assert.equal(roleGroup('PG'),'guard');assert.equal(roleGroup('SF'),'wing');
 assert.equal(roleGroup('C'),'big');assert.equal(roleGroup(null),'unknown');
});
