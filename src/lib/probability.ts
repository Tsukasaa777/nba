import {gameTime,qualifying,valueOf} from './analytics';
import type {BoxScore,Market} from './types';
/**
 * Conservative empirical player-stat probability research model.
 * Out-of-sample evaluation is walk-forward only: prediction at i sees indices [0..i-1].
 * A positive track record here does NOT demonstrate cohort-level calibration or profitable wagering.
 */
export const PROBABILITY_MODEL='empirical-recency-v1-experimental';
export function empiricalOver(values:number[],line:number):number|null{
 if(values.length<20||!Number.isFinite(line)||line<0||line>500)return null;
 // High recency weight with four prior pseudo-observations split at the threshold.
 let over=0,weight=0;
 const recent=values.slice(-40);
 for(let i=0;i<recent.length;i++){
  if(recent[i]===line)continue; // Push neither an over nor an under.
  const w=Math.pow(.97,recent.length-1-i);
  weight+=w;if(recent[i]>line)over+=w;
 }
 // Leave out overly speculative pushes-heavy cases.
 if(weight<12)return null;
 return (over+2)/(weight+4);
}
export type ProbabilityAssessment={
 version:string;sample:number;over:number;under:number;hitRate:number;
 walkForward:number;brier:number|null;baselineBrier:number|null;
 mae:number|null;status:'experimental'|'out-of-sample screened';calibrated:false;
};
export function evaluateProbability(rows:BoxScore[],market:Market,line:number,cutoff?:string):ProbabilityAssessment|null{
 const chronological=qualifying(rows,market,{before:cutoff}).sort((a,b)=>gameTime(a).localeCompare(gameTime(b)));
 const values=chronological.map(r=>valueOf(r,market)!).filter(v=>Number.isFinite(v));
 const p=empiricalOver(values,line);
 if(p===null)return null;
 let score=0,reference=0,errors=0,n=0;
 const forecasts:number[]=[];
 for(let i=20;i<values.length;i++){
   const v=values[i];
   if(v===line)continue;
   const prev=values.slice(0,i);
   const predicted=empiricalOver(prev,line);
   if(predicted===null)continue;
   const y=v>line?1:0;
   score+=(predicted-y)**2;
   // Baseline is past-only, unweighted, Laplace-smoothed.
   const prevSettled=prev.filter(v=>v!==line);
   const baseline=(prevSettled.filter(v=>v>line).length+2)/(prevSettled.length+4);
   reference+=(baseline-y)**2;
   errors+=Math.abs(prev.slice(-20).reduce((sum,v)=>sum+v,0)/Math.min(20,prev.length)-v);
   n++;forecasts.push(predicted);
 }
 const win=values.filter(v=>v>line).length;
 const settled=values.filter(v=>v!==line).length;
 const brier=n?score/n:null,base=n?reference/n:null;
 const screened=n>=20&&brier!==null&&base!==null&&brier<=.24&&brier+0.01<base;
 return {
   version:PROBABILITY_MODEL,sample:values.length,over:p,under:1-p,
   hitRate:settled?win/settled:0,walkForward:n,
   brier,baselineBrier:base,mae:n?errors/n:null,
   status:screened?'out-of-sample screened':'experimental',
   calibrated:false
 };
}
