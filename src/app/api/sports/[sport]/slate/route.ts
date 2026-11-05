import {NextRequest,NextResponse} from 'next/server';
import {assertSportsDate,adjacentUtcDates,filterSportsSlate,normalizeMlbSchedule,normalizeWnbaScoreboard} from '@/lib/sports';
import type {ExtraSport,SportsGame} from '@/lib/sports';
export const runtime='nodejs';
export async function GET(req:NextRequest,ctx:{params:Promise<{sport:string}>}){
 const {sport}=await ctx.params;
 if(sport!=='wnba'&&sport!=='mlb')return NextResponse.json({error:'Unknown sports sector'},{status:404});
 let day:string;
 try{day=assertSportsDate(req.nextUrl.searchParams.get('date')||'');}
 catch{return NextResponse.json({error:'Select a valid YYYY-MM-DD date'},{status:400});}
 try{
  const days=adjacentUtcDates(day);
  const feed=await Promise.all(days.map(async d=>{
   const url=sport==='wnba'?
    'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates='+d.replace(/-/g,'')+'&limit=40':
    'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date='+d;
   const response=await fetch(url,{next:{revalidate:600},signal:AbortSignal.timeout(12000),
    headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('External feed unavailable');
   const payload=await response.json();
   return sport==='wnba'?normalizeWnbaScoreboard(payload):normalizeMlbSchedule(payload);
  }));
  const games=filterSportsSlate(feed.flat() as SportsGame[],day);
  return NextResponse.json({sport:sport as ExtraSport,date:day,games,source:sport==='wnba'?'ESPN (unofficial public feed)':'MLB Stats API',
   retrievedAt:new Date().toISOString()},{headers:{'Cache-Control':'public, s-maxage=300, stale-while-revalidate=600'}});
 }catch{
  return NextResponse.json({error:'Verified '+sport.toUpperCase()+' schedule temporarily unavailable',sport,date:day},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
