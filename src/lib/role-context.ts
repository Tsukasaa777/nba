import type {Game,Player} from './types';
export type RecentBox = {player_id:string;team_id:string;minutes:number|null;played:boolean;stats:Record<string,number|null>;played_at:string};
export type Candidate = {id:string;name:string;position:string|null;games:number;avgMinutes:number;pts:number;ast:number;reb:number;match:'similar'|'switch';note:string};
export type RoleContext = {playerName:string;position:string|null;opponent:string;defenders:Candidate[];teammates:Candidate[];coverage:{recentRecords:number;description:string};positionAllowed?:import('./position-allowances').AllowedProfile|null};
export const roleGroup=(s:string|null|undefined):'guard'|'wing'|'big'|'unknown'=> {
 const p=(s||'').toUpperCase();
 if(p==='C'||p==='PF'||p==='F-C'||p==='C-F')return 'big';
 if(p==='F'||p==='SF'||p==='G-F'||p==='F-G')return 'wing';
 if(p==='G'||p==='PG'||p==='SG')return 'guard';
 return 'unknown';
};
export function buildRoleContext(game:Game,star:Player,roster:Player[],rows:RecentBox[]):RoleContext{
 const own=star.team_id;
 const opp=own===game.home_team_id?game.away_team_id:game.home_team_id;
 const group=roleGroup(star.position);
 const now=Date.parse(game.starts_at||'')||Date.now();
 const people=roster.filter(p=>p.team_id===own||p.team_id===opp);
 const profiles=people.map(p=>{
  const observed=rows.filter(r=>r.player_id===p.id&&r.team_id===p.team_id&&r.played&&typeof r.minutes==='number'&&r.minutes>0&&Date.parse(r.played_at)<now).sort((a,b)=>b.played_at.localeCompare(a.played_at)).slice(0,10);
  const n=observed.length;
  const avg=(key:string)=>n?observed.reduce((s,r)=>s+(typeof r.stats?.[key]==='number'?r.stats[key]!:0),0)/n:0;
  const mins=n?observed.reduce((s,r)=>s+(r.minutes||0),0)/n:0;
  return {id:p.id,name:p.name,position:p.position,games:n,avgMinutes:mins,pts:avg('pts'),ast:avg('ast'),reb:avg('reb'),group:roleGroup(p.position),teamId:p.team_id};
 });
 const defenderPool=profiles.filter(p=>p.teamId===opp&&p.games>=2&&p.avgMinutes>=12);
 const ranked=defenderPool.map(p=>{
  // A minutes-weighted position-fit shortlist, NOT a defender-quality ranking.
  const match=p.group===group?'similar' as const:'switch' as const;
  const score=(p.group===group?100:p.group==='wing'?60:15)+p.avgMinutes;
  const note=p.group===group?
   'Position-compatible opponent with recent court time. May contest touches if assigned; primary assignment and defensive skill are unverified.':
   'Possible switch/help matchup based on role and minutes. Direct possessions and defensive impact are unverified.';
  return {...p,match,note,score};
 }).filter(p=>p.group===group||p.group==='wing').sort((a,b)=>b.score-a.score||b.games-a.games).slice(0,3);
 const teammates=profiles.filter(p=>p.teamId===own&&p.id!==star.id&&p.games>=2&&p.avgMinutes>=12)
  .sort((a,b)=>(b.pts+b.ast*1.3+b.avgMinutes*.15)-(a.pts+a.ast*1.3+a.avgMinutes*.15)).slice(0,4);
 return {playerName:star.name,position:star.position,opponent:opp,
  defenders:ranked.map(({teamId,group,score,...p})=>p),
  teammates:teammates.map(({teamId,group,...p})=>({...p,match:'similar' as const,note:'Observed teammate production, not proof of future usage change.'})),
  coverage:{recentRecords:rows.length,description:'Recent final-game scoring, minutes and roles. No tracking or confirmed defensive assignments.'}};
}
