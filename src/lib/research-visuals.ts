import type {Game,Player} from './types';
import type {RecentBox} from './role-context';
import {roleGroup} from './role-context';
import type {PositionBox,AllowedProfile} from './position-allowances';
import {observedPositionAllowances} from './position-allowances';

export type RotationPlayer={id:string;name:string;position:string|null;teamId:string;sample:number;minutes:number;minMinutes:number;maxMinutes:number;points:number;assists:number;rebounds:number};
export type SimilarResult={playerId:string;name:string;position:string|null;date:string;gameId:string;minutes:number;pts:number|null;reb:number|null;ast:number|null;fg3m:number|null};
export type HeatmapCell={role:'guard'|'wing'|'big';profile:AllowedProfile|null};
const stat=(s:Record<string,number|null>,k:string)=>typeof s?.[k]==='number'&&Number.isFinite(s[k])?s[k]!:null;

export function rotationFromRecords(players:Player[],records:RecentBox[],teamId:string):RotationPlayer[]{
 return players.filter(p=>p.team_id===teamId).map(p=>{
  const logs=records.filter(r=>r.player_id===p.id&&r.team_id===teamId&&r.played&&typeof r.minutes==='number'&&r.minutes>0)
   .sort((a,b)=>b.played_at.localeCompare(a.played_at)).slice(0,10);
  const n=logs.length;
  if(!n)return null;
  const avg=(fn:(r:RecentBox)=>number)=>logs.reduce((sum,r)=>sum+fn(r),0)/n;
  return {id:p.id,name:p.name,position:p.position,teamId,sample:n,
   minutes:avg(r=>r.minutes||0),minMinutes:Math.min(...logs.map(r=>r.minutes!)),maxMinutes:Math.max(...logs.map(r=>r.minutes!)),
   points:avg(r=>stat(r.stats,'pts')??0),assists:avg(r=>stat(r.stats,'ast')??0),
   rebounds:avg(r=>stat(r.stats,'reb')??0)};
 }).filter((r):r is RotationPlayer=>r!==null).sort((a,b)=>b.minutes-a.minutes).slice(0,16);
}

type ComparableRow=PositionBox & {played_at?:string;player?:{id?:string;name?:string;position:string|null}|null};
export function opponentComparison(rows:ComparableRow[],opponent:string,playerPosition:string|null,games:Game[]):{
 similar:SimilarResult[];matrix:HeatmapCell[]
}{
 const roles=['guard','wing','big'] as const;
 const matrix=roles.map(role=>({role,profile:observedPositionAllowances(rows,role==='guard'?'G':role==='wing'?'F':'C',opponent)}));
 const target=roleGroup(playerPosition);
 const dates=new Map(games.map(g=>[g.id,g.starts_at||g.provider_date]));
 const similar=target==='unknown'?[]:rows.filter(r=>r.team_id!==opponent&&r.played&&
  r.player?.name&&r.player?.id&&roleGroup(r.player.position)===target&&
  r.minutes!==null&&r.minutes!==undefined&&r.minutes>0&&dates.has(r.game_id))
 .sort((a,b)=>String(dates.get(b.game_id)).localeCompare(String(dates.get(a.game_id))))
 .slice(0,12).map(r=>({
  playerId:String(r.player!.id),name:String(r.player!.name),position:r.player!.position,
  gameId:r.game_id,date:dates.get(r.game_id)!,minutes:r.minutes!,
  pts:stat(r.stats,'pts'),reb:stat(r.stats,'reb'),ast:stat(r.stats,'ast'),fg3m:stat(r.stats,'fg3m')
 }));
 return {similar,matrix};
}
