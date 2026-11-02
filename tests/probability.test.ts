import test from 'node:test';
import assert from 'node:assert/strict';
import {empiricalOver,evaluateProbability} from '../src/lib/probability';
import type {BoxScore} from '../src/lib/types';
const row=(i:number,pts:number):BoxScore=>({
 game_id:'fixture:'+i,player_id:'fixture:1',team_id:'h',minutes:30,played:true,
 stats:{pts,reb:5,ast:6},fetched_at:'2026-01-01T00:00:00Z',
 game:{id:'fixture:'+i,provider_date:new Date(Date.UTC(2025,0,i)).toISOString().slice(0,10),starts_at:new Date(Date.UTC(2025,0,i)).toISOString(),season:2025,status:'final',home_team_id:'h',away_team_id:'a',home_score:100,away_score:90,source:'FIXTURE',postseason:false,fetched_at:'2026-01-01T00:00:00Z',home_team:{id:'h',name:'H',abbreviation:'H'},away_team:{id:'a',name:'A',abbreviation:'A'}}
});
test('withhold if under 20 verified prior games',()=>{
 assert.equal(empiricalOver(Array(19).fill(25),20.5),null);
 assert.equal(evaluateProbability(Array.from({length:19},(_,i)=>row(i+1,25)),'pts',20.5),null);
});
test('values above threshold raise empirical probability without promising certainty',()=>{
 const p=empiricalOver(Array.from({length:35},(_,i)=>i%5===0?10:30),20.5);
 assert.ok(p!==null&&p>.5&&p<1);
});
test('cutoff keeps future box scores out of probabilities and walk-forward backtest',()=>{
 const prior=Array.from({length:35},(_,i)=>row(i+1,i%3?28:10));
 const cutoff=new Date(Date.UTC(2025,0,36)).toISOString();
 const a=evaluateProbability(prior,'pts',20.5,cutoff)!;
 const b=evaluateProbability([...prior,row(40,100),row(41,0)],'pts',20.5,cutoff)!;
 assert.equal(a.sample,35);assert.equal(a.walkForward,15);
 assert.deepEqual(a,b);
 assert.equal(a.calibrated,false);
});
test('pushes do not count as winning over observations',()=>{
 const p=empiricalOver(Array(30).fill(20),20);
 assert.equal(p,null);
});
test('walk-forward evaluation tracks Brier, benchmark Brier and MAE',()=>{
 const rows=Array.from({length:50},(_,i)=>row(i+1,i%4===0?14:26));
 const assessment=evaluateProbability(rows,'pts',20.5)!;
 assert.equal(assessment.walkForward,30);
 assert.ok((assessment.brier??0)>=0&&(assessment.brier??2)<=1);
 assert.ok((assessment.baselineBrier??0)>=0&&(assessment.baselineBrier??2)<=1);
 assert.ok((assessment.mae??0)>=0);
});
