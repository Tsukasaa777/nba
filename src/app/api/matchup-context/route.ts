import {NextRequest,NextResponse} from 'next/server';
import {publicDatabase} from '@/lib/supabase';
import {GAME_SELECT,loadTeamGames} from '@/lib/data';
import {observedPositionAllowances} from '@/lib/position-allowances';
import type {PositionBox} from '@/lib/position-allowances';
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
  const opposingId=game.home_team_id===player.team_id?game.away_team_id:game.home_team_id;
  // Only completed historical NBA games before selected matchup; no future leakage.
  const opponentGames=(await loadTeamGames(opposingId,cutoff)).slice(0,10);
  const ids=opponentGames.map(g=>g.id);
  let positionAllowed=null;
  if(ids.length){
   const {data:against,error:againstError}=await db.from('box_scores')
    .select('game_id,team_id,minutes,played,stats,player:players!box_scores_player_id_fkey(position)')
    .in('game_id',ids).neq('team_id',opposingId).eq('played',true).limit(400);
   if(!againstError) positionAllowed=observedPositionAllowances(against as unknown as PositionBox[],player.position,opposingId);
  }
  return NextResponse.json({...result,positionAllowed},{headers:{'Cache-Control':'public,s-maxage=120,stale-while-revalidate=180'}});
 }catch{return NextResponse.json({error:'Verified matchup statistics could not be loaded'},{status:503});}
}
