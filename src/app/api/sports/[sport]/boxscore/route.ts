import {NextRequest,NextResponse} from 'next/server';
import {normalizeMlbBoxscore,normalizeWnbaBoxscore} from '@/lib/sports';
export const runtime='nodejs';
export async function GET(req:NextRequest,ctx:{params:Promise<{sport:string}>}){
 const {sport}=await ctx.params,game=req.nextUrl.searchParams.get('game')||'';
 if(sport!=='wnba'&&sport!=='mlb')return NextResponse.json({error:'Unknown sport'},{status:404});
 if(!new RegExp('^'+sport+':[1-9][0-9]{0,15}$').test(game))return NextResponse.json({error:'Invalid game identifier'},{status:400});
 const id=game.split(':')[1];
 try{
  const url=sport==='wnba'?
   'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/summary?event='+id:
   'https://statsapi.mlb.com/api/v1/game/'+id+'/boxscore';
  const response=await fetch(url,{next:{revalidate:600},signal:AbortSignal.timeout(12000),
   headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('No available verified game box score');
  const payload=await response.json();
  const rows=sport==='wnba'?normalizeWnbaBoxscore(payload):normalizeMlbBoxscore(payload);
  return NextResponse.json({sport,game,rows,source:sport==='wnba'?'ESPN (unofficial public feed)':'MLB Stats API'},
   {headers:{'Cache-Control':'public,s-maxage=600,stale-while-revalidate=900'}});
 }catch{
  return NextResponse.json({error:'Box score not available from the source. Scheduled games may not have player stats.'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
