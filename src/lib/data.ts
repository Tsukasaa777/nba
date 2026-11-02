import { publicDatabase } from './supabase';
import { dayBounds } from './analytics';
import type { Dataset, Game, BoxScore, Player, Injury, Health } from './types';
export const GAME_SELECT='*,home_team:teams!games_home_team_id_fkey(*),away_team:teams!games_away_team_id_fkey(*)';
export async function loadDataset(date:string):Promise<Dataset>{
 const db=publicDatabase();const empty:Dataset={games:[],players:[],injuries:[],health:null,configured:!!db,error:null,date};
 if(!db)return {...empty,error:'The NBA data connection is being configured.'};
 try{
  const {start,end}=dayBounds(date);
  const results=await Promise.all([
   db.from('games').select(GAME_SELECT).gte('starts_at',start).lt('starts_at',end).order('starts_at').limit(50),
   db.from('players').select('*,team:teams!players_team_id_fkey(*)').eq('active',true).order('name').limit(700),
   db.from('injuries').select('*,player:players(*,team:teams!players_team_id_fkey(*))').eq('active',true).order('fetched_at',{ascending:false}).limit(300),
   db.from('data_health').select('*').eq('id','nba').maybeSingle(),
  ]);
  const error=results.find(r=>r.error)?.error;
  if(error){ console.warn('NBA database query failed', {code:error.code, message:error.message}); return {...empty,error:'Latest data is unavailable. Please try again shortly.'}; }
  return {...empty,games:results[0].data as Game[],players:results[1].data as Player[],injuries:results[2].data as unknown as Injury[],health:results[3].data as Health|null};
 }catch{return {...empty,error:'The data service did not respond. Please try again shortly.'};}
}
export async function loadPlayerLogs(playerId:string):Promise<BoxScore[]>{
 const db=publicDatabase();if(!db)return [];
 const {data,error}=await db.from('box_scores').select(`*,game:games!inner(${GAME_SELECT})`).eq('player_id',playerId).eq('game.status','final').order('played_at',{ascending:false}).limit(500);
 if(error)throw new Error('Historical data is temporarily unavailable.');return data as unknown as BoxScore[];
}
export async function loadTeamGames(teamId:string,before:string):Promise<Game[]>{
 const db=publicDatabase();if(!db)return [];
 const {data,error}=await db.from('games').select(GAME_SELECT).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).eq('status','final').lt('starts_at',before).order('starts_at',{ascending:false}).limit(20);
 if(error)throw new Error('Team context is temporarily unavailable.');return data as Game[];
}
