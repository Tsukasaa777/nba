import {NextRequest,NextResponse} from 'next/server';
import {loadDataset} from '@/lib/data';
import {publicDatabase} from '@/lib/supabase';
import {dayBounds,nextResearchSlateDate} from '@/lib/analytics';
import {rankNbaSlate} from '@/lib/recommendations';
import type {HistoricalStat} from '@/lib/recommendations';
export const runtime='nodejs';
export const maxDuration=60;

export async function GET(req:NextRequest){
 const date=req.nextUrl.searchParams.get('date')||nextResearchSlateDate();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))
  ||new Date(date).toISOString().slice(0,10)!==date)
  return NextResponse.json({error:'Invalid NBA slate date'},{status:400});
 const data=await loadDataset(date);
 if(data.error)return NextResponse.json({error:data.error,date},{status:503});
 const games=data.games.filter(g=>(g.status==='scheduled'||g.status==='unknown')&&g.starts_at);
 const blank=()=>({date,matches:[],totalCandidates:0,scannedPlayers:0,partial:false});
 if(!games.length)return NextResponse.json({
  ...blank(),mode:'experimental statistical screening',injuryVerified:false,feedFresh:data.health?.stats_success||null,
  explanation:'No verified upcoming NBA games for this Philippine-time date.'
 });
 const teamIds=[...new Set(games.flatMap(g=>[g.home_team_id,g.away_team_id]))];
 const db=publicDatabase();
 if(!db)return NextResponse.json({error:'NBA data source unavailable',date},{status:503});
 const {end}=dayBounds(date);
 const earliest=new Date(Date.parse(end)-75*86400000).toISOString();
 const rows:HistoricalStat[]=[];
 let partial=false;
 try{
  const pages=4;
  const batches=await Promise.all(Array.from({length:pages},(_,i)=>
   db.from('box_scores')
    .select('game_id,player_id,team_id,minutes,played,played_at,stats,game:games!inner(status,starts_at,home_team_id,away_team_id)')
    .in('team_id',teamIds).eq('game.status','final').gte('played_at',earliest)
    .lt('played_at',end).order('played_at',{ascending:false}).range(i*1000,(i+1)*1000-1)));
  const error=batches.find(batch=>batch.error)?.error;
  if(error)throw new Error('Historical player logs unavailable');
  for(const batch of batches)rows.push(...(batch.data||[]) as unknown as HistoricalStat[]);
  partial=(batches[pages-1].data?.length||0)===1000;
 }catch{
  return NextResponse.json({error:'Could not verify player history for this slate. No picks were generated.',date},{status:503});
 }
 const injuryVerified=Boolean(data.health?.injuries_success&&
  Date.now()-Date.parse(data.health.injuries_success)<12*3600000);
 const picks=rankNbaSlate({date,games,players:data.players,logs:rows,injuries:data.injuries,
  injuryFeedFresh:injuryVerified,partial,perGame:3});
 return NextResponse.json({...picks,mode:'experimental statistical screening',
  injuryVerified,feedFresh:data.health?.stats_success||null,
  calculatedAt:new Date().toISOString(),rowsAnalyzed:rows.length,
  explanation:'Reference lines are derived from the historical median, not sportsbook odds. Evidence scores are relative research ranks, not win probabilities or profitable betting edges.'
 },{headers:{'Cache-Control':'public, s-maxage=240, stale-while-revalidate=480'}});
}
