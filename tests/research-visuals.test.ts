import test from 'node:test';
import assert from 'node:assert/strict';
import {rotationFromRecords,opponentComparison} from '../src/lib/research-visuals';
import type {Game,Player} from '../src/lib/types';
import type {RecentBox} from '../src/lib/role-context';

const players:Player[]=[
 {id:'sportapi:1',name:'Player One',position:'G',team_id:'sportapi:home'},
 {id:'sportapi:2',name:'Player Two',position:'F',team_id:'sportapi:away'},
 {id:'sportapi:3',name:'No Game',position:'C',team_id:'sportapi:home'}
];
const record=(id:string,team:string,minutes:number,day:number):RecentBox=>({
 player_id:id,team_id:team,played:true,minutes,played_at:new Date(Date.UTC(2026,9,day)).toISOString(),
 stats:{pts:22,reb:7,ast:5}
});
test('rotation minutes use only observed player-team appearances',()=>{
 const logs=[record('sportapi:1','sportapi:home',32,20),record('sportapi:1','sportapi:home',28,22),
  record('sportapi:2','sportapi:away',35,21),record('sportapi:1','sportapi:away',50,23)];
 const home=rotationFromRecords(players,logs,'sportapi:home');
 assert.equal(home.length,1);assert.equal(home[0].minutes,30);
 assert.equal(home[0].minMinutes,28);assert.equal(home[0].maxMinutes,32);assert.equal(home[0].sample,2);
});
test('comparison matrix and similar players are based on previous real boxscores',()=>{
 const games=Array.from({length:5},(_,i)=>({
 id:'sportapi:game'+i,starts_at:new Date(Date.UTC(2026,9,i+1)).toISOString(),provider_date:'2026-10-01'
 })) as Game[];
 const rows=Array.from({length:10},(_,i)=>({
 game_id:games[i%5].id,team_id:'sportapi:visitor',played:true,minutes:30,
 stats:{pts:20,reb:6,ast:4,fg3m:3},
 player:{id:'sportapi:player'+i,name:'Comparable '+i,position:'G'}
 }));
 const result=opponentComparison(rows,'sportapi:opp','G',games);
 assert.equal(result.matrix[0].profile?.pts,20);
 assert.equal(result.similar.length,10);
 assert.equal(result.similar[0].fg3m,3);
 const other=opponentComparison(rows,'sportapi:opp','C',games);
 assert.equal(other.similar.length,0);
});
test('missing shot zones cannot be inferred from position box scores',()=>{
 const result=opponentComparison([], 'sportapi:opp','F',[]);
 assert.ok(result.matrix.every(r=>r.profile===null));
 assert.deepEqual(result.similar,[]);
});
