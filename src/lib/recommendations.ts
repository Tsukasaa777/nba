import type {Game,Player,Injury,StatKey,Market} from './types';
import {MARKETS} from './analytics';

export const RESEARCH_MARKETS=['pts','reb','ast','fg3m','pra','fg3a','fga','fta','stl','blk'] as const satisfies readonly Market[];
export type RankedMarket=(typeof RESEARCH_MARKETS)[number];
export type HistoricalStat={
  game_id:string;player_id:string;team_id:string;played_at:string;
  played:boolean;minutes:number|null;stats:Partial<Record<StatKey,number|null>>;
  game?:{status?:string;starts_at?:string|null;home_team_id?:string;away_team_id?:string}|null;
};
export type Candidate={
  id:string;gameId:string;playerId:string;playerName:string;position:string|null;
  teamId:string;team:string;opponent:string;market:RankedMarket;marketName:string;
  side:'over'|'under';referenceLine:number;sample:number;
  last5Hit:number;last5N:number;last10Hit:number;last10N:number;
  average:number;recentAverage:number;averageMinutes:number;opponentSamples:number;
  rankScore:number;reasons:string[];caveats:string[];
};
export type MatchupRecommendations={
  gameId:string;away:string;home:string;startsAt:string|null;
  candidates:Candidate[];eligiblePlayers:number;
};
export type RankedSlate={date:string;matches:MatchupRecommendations[];totalCandidates:number;scannedPlayers:number;partial:boolean};

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const average=(vs:number[])=>vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:0;
const median=(vs:number[])=>{
 const sorted=[...vs].sort((a,b)=>a-b),n=sorted.length;
 return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;
};
const p1=(n:number)=>Math.round(n*10)/10;
const filterGames=(r:HistoricalStat,player:Player,cutoff:string)=>{
 const starts=r.game?.starts_at||r.played_at;
 return r.team_id===player.team_id&&r.game?.status==='final'&&r.played===true&&
  finite(r.minutes)&&r.minutes>=10&&Number.isFinite(Date.parse(starts))&&
  Date.parse(starts)<Date.parse(cutoff);
};
const pointValue=(r:HistoricalStat,market:RankedMarket):number|null=>{
 const stats=MARKETS[market].keys.map(k=>r.stats[k]);
 return stats.every(finite)?stats.reduce<number>((n,v)=>n+Number(v),0):null;
};
function injuryBlock(playerId:string,injuries:Injury[],fresh:boolean):boolean{
 if(!fresh)return false;
 return injuries.some(i=>i.player_id===playerId&&/\b(out|doubtful|questionable|suspended|inactive)\b/i.test(i.status));
}
function opponentFor(game:Game,teamId:string){return game.home_team_id===teamId?game.away_team:game.home_team;}
function evaluatePlayer(game:Game,player:Player,observations:HistoricalStat[],injuries:Injury[],injuryFeedFresh:boolean):Candidate[]{
 if(!game.starts_at||!player.team_id||injuryBlock(player.id,injuries,injuryFeedFresh))return [];
 const cutoff=Date.parse(game.starts_at);
 const rows=observations.filter(r=>r.player_id===player.id&&filterGames(r,player,game.starts_at!))
  .sort((a,b)=>Date.parse(b.played_at)-Date.parse(a.played_at));
 if(rows.length<6)return [];
 const minutes=rows.slice(0,10).map(r=>r.minutes!).filter(finite);
 const averageMinutes=average(minutes);
 if(averageMinutes<17)return [];
 const newest=Date.parse(rows[0].played_at);
 if(!Number.isFinite(newest)||cutoff-newest>21*86400000)return [];
 const opponent=opponentFor(game,player.team_id);
 const opponentSamples=rows.slice(0,25).filter(r=>{
  const o=r.game?.home_team_id===r.team_id?r.game?.away_team_id:r.game?.home_team_id;
  return o===opponent.id;
 }).length;
 const results:Candidate[]=[];
 for(const market of RESEARCH_MARKETS){
  const valid=rows.map(r=>({row:r,value:pointValue(r,market)}))
   .filter((x):x is {row:HistoricalStat;value:number}=>x.value!==null);
  if(valid.length<6)continue;
  const values=valid.slice(0,10).map(x=>x.value);
  const latest=values.slice(0,5),referenceLine=Math.floor(median(values))+.5;
  // Reference threshold is NOT a bookmaker line and is never tuned to maximize hit rate.
  const over10=values.filter(v=>v>referenceLine).length,under10=values.filter(v=>v<referenceLine).length;
  const side:Candidate['side']=over10>=under10?'over':'under';
  const wins=(vs:number[])=>vs.filter(v=>side==='over'?v>referenceLine:v<referenceLine).length;
  const hit5=wins(latest),hit10=wins(values);
  if(hit5<3||hit10<Math.ceil(values.length*.55))continue;
  const std=minutes.length>1?Math.sqrt(minutes.reduce((s,v)=>s+(v-averageMinutes)**2,0)/minutes.length):12;
  const minsStability=Math.max(.15,1-Math.min(std/averageMinutes,1));
  const coverage=Math.min(1,valid.length/10);
  const score=Math.round(100*(.48*(hit5/latest.length)+.28*(hit10/values.length)+.13*minsStability+.11*coverage));
  if(score<61)continue;
  const avg=average(values),last5Avg=average(latest);
  const direction=side==='over'?'above':'below';
  const recentDirection=side==='over'?(last5Avg>=avg?'up':'flat'):(last5Avg<=avg?'down':'flat');
  const reasons=[
   'L5: '+hit5+'/'+latest.length+' '+direction+' '+referenceLine+' '+MARKETS[market].short,
   'L'+values.length+': '+hit10+'/'+values.length+' '+direction+' reference',
   'Average '+p1(last5Avg)+' (L5) vs '+p1(avg)+' (L'+values.length+')'
  ];
  if(minutes.length>=5)reasons.push('Minutes: '+p1(averageMinutes)+' average (last '+minutes.length+' games)');
  if(opponentSamples>=2)reasons.push(opponentSamples+' previous games vs '+opponent.abbreviation+' in imported history');
  const caveats=['Reference line is historical, not a verified sportsbook offer'];
  if(!injuryFeedFresh)caveats.push('Injury availability not verified');
  if(recentDirection==='flat')caveats.push('No strong recent directional trend');
  results.push({
    id:[game.id,player.id,market,side].join(':'),gameId:game.id,playerId:player.id,playerName:player.name,position:player.position,
    teamId:player.team_id,team:player.team?.abbreviation||'NBA',opponent:opponent.abbreviation,
    market,marketName:MARKETS[market].label,side,referenceLine,
    sample:values.length,last5Hit:hit5,last5N:latest.length,last10Hit:hit10,last10N:values.length,
    average:p1(avg),recentAverage:p1(last5Avg),averageMinutes:p1(averageMinutes),opponentSamples,
    rankScore:score,reasons,caveats
  });
 }
 return results;
}
/** Deterministic experimental screening, NOT a calibrated prediction or estimated betting edge. */
export function rankNbaSlate(args:{
 date:string;games:Game[];players:Player[];logs:HistoricalStat[];injuries:Injury[];
 injuryFeedFresh:boolean;partial?:boolean;perGame?:number
}):RankedSlate{
 const {date,games,players,logs,injuries,injuryFeedFresh,partial=false}=args;
 const perGame=Math.max(1,Math.min(5,args.perGame??3));
 const byPlayer=new Map<string,HistoricalStat[]>();
 for(const r of logs){if(!byPlayer.has(r.player_id))byPlayer.set(r.player_id,[]);byPlayer.get(r.player_id)!.push(r);}
 const activeGames=games.filter(g=>(g.status==='scheduled'||g.status==='unknown')&&g.starts_at)
  .sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at)));
 let scanned=0;
 const matches=activeGames.map(game=>{
  const eligible=players.filter(p=>p.team_id===game.home_team_id||p.team_id===game.away_team_id);
  scanned+=eligible.length;
  const all=eligible.flatMap(p=>evaluatePlayer(game,p,byPlayer.get(p.id)||[],injuries,injuryFeedFresh));
  const seenPlayers=new Set<string>(),chosen:Candidate[]=[];
  for(const c of all.sort((a,b)=>b.rankScore-a.rankScore||b.last10N-a.last10N)){
   if(seenPlayers.has(c.playerId))continue;
   chosen.push(c);seenPlayers.add(c.playerId);
   if(chosen.length>=perGame)break;
  }
  return {gameId:game.id,away:game.away_team.abbreviation,home:game.home_team.abbreviation,
   startsAt:game.starts_at,candidates:chosen,eligiblePlayers:eligible.length};
 });
 return {date,matches,totalCandidates:matches.reduce((sum,m)=>sum+m.candidates.length,0),scannedPlayers:scanned,partial};
}
