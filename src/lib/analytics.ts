import type { BoxScore, Market, Selection, StatKey } from './types';
export const MARKETS: Record<Market,{label:string; short:string; keys:StatKey[]}> = {
  pts:{label:'Points',short:'PTS',keys:['pts']},reb:{label:'Rebounds',short:'REB',keys:['reb']},ast:{label:'Assists',short:'AST',keys:['ast']},fg3m:{label:'3-pointers made',short:'3PM',keys:['fg3m']},stl:{label:'Steals',short:'STL',keys:['stl']},blk:{label:'Blocks',short:'BLK',keys:['blk']},turnover:{label:'Turnovers',short:'TOV',keys:['turnover']},pr:{label:'Points + rebounds',short:'PR',keys:['pts','reb']},pa:{label:'Points + assists',short:'PA',keys:['pts','ast']},ra:{label:'Rebounds + assists',short:'RA',keys:['reb','ast']},pra:{label:'Points + rebounds + assists',short:'PRA',keys:['pts','reb','ast']},
};
export const MODEL_VERSION='rolling-baseline-v1-unvalidated';
export function valueOf(row: BoxScore, market: Market): number | null {
  const values=MARKETS[market].keys.map(k=>row.stats[k]);
  return values.every(v=>typeof v==='number' && Number.isFinite(v) && v>=0) ? (values as number[]).reduce((a,b)=>a+b,0) : null;
}
export function gameTime(r:BoxScore) { return r.game.starts_at ?? r.game.provider_date+'T12:00:00Z'; }
export type Filters={window?:number; venue?:'all'|'home'|'away'; opponent?:string; minMinutes?:number; season?:number; from?:string; to?:string; before?:string};
export function qualifying(rows:BoxScore[], market:Market, f:Filters={}) {
 const seen=new Set<string>();
 const sorted=rows.filter(r=>r.game?.status==='final' && r.played && r.minutes!==null && r.minutes>0 && valueOf(r,market)!==null)
 .sort((a,b)=>gameTime(b).localeCompare(gameTime(a)));
 return sorted.filter(r=>{
  if(seen.has(r.game_id))return false; seen.add(r.game_id);
  if(f.before && gameTime(r)>=f.before)return false;
  if(f.venue==='home' && r.team_id!==r.game.home_team_id)return false;
  if(f.venue==='away' && r.team_id!==r.game.away_team_id)return false;
  const opponent=r.team_id===r.game.home_team_id?r.game.away_team_id:r.game.home_team_id;
  return (!f.opponent || opponent===f.opponent) && (r.minutes??0)>=(f.minMinutes??0) && (f.season===undefined || r.game.season===f.season) && (!f.from||manilaDate(gameTime(r))>=f.from) && (!f.to||manilaDate(gameTime(r))<=f.to);
 }).slice(0,f.window || undefined);
}
export function summarize(rows:BoxScore[],market:Market,line:number,side:'over'|'under'='over') {
 const values=rows.map(r=>valueOf(r,market)).filter((v):v is number=>v!==null);
 if(!values.length || !Number.isFinite(line))return {n:0,wins:0,losses:0,pushes:0,rate:null,mean:null,median:null,sd:null,min:null,max:null,interval:null};
 const sorted=[...values].sort((a,b)=>a-b),n=values.length;
 const wins=values.filter(v=>side==='over'?v>line:v<line).length,pushes=values.filter(v=>v===line).length,settled=n-pushes;
 const mean=values.reduce((a,b)=>a+b,0)/n;
 const rate=settled?wins/settled:null;
 return {n,wins,losses:n-wins-pushes,pushes,rate,mean,median: n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,sd:n>1?Math.sqrt(values.reduce((a,v)=>a+(v-mean)**2,0)/(n-1)):0,min:sorted[0],max:sorted[n-1],interval:settled?wilson(wins,settled):null};
}
export function wilson(k:number,n:number) {const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)];}
export function quantile(values:number[],p:number) { const a=[...values].sort((a,b)=>a-b),i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l); }
export function baseline(rows:BoxScore[],market:Market) {
 const q=qualifying(rows,market,{window:20});
 if(q.length<10)return null;
 const values=q.map(r=>valueOf(r,market)!),minutes=q.map(r=>r.minutes!);
 const expectedMinutes=minutes.slice(0,10).reduce((a,b)=>a+b,0)/Math.min(10,minutes.length);
 const perMinute=values.reduce((a,b)=>a+b,0)/minutes.reduce((a,b)=>a+b,0);
 return {mean:expectedMinutes*perMinute,range:[quantile(values,.1),quantile(values,.9)],minutes:expectedMinutes,minutesRange:[quantile(minutes,.1),quantile(minutes,.9)],n:q.length,probability:null,version:MODEL_VERSION};
}
export function implied(odds:number|null){return odds!==null&&Number.isFinite(odds)&&odds>1?1/odds:null;}
export function expectedValue(p:number,odds:number,push=0){if(p<0||push<0||p+push>1||odds<=1)return null;return p*(odds-1)-(1-p-push);}
export function manilaDate(input:Date|string=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(input));}
export function dayBounds(day:string){const start=new Date(day+'T00:00:00+08:00');return {start:start.toISOString(),end:new Date(start.getTime()+86400000).toISOString()};}
export function formatPHT(input:string|null,options:Intl.DateTimeFormatOptions={}) {if(!input)return 'Not yet verified';return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',...options}).format(new Date(input))+' PHT';}
export function freshness(last:string|null,now=Date.now(),maxAge=30*60*1000){return !last?'unavailable':now-new Date(last).getTime()>maxAge?'stale':'current';}
export function correlationWarnings(picks:Selection[]) {
 const out=new Set<string>();
 for(let i=0;i<picks.length;i++)for(let j=i+1;j<picks.length;j++){
 const a=picks[i],b=picks[j]; if(a.game_id!==b.game_id)continue;
 out.add('Selections from the same game share pace, overtime, and game-script risk.');
 if(a.player_id===b.player_id && MARKETS[a.market].keys.some(k=>MARKETS[b.market].keys.includes(k)))out.add('Overlapping markets for the same player are dependent; their probabilities cannot be multiplied.');
 if(a.player_id===b.player_id&&a.market===b.market&&a.side!==b.side){const over=a.side==='over'?a:b,under=a.side==='under'?a:b;if(over.line>=under.line)out.add('Contradiction: these over/under selections cannot both win.');}
 }return [...out];
}
export function backtest(rows:BoxScore[],market:Market) {
 const q=qualifying(rows,market).reverse(),errors:number[]=[];
 for(let i=20;i<q.length;i++){
  const past=q.slice(0,i).filter(r=>gameTime(r)<gameTime(q[i]));const prediction=baseline(past,market);
  if(prediction)errors.push(prediction.mean-valueOf(q[i],market)!);
 }
 if(!errors.length)return null;
 return {n:errors.length,mae:errors.reduce((a,b)=>a+Math.abs(b),0)/errors.length,rmse:Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length),brier:null,logLoss:null,version:MODEL_VERSION};
}
export function teammateSplits(rows:BoxScore[],teammate:BoxScore[],market:Market,line:number,side:'over'|'under'='over'){
 const observed=new Map(teammate.map(r=>[r.game_id,r]));
 const withTeammate:BoxScore[]=[],withoutTeammate:BoxScore[]=[];let unknown=0;
 for(const r of qualifying(rows,market)){
  const t=observed.get(r.game_id);
  if(!t||t.team_id!==r.team_id||t.game.status!=='final'||t.minutes===null){unknown++;continue;}
  if(t.played&&t.minutes>0)withTeammate.push(r);
  else if(!t.played&&t.minutes===0)withoutTeammate.push(r);
  else unknown++;
 }
 return {with:summarize(withTeammate,market,line,side),without:summarize(withoutTeammate,market,line,side),unknown};
}
export function gameEnvironment(games:import('./types').Game[],teamId:string,before:string){
 const previous=games.filter(g=>g.status==='final'&&g.starts_at&&g.starts_at<before&&(g.home_team_id===teamId||g.away_team_id===teamId)).sort((a,b)=>b.starts_at!.localeCompare(a.starts_at!));
 const last10=previous.slice(0,10);const allowed=last10.map(g=>g.home_team_id===teamId?g.away_score:g.home_score).filter((n):n is number=>n!==null);
 const latest=previous[0];
 // Game dates come from the provider's league calendar; PHT is display-only.
 const targetLeagueDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(before));
 const rest=latest?Math.max(0,Math.round((Date.parse(targetLeagueDate)-Date.parse(latest.provider_date))/86400000)-1):null;
 return {allowed:allowed.length?allowed.reduce((a,b)=>a+b,0)/allowed.length:null,n:allowed.length,restDays:rest,lastGame:latest??null,backToBack:rest===0};
}
