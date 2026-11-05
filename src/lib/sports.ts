import { dayBounds } from './analytics';

export type ExtraSport = 'wnba'|'mlb';
export type SportsTeam={name:string;abbreviation:string;score:number|null};
export type SportsGame={id:string;sport:ExtraSport;starts_at:string;status:'scheduled'|'live'|'final'|'postponed'|'canceled'|'unknown';away:SportsTeam;home:SportsTeam;venue:string|null;source:string};
export type SportBoxRow={playerId:string;name:string;position:string|null;team:string;category:'batting'|'pitching'|'basketball';metrics:Record<string,string|number|null>};
export type SportsSlate={sport:ExtraSport;date:string;games:SportsGame[];source:string;retrievedAt:string};
const numeric=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const text=(v:unknown)=>typeof v==='string'?v:'';
const safeDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'));
export function assertSportsDate(date:string){
 if(!safeDate(date)||date<'2024-01-01'||date>'2029-12-31')throw new Error('Invalid sports date');
 return date;
}
export function adjacentUtcDates(date:string){
 assertSportsDate(date);
 const yesterday=new Date(Date.parse(date+'T12:00:00Z')-86_400_000).toISOString().slice(0,10);
 return [yesterday,date];
}
function gameStatus(s:unknown):SportsGame['status']{
 const v=text(s).toLowerCase();
 if(/final|complete/.test(v))return 'final';
 if(/in progress|live|halftime/.test(v))return 'live';
 if(/postpon/.test(v))return 'postponed';
 if(/cancel/.test(v))return 'canceled';
 if(/pre|sched/.test(v))return 'scheduled';
 return 'unknown';
}
export function normalizeWnbaScoreboard(payload:any):SportsGame[]{
 if(!payload||!Array.isArray(payload.events))throw new Error('Invalid WNBA scoreboard response');
 return payload.events.flatMap((event:any)=>{
  const competition=event?.competitions?.[0];
  const participants=competition?.competitors;
  const home=Array.isArray(participants)?participants.find((x:any)=>x.homeAway==='home'):null;
  const away=Array.isArray(participants)?participants.find((x:any)=>x.homeAway==='away'):null;
  if(!home?.team?.displayName||!away?.team?.displayName||!event?.id||!Number.isFinite(Date.parse(event.date)))return [];
  const team=(t:any):SportsTeam=>({name:text(t.team.displayName),abbreviation:text(t.team.abbreviation),
   score:numeric(t.score)});
  const status=gameStatus(event.status?.type?.name||event.status?.type?.description||'');
  return [{id:'wnba:'+String(event.id),sport:'wnba' as const,starts_at:new Date(event.date).toISOString(),
   status,home:team(home),away:team(away),venue:text(competition.venue?.fullName)||null,
   source:'ESPN (unofficial public feed)'}];
 });
}
export function normalizeMlbSchedule(payload:any):SportsGame[]{
 if(!payload||!Array.isArray(payload.dates))throw new Error('Invalid MLB schedule response');
 return payload.dates.flatMap((date:any)=>Array.isArray(date.games)?date.games.flatMap((g:any)=>{
  const home=g.teams?.home,away=g.teams?.away;
  if(!g.gamePk||!home?.team?.name||!away?.team?.name||!Number.isFinite(Date.parse(g.gameDate)))return [];
  const team=(t:any):SportsTeam=>({name:text(t.team.name),abbreviation:'',score:numeric(t.score)});
  const status=gameStatus(g.status?.abstractGameState||g.status?.detailedState||'');
  return [{id:'mlb:'+String(g.gamePk),sport:'mlb' as const,starts_at:new Date(g.gameDate).toISOString(),
   status,home:team(home),away:team(away),venue:text(g.venue?.name)||null,
   source:'MLB Stats API'}];
 }):[]);
}
function withinPht(g:SportsGame,date:string){
 const {start,end}=dayBounds(date);
 return g.starts_at>=start&&g.starts_at<end;
}
export function filterSportsSlate(games:SportsGame[],date:string){
 const unique=new Map<string,SportsGame>();
 for(const g of games)if(withinPht(g,date))unique.set(g.id,g);
 return [...unique.values()].sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
}
function val(stats:any,keys:string[]):string|number|null{
 for(const key of keys)if(stats?.[key]!==undefined&&stats?.[key]!==null)return stats[key];
 return null;
}
export function normalizeWnbaBoxscore(payload:any):SportBoxRow[]{
 const teams=payload?.boxscore?.players;
 if(!Array.isArray(teams))throw new Error('WNBA box score unavailable');
 const rows:SportBoxRow[]=[];
 for(const t of teams){
  const team=text(t.team?.displayName);
  for(const group of t.statistics||[]){
   const keys=group.names||[];
   for(const entry of group.athletes||[]){
    const a=entry.athlete;
    if(!a?.id||!a.displayName||entry.didNotPlay===true)continue;
    const lookup=(key:string):string|number|null=>{
     const i=keys.indexOf(key);
     return i>=0?entry.stats?.[i]??null:null;
    };
    rows.push({playerId:'wnba:'+a.id,name:a.displayName,team,position:text(a.position?.abbreviation)||null,
     category:'basketball',metrics:{
      MIN:lookup('MIN'),PTS:lookup('PTS'),REB:lookup('REB'),AST:lookup('AST'),
      '3PM':lookup('3PT'),STL:lookup('STL'),BLK:lookup('BLK')}});
   }
  }
 }
 return rows;
}
export function normalizeMlbBoxscore(payload:any):SportBoxRow[]{
 if(!payload?.teams?.away?.players||!payload?.teams?.home?.players)throw new Error('MLB box score unavailable');
 const rows:SportBoxRow[]=[];
 for(const side of ['away','home'] as const){
  const t=payload.teams[side];
  const team=text(t.team?.name);
  for(const p of Object.values(t.players||{}) as any[]){
   if(!p?.person?.id||!p?.person?.fullName)continue;
   const base={playerId:'mlb:'+p.person.id,name:p.person.fullName,
     team,position:text(p.position?.abbreviation)||null};
   const batting=p.stats?.batting||{},pitching=p.stats?.pitching||{};
   if(Object.keys(batting).length){
    const hits=numeric(batting.hits),doubles=numeric(batting.doubles),triples=numeric(batting.triples),hr=numeric(batting.homeRuns);
    const totalBases=[hits,doubles,triples,hr].every(x=>x!==null)
     ?hits!+doubles!+2*triples!+3*hr!:null;
    rows.push({...base,category:'batting',metrics:{AB:val(batting,['atBats']),H:val(batting,['hits']),
     TB:totalBases,R:val(batting,['runs']),RBI:val(batting,['rbi']),HR:val(batting,['homeRuns']),BB:val(batting,['baseOnBalls'])}});
   }
   if(Object.keys(pitching).length){
    rows.push({...base,category:'pitching',metrics:{IP:val(pitching,['inningsPitched']),SO:val(pitching,['strikeOuts']),
     ER:val(pitching,['earnedRuns']),H:val(pitching,['hits']),BB:val(pitching,['baseOnBalls'])}});
   }
  }
 }
 return rows;
}
