import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPlayerDirectory,playerPositionGroup,suggestedResearchLine} from '../src/lib/player-finder';
import type {BoxScore,Player,Team} from '../src/lib/types';
const tor:Team={id:'sportapi:tor',name:'Toronto Raptors',abbreviation:'TOR'};
const lal:Team={id:'sportapi:lal',name:'Los Angeles Lakers',abbreviation:'LAL'};
const players:Player[]=[
 {id:'sportapi:1',name:'RJ Barrett',position:'F',team_id:tor.id,team:tor},
 {id:'sportapi:2',name:'LeBron James',position:'F',team_id:lal.id,team:lal},
 {id:'sportapi:3',name:'Austin Reaves',position:'G',team_id:lal.id,team:lal},
 {id:'sportapi:4',name:'Jakob Poeltl',position:'C',team_id:tor.id,team:tor}
];
const box=(i:number,pts:number):BoxScore=>({
 game_id:'sportapi:game'+i,player_id:'sportapi:1',team_id:tor.id,played:true,minutes:30,
 stats:{pts,reb:6,ast:4},fetched_at:'2026-11-01T00:00:00Z',
 game:{id:'sportapi:game'+i,home_team_id:tor.id,away_team_id:lal.id,
 home_team:tor,away_team:lal,starts_at:new Date(Date.UTC(2026,9,10+i)).toISOString(),provider_date:'2026-10-12',
 status:'final',source:'SportAPI',season:2026,postseason:false,home_score:110,away_score:108,fetched_at:'2026-11-01T00:00:00Z'}
});
test('find player by name without selecting a game first',()=>{
 assert.deepEqual(filterPlayerDirectory(players,'RJ', 'all','all').map(p=>p.name),['RJ Barrett']);
 assert.deepEqual(filterPlayerDirectory(players,'austin reaves','all','all').map(p=>p.name),['Austin Reaves']);
});
test('team and role filters are isolated and combined with typed search',()=>{
 assert.deepEqual(filterPlayerDirectory(players,'',lal.id,'guard').map(p=>p.name),['Austin Reaves']);
 assert.deepEqual(filterPlayerDirectory(players,'lakers','all','forward').map(p=>p.name),['LeBron James']);
 assert.equal(filterPlayerDirectory(players,'barrett',lal.id,'all').length,0);
 assert.equal(playerPositionGroup('PF'),'forward');
 assert.equal(playerPositionGroup('C'),'center');
});
test('median-based line is research-only and requires observed final games',()=>{
 assert.equal(suggestedResearchLine([],'pts'),null);
 assert.equal(suggestedResearchLine([box(1,19),box(2,23),box(3,29)],'pts'),23.5);
 assert.equal(suggestedResearchLine([box(1,19),box(2,23)],'pts'),21.5);
});
