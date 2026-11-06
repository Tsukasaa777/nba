import {NextResponse} from 'next/server';
import {loadPlayerLogs} from '@/lib/data';
import {publicDatabase} from '@/lib/supabase';
import {isSupportedNbaId} from '@/lib/provider-id';
import {findScheduleEventId,extractEarlyGame} from '@/lib/early-game';
import {espnAbbreviation} from '@/lib/player-profile';
import type {Player,BoxScore} from '@/lib/types';
export const runtime='nodejs';
async function espn(url:string):Promise<any>{
 const r=await fetch(url,{headers:{Accept:'application/json'},next:{revalidate:86400},
  signal:AbortSignal.timeout(11000)});
 if(!r.ok)throw new Error('ESPN event feed unavailable');
 return r.json();
}
export async function GET(_req:Request,ctx:{params:Promise<{id:string}>}){
 const {id}=await ctx.params;
 if(!isSupportedNbaId(id))return NextResponse.json({error:'Invalid player ID'},{status:400});
 const db=publicDatabase();
 if(!db)return NextResponse.json({error:'NBA database unavailable'},{status:503});
 const {data,error}=await db.from('players').select('id,name,position,team_id,team:teams!players_team_id_fkey(id,name,abbreviation)')
  .eq('id',id).maybeSingle();
 if(error||!data)return NextResponse.json({error:'Player not found'},{status:404});
 const player=data as unknown as Player;
 const current=player.team_id;
 const recent=(await loadPlayerLogs(id)).filter(r=>r.played&&r.team_id===current&&r.game?.status==='final').slice(0,6);
 const abbr=espnAbbreviation(player.team?.abbreviation||'');
 if(!abbr||!recent.length)return NextResponse.json({rows:[],source:'ESPN play-by-play',coverage:'No matching verified recent games'});
 const seasons=[...new Set(recent.map(r=>r.game.season+1))].slice(0,2);
 const schedules=await Promise.allSettled(seasons.map(async season=>{
  return espn('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/'+abbr+'/schedule?season='+season);
 }));
 const events=new Map<string,BoxScore>();
 for(const [i,attempt] of schedules.entries()){
  if(attempt.status!=='fulfilled')continue;
  for(const row of recent.filter(r=>r.game.season+1===seasons[i])){
   const espnId=findScheduleEventId(attempt.value,row);
   if(espnId&&!events.has(espnId))events.set(espnId,row);
  }
 }
 // Limit summary requests; all requests are server-side and cached.
 const results=await Promise.allSettled([...events.entries()].slice(0,6).map(async ([eventId,row])=>{
  const payload=await espn('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+eventId);
  return extractEarlyGame(payload,player,row);
 }));
 const rows=results.flatMap(x=>x.status==='fulfilled'&&x.value?[x.value]:[]);
 return NextResponse.json({
  rows,source:'ESPN play-by-play',
  coverage:rows.length+' of '+recent.length+' recent player games verified',
  definition:'First scorer means first points scored, including free throws; 1st-quarter stats are from completed period-1 play-by-play.',
  partial:rows.length<recent.length
 },{headers:{'Cache-Control':'public,s-maxage=900,stale-while-revalidate=1800'}});
}
