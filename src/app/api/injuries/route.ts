import { NextResponse } from 'next/server';
import { normalizeInjuryFeed } from '@/lib/injury-feed';
export const runtime='nodejs';
export async function GET(){
 try {
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries',{
   headers:{Accept:'application/json'},
   next:{revalidate:300},
   signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error('Source unavailable');
  const raw=await response.json();
  const snapshot=normalizeInjuryFeed(raw,new Date().toISOString());
  return NextResponse.json(snapshot,{headers:{'Cache-Control':'public, s-maxage=300, stale-while-revalidate=90'}});
 }catch {
  return NextResponse.json({error:'The ESPN injury feed is temporarily unavailable. No statuses are assumed.'},
    {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
