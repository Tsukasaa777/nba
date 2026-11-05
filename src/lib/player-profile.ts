import type {Player} from './types';

export type UpcomingGame={
 id:string;startsAt:string;opponent:string;opponentAbbreviation:string;venue:'Home'|'Away'|'TBD';
};
export type PublicPlayerProfile={
 playerId:string;headshot:string|null;jersey:string|null;position:string|null;
 team:string;upcoming:UpcomingGame[];sources:{portrait:'ESPN roster'|null;schedule:'ESPN team schedule'|null};
};
const teamAbbr:Record<string,string>={
 GS:'gs',GSW:'gs',NY:'ny',NYK:'ny',SA:'sa',SAS:'sa',
 NO:'no',NOP:'no',PHO:'phx',PHX:'phx',UTAH:'utah',UTA:'utah',BRK:'bkn',BKN:'bkn',WSH:'wsh'
};
export function espnAbbreviation(abbreviation:string){
 const code=abbreviation.toUpperCase().trim();
 if(!/^[A-Z]{2,5}$/.test(code))return null;
 return teamAbbr[code]||code.toLowerCase();
}
const clean=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.'’]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
export function findVerifiedRosterPlayer(payload:any,playerName:string):{
 headshot:string|null;jersey:string|null;position:string|null
}|null {
 const raw=payload?.athletes;
 if(!Array.isArray(raw))return null;
 // ESPN sometimes returns grouped athletes. Do not match solely by last name.
 const athletes=raw.flatMap((a:any)=>Array.isArray(a?.items)?a.items:[a]);
 const matches=athletes.filter((a:any)=>typeof a?.displayName==='string'&&clean(a.displayName)===clean(playerName));
 if(matches.length!==1)return null;
 const item=matches[0];
 const url=typeof item.headshot?.href==='string'?item.headshot.href:'';
 return {
  headshot:/^https:\/\/a\.espncdn\.com\/i\/headshots\/nba\/players\/(?:full\/)?\d+\.(png|jpg|jpeg|webp)$/.test(url)?url:null,
  jersey:typeof item.jersey==='string'&&/^\d{1,3}$/.test(item.jersey)?item.jersey:null,
  position:typeof item.position?.abbreviation==='string'?item.position.abbreviation:null
 };
}
export function extractUpcomingTeamGames(payload:any,team:Player['team'],nowISO:string):UpcomingGame[]{
 if(!team?.abbreviation||!Array.isArray(payload?.events))return [];
 const teamName=clean(team.name), abbreviation=team.abbreviation.toUpperCase();
 const isOwn=(t:any)=>{
  const code=String(t?.team?.abbreviation||'').toUpperCase();
  return clean(String(t?.team?.displayName||''))===teamName||
    code===abbreviation||espnAbbreviation(code)===espnAbbreviation(abbreviation);
 };
 const now=Date.parse(nowISO);
 return payload.events.flatMap((event:any)=>{
  const time=Date.parse(event?.date||'');
  if(!Number.isFinite(time)||time<now||!event?.id)return [];
  const comp=event?.competitions?.[0];
  const teams=comp?.competitors;
  if(!Array.isArray(teams)||teams.length!==2)return [];
  const own=teams.find(isOwn);
  if(!own)return [];
  const other=teams.find((t:any)=>t!==own);
  if(!other?.team?.displayName)return [];
  const venue=own.homeAway==='home'?'Home':own.homeAway==='away'?'Away':'TBD';
  return [{
   id:String(event.id),startsAt:new Date(time).toISOString(),opponent:String(other.team.displayName),
   opponentAbbreviation:String(other.team.abbreviation||''),venue:venue as UpcomingGame['venue']
  }];
 }).sort((a:UpcomingGame,b:UpcomingGame)=>a.startsAt.localeCompare(b.startsAt)).slice(0,6);
}
