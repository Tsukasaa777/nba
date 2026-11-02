export type InjuryEntry = {
 id: string; teamName: string; player: string; status: string;
 detail: string | null; reportedAt: string | null; returnDate: string | null;
};
export type InjurySnapshot = {
 source: 'ESPN'; retrievedAt: string; publishedAt: string | null;
 reports: InjuryEntry[]; coverage: 'league-wide'; note: string;
};
const known = new Set(['Out','Questionable','Probable','Doubtful','Day-To-Day','Suspension','Injured Reserve']);
const clean = (v:unknown,limit=160) => typeof v==='string'?v.trim().slice(0,limit):'';
const iso = (value:unknown) => typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
export function normalizeInjuryFeed(payload:any,retrievedAt:string):InjurySnapshot {
 if(!payload || payload.status!=='success'||!Array.isArray(payload.injuries))
  throw new Error('No validated NBA injury list');
 const reports:InjuryEntry[]=[];
 for(const team of payload.injuries){
  const teamName=clean(team?.displayName,90);
  if(!teamName||!Array.isArray(team?.injuries))continue;
  for(const raw of team.injuries){
   const player=clean(raw?.athlete?.displayName,100);
   const statusText=clean(raw?.status,50);
   if(!player||!statusText)continue;
   const status=known.has(statusText)?statusText:statusText;
   const parts=[clean(raw?.details?.side,40),clean(raw?.details?.type,70),
     clean(raw?.details?.detail,90)].filter(v=>v&&v!=='Not Specified');
   reports.push({
    id:'espn:'+clean(raw?.id,30)+':'+teamName,teamName,player,status,
    detail:parts.length?parts.join(' · '):null,
    reportedAt:iso(raw?.date),
    returnDate:/^\d{4}-\d{2}-\d{2}$/.test(raw?.details?.returnDate||'')?raw.details.returnDate:null,
   });
  }
 }
 if(payload.injuries.length>0 && !payload.injuries.some((x:any)=>typeof x?.displayName==='string'))
  throw new Error('NBA injury feed missing team identifiers');
 return {source:'ESPN',retrievedAt,publishedAt:iso(payload.timestamp),
  reports,coverage:'league-wide',
  note:'League-wide ESPN availability feed, not a confirmed injury designation for the selected matchup. Verify with the official NBA game-day report.'};
}
export function injuryForTeam(entries:InjuryEntry[],teamName:string):InjuryEntry[]{
 const name=teamName.trim().toLowerCase();
 return entries.filter(e=>e.teamName.trim().toLowerCase()===name).sort((a,b)=>{
  const priority=(s:string)=>s.toLowerCase()==='out'?0:s.toLowerCase()==='doubtful'?1:s.toLowerCase()==='questionable'?2:3;
  return priority(a.status)-priority(b.status)||a.player.localeCompare(b.player);
 });
}
