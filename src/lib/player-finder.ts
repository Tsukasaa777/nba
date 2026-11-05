import {qualifying,valueOf} from './analytics';
import type {BoxScore,Market,Player} from './types';
export type PlayerPositionFilter='all'|'guard'|'forward'|'center';
export function playerPositionGroup(position:string|null):PlayerPositionFilter{
 const p=(position||'').trim().toUpperCase();
 if(['C','C-F','F-C'].includes(p))return 'center';
 if(['F','SF','PF','F-G'].includes(p))return 'forward';
 if(['G','PG','SG','G-F'].includes(p))return 'guard';
 return 'all';
}
const norm=(s:string)=>s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
export function filterPlayerDirectory(players:Player[],query:string,team:string,position:PlayerPositionFilter):Player[]{
 const terms=norm(query).split(/\s+/).filter(Boolean);
 return players.filter(p=>{
  if(team!=='all'&&p.team_id!==team)return false;
  if(position!=='all'&&playerPositionGroup(p.position)!==position)return false;
  const searchable=norm([p.name,p.team?.name||'',p.team?.abbreviation||'',p.position||''].join(' '));
  return terms.every(t=>searchable.includes(t));
 });
}
/** Observed median + 0.5; suggested comparison only, never a bookmaker-provided line. */
export function suggestedResearchLine(logs:BoxScore[],market:Market):number|null{
 const values=qualifying(logs,market).map(r=>valueOf(r,market)).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)).sort((a,b)=>a-b);
 if(!values.length)return null;
 const middle=values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2;
 return Math.floor(middle)+0.5;
}
