import {NextResponse} from 'next/server';
import {publicDatabase} from '@/lib/supabase';
import {isSupportedNbaId} from '@/lib/provider-id';
import {espnAbbreviation,extractUpcomingTeamGames,findVerifiedRosterPlayer} from '@/lib/player-profile';
import type {Player} from '@/lib/types';
export const runtime='nodejs';

export async function GET(_request:Request,ctx:{params:Promise<{id:string}>}){
 const {id}=await ctx.params;
 if(!isSupportedNbaId(id))return NextResponse.json({error:'Invalid player ID'},{status:400});
 const db=publicDatabase();
 if(!db)return NextResponse.json({error:'Player database unavailable'},{status:503});
 const {data,error}=await db.from('players')
  .select('id,name,position,team_id,team:teams!players_team_id_fkey(id,name,abbreviation)')
  .eq('id',id).maybeSingle();
 if(error||!data)return NextResponse.json({error:'Player not found'},{status:404});
 const player=data as unknown as Player;
 const abbreviation=espnAbbreviation(player.team?.abbreviation||'');
 const empty={playerId:id,headshot:null,jersey:null,position:player.position||null,
  team:player.team?.name||'',upcoming:[],
  sources:{portrait:null,schedule:null}};
 if(!abbreviation)return NextResponse.json(empty);
 const year=new Date().getUTCFullYear(),month=new Date().getUTCMonth();
 const season=month>=7?year+1:year;
 const prefix='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/'+abbreviation;
 const requests=[
  prefix+'/roster',
  prefix+'/schedule?season='+season
 ];
 const results=await Promise.allSettled(requests.map(async url=>{
  const response=await fetch(url,{next:{revalidate:1800},signal:AbortSignal.timeout(9000),
   headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('ESPN feed unavailable');
  return response.json();
 }));
 const roster=results[0].status==='fulfilled'?results[0].value:null;
 const schedule=results[1].status==='fulfilled'?results[1].value:null;
 const profile=findVerifiedRosterPlayer(roster,player.name);
 const upcoming=schedule?extractUpcomingTeamGames(schedule,player.team,new Date().toISOString()):[];
 return NextResponse.json({
  playerId:id,headshot:profile?.headshot||null,jersey:profile?.jersey||null,
  position:player.position||profile?.position||null,team:player.team?.name||'',upcoming,
  sources:{portrait:profile?.headshot?'ESPN roster':null,schedule:schedule?'ESPN team schedule':null}
 },{headers:{'Cache-Control':'public,s-maxage=900,stale-while-revalidate=1800'}});
}
