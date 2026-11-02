import {roleGroup} from './role-context';
export type PositionBox={game_id:string;minutes:number|null;played:boolean;team_id:string;stats:Record<string,number|null>;player?:{position:string|null}|null};
export type AllowedProfile={role:string;games:number;playerGames:number;pts:number;reb:number;ast:number;min:number};
/** Observed per-player, per-game production, not defensive efficiency or assignment tracking. */
export function observedPositionAllowances(rows:PositionBox[],playerPosition:string|null,againstTeamId:string):AllowedProfile|null{
 const role=roleGroup(playerPosition);
 if(role==='unknown')return null;
 const observations=rows.filter(r=>r.team_id!==againstTeamId&&r.played&&r.minutes!=null&&r.minutes>0&&
  roleGroup(r.player?.position)===role&&
  ['pts','reb','ast'].every(k=>typeof r.stats?.[k]==='number'&&Number.isFinite(r.stats[k])&&r.stats[k]!>=0));
 const games=new Set(observations.map(r=>r.game_id));
 if(observations.length<8||games.size<3)return null;
 const n=observations.length;
 const avg=(k:string)=>observations.reduce((sum,r)=>sum+r.stats[k]!,0)/n;
 return {role,games:games.size,playerGames:n,pts:avg('pts'),reb:avg('reb'),ast:avg('ast'),min:observations.reduce((sum,r)=>sum+r.minutes!,0)/n};
}
