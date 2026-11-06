import type {BoxScore,Player} from './types';
import {espnAbbreviation} from './player-profile';

export type EarlyGameRow={
 game_id:string;source:'ESPN play-by-play';q1_pts:number;q1_ast:number;q1_reb:number;
 first_score:number;first_scorer_name:string|null;
};
export function canonicalTeam(abbreviation:string):string|null{
 return espnAbbreviation(abbreviation);
}
export function findScheduleEventId(schedule:any,row:BoxScore):string|null{
 const start=Date.parse(row.game?.starts_at||'');
 if(!Number.isFinite(start)||!Array.isArray(schedule?.events))return null;
 const home=canonicalTeam(row.game.home_team?.abbreviation||'');
 const away=canonicalTeam(row.game.away_team?.abbreviation||'');
 if(!home||!away)return null;
 const matches=schedule.events.filter((e:any)=>{
  const date=Date.parse(e?.date||'');
  if(!Number.isFinite(date)||Math.abs(date-start)>20*60_000)return false;
  const opponents=e?.competitions?.[0]?.competitors;
  if(!Array.isArray(opponents))return false;
  const h=opponents.find((t:any)=>t.homeAway==='home');
  const a=opponents.find((t:any)=>t.homeAway==='away');
  return canonicalTeam(String(h?.team?.abbreviation||''))===home&&canonicalTeam(String(a?.team?.abbreviation||''))===away;
 });
 return matches.length===1&&/^\d{6,15}$/.test(String(matches[0].id))?String(matches[0].id):null;
}
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.'’]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
function matchPlayerAthlete(summary:any,player:Player,row:BoxScore):string|null{
 const players=summary?.boxscore?.players;
 if(!Array.isArray(players))return null;
 const abbr=row.team_id===row.game.home_team_id?
  row.game.home_team?.abbreviation:row.game.away_team?.abbreviation;
 const team=canonicalTeam(abbr||'');
 const candidates=players
  .filter((p:any)=>canonicalTeam(String(p?.team?.abbreviation||''))===team)
  .flatMap((p:any)=>Array.isArray(p?.statistics)?p.statistics.flatMap((st:any)=>st.athletes||[]):[])
  .filter((a:any)=>typeof a?.athlete?.displayName==='string'&&normalized(a.athlete.displayName)===normalized(player.name)
   &&!a.didNotPlay&&a.athlete?.id);
 return candidates.length===1?String(candidates[0].athlete.id):null;
}
const participantId=(p:any,index:number):string|null=>{
 const id=p?.participants?.[index]?.athlete?.id;
 return typeof id==='string'||typeof id==='number'?String(id):null;
};
export function extractEarlyGame(summary:any,player:Player,row:BoxScore):EarlyGameRow|null{
 if(summary?.header?.competitions?.[0]?.status?.type?.completed!==true)return null;
 const athleteId=matchPlayerAthlete(summary,player,row);
 if(!athleteId||!Array.isArray(summary.plays))return null;
 const q1=summary.plays.filter((p:any)=>Number(p?.period?.number)===1)
  .sort((a:any,b:any)=>Number(a?.sequenceNumber||0)-Number(b?.sequenceNumber||0));
 if(!q1.some((p:any)=>/end period/i.test(String(p?.type?.text||''))))return null;
 const first=q1.find((p:any)=>p.scoringPlay===true&&Number(p.scoreValue)>0);
 if(!first||!participantId(first,0))return null;
 // Verify complete 1Q play-by-play against official published quarter totals.
 const competitors=summary?.header?.competitions?.[0]?.competitors;
 if(!Array.isArray(competitors)||competitors.length!==2)return null;
 const expected=competitors.map((t:any)=>Number(t?.linescores?.[0]?.displayValue));
 const total=q1.filter((p:any)=>p.scoringPlay===true).reduce((n:number,p:any)=>n+Number(p.scoreValue||0),0);
 if(expected.some((n:number)=>!Number.isInteger(n)||n<0)||expected[0]+expected[1]!==total)return null;
 // Reject period feeds lacking credited IDs for scoring plays, which otherwise
 // undercount player Q1 points while displaying a deceptively valid sample.
 if(q1.some((p:any)=>p.scoringPlay===true&&Number(p.scoreValue)>0&&!participantId(p,0)))return null;
 let pts=0,ast=0,reb=0;
 for(const p of q1){
  const id=participantId(p,0);
  if(p.scoringPlay===true&&id===athleteId)pts+=Number(p.scoreValue||0);
  const description=String(p.text||'');
  if(p.scoringPlay===true&&Number(p.scoreValue)>=2&&
   /\(([^)]+)\s+assists?\)/i.test(description)&&participantId(p,1)===athleteId)ast++;
  if(/^(offensive|defensive) rebound$/i.test(String(p?.type?.text||''))&&id===athleteId)reb++;
 }
 return {game_id:row.game_id,source:'ESPN play-by-play',q1_pts:pts,q1_ast:ast,q1_reb:reb,
  first_score:participantId(first,0)===athleteId?1:0,
  first_scorer_name:String(first.text||'').split(/\s+makes?\b/i)[0]||null};
}
