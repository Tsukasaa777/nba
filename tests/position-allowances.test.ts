import test from 'node:test';
import assert from 'node:assert/strict';
import {observedPositionAllowances} from '../src/lib/position-allowances';
const observations=Array.from({length:12},(_,i)=>({
 game_id:'sportapi:'+Math.floor(i/2),team_id:'sportapi:away',
 minutes:30,played:true,stats:{pts:20+i,reb:6,ast:4},
 player:{position:i%3===0?'F':'SF'}
}));
test('minimum sample and three distinct final games prevent thin evidence',()=>{
 assert.equal(observedPositionAllowances(observations.slice(0,4),'F','sportapi:home'),null);
 assert.equal(observedPositionAllowances(observations.slice(0,6),'F','sportapi:home'),null);
});
test('role-specific stats use real opponent observations only',()=>{
 const r=observedPositionAllowances(observations,'F','sportapi:home');
 assert.ok(r);assert.equal(r!.playerGames,12);
 assert.equal(r!.games,6);assert.equal(r!.reb,6);assert.equal(r!.ast,4);
 assert.equal(r!.pts,25.5);
});
test('selected team own box scores and players at other positions are excluded',()=>{
 const extras=[...observations,{...observations[0],team_id:'sportapi:home',stats:{pts:200,reb:100,ast:50}},{...observations[0],player:{position:'C'},stats:{pts:200,reb:100,ast:50}}];
 const profile=observedPositionAllowances(extras,'F','sportapi:home')!;
 assert.equal(profile.pts,25.5);
});
