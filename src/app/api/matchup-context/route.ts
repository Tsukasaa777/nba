import {NextRequest,NextResponse} from 'next/server';
import {publicDatabase} from '@/lib/supabase';
import {GAME_SELECT} from '@/lib/data';
import {isSupportedNbaId} from '@/lib/provider-id';
import {buildRoleContext} from '@/lib/role-context';
import type {Game,Player} from '@/lib/types';
import type {RecentBox} from '@/lib/role-context';
export async function GET(req:NextRequest){
 const playerId=req.nextUrl.searchParams.get('player')||'',gameId=req.nextUrl.searchParams.get('game')||'';
 if(!isSupportedNbaId(playerId)||!isSupportedNbaId(gameId))return NextResponse.json({error:'Invalid selection'},{status:400});
 const db=publicDatabase();
 if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 try{
  const [gameResult,playerResult]=await Promise.all([
   db.from('games').select(GAME_SELECT).eq('id',gameId).single(),
   db.from('players').select('id,name,position,team_id').eq('id',playerId).single()
  ]);
  if(gameResult.error||playerResult.error||!gameResult.data||!playerResult.data)return NextResponse.json({error:'Unknown game or player'},{status:404});
  const game=gameResult.data as Game,player=playerResult.data as Player;
  if(!player.team_id||![game.home_team_id,game.away_team_id].includes(player.team_id))
   return NextResponse.json({error:'Player is not on a roster for this matchup'},{status:422});
  const teams=[game.home_team_id,game.away_team_id];
  const cutoff=game.starts_at||new Date().toISOString();
  const start=new Date(Date.parse(cutoff)-100*86400000).toISOString();
  const [rosters,boxScores]=await Promise.all([
   db.from('players').select('id,name,position,team_id').in('team_id',teams).eq('active',true).limit(100),
   db.from('box_scores').select('player_id,team_id,minutes,played,played_at,stats')
     .in('team_id',teams).gte('played_at',start).lt('played_at',cutoff).eq('played',true)
     .order('played_at',{ascending:false}).limit(900)
  ]);
  if(rosters.error||boxScores.error)throw new Error('Matchup context unavailable');
  const result=buildRoleContext(game,player,rosters.data as Player[],boxScores.data as RecentBox[]);
  return NextResponse.json(result,{headers:{'Cache-Control':'public,s-maxage=120,stale-while-revalidate=180'}});
 }catch{return NextResponse.json({error:'Verified matchup statistics could not be loaded'},{status:503});}
}
