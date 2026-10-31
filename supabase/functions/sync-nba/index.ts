import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { BallDontLieProvider, ProviderError, normalizeGames, normalizeStats, player, team, type Json } from './provider.ts';
const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'');
 if(!/^[a-f0-9]{64}$/.test(token))return reply(401,{error:'Unauthorized'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const owner=crypto.randomUUID();const {data:claimed,error:claimError}=await db.rpc('claim_nba_sync',{p_token:token,p_owner:owner});
 if(claimError||!claimed)return reply(409,{error:'Unauthorized or another synchronization is running'});
 let statOk=false,injuryOk=false,rosterOk=false,cursor:string|null=null;const counts:Json={games:0,boxes:0};
 const finish=async(state:string,message:string)=>{
  const {error}=await db.rpc('finish_nba_sync',{p_owner:owner,p_state:state,p_message:message,p_counts:counts,p_stats:statOk,p_injuries:injuryOk,p_roster:rosterOk,p_cursor:cursor});
  if(error)throw new Error('Could not record synchronization completion.');
 };
 const ingest=async(payload:Json)=>{const {error}=await db.rpc('ingest_nba_batch',{p_owner:owner,p_payload:payload});if(error)throw new Error('Database rejected an ingestion batch.');};
 try{
  const key=Deno.env.get('BALLDONTLIE_API_KEY');
  if(!key){await finish('awaiting_provider','Scheduled worker is running. Add an authorized NBA provider key to enable data updates.');return reply(200,{state:'awaiting_provider',ingested:0});}
  const paid=['all-star','goat'].includes(Deno.env.get('BDL_PLAN')??'free');
  const provider=new BallDontLieProvider(key,paid?1100:12500,paid?40:8);
  const now=new Date(),day=(d:Date)=>d.toISOString().slice(0,10),shift=(n:number)=>day(new Date(now.getTime()+n*86400000));
  const {data:health,error:healthError}=await db.from('data_health').select('*').eq('id','nba').single();if(healthError)throw new Error('Cannot read synchronization checkpoint.');
  const current=await provider.get('games',{start_date:shift(-3),end_date:shift(7)});
  await ingest(normalizeGames(current));counts.games=current.length;
  if(!paid){await finish('partial','Schedule updated. Player statistics and injuries require the provider’s ALL-STAR plan or higher.');return reply(200,{state:'partial',...counts});}
  const finals=current.filter(g=>/^final\b/i.test(g.status)||g.status_state==='final');
  if(finals.length){const stats=await provider.get('stats',{'game_ids[]':finals.map(g=>String(g.id))});const payload=normalizeStats(stats,new Map(finals.map(g=>[g.id,g])));await ingest(payload);counts.boxes+=payload.boxes.length;}
  statOk=true;
  if(!health.roster_success||Date.now()-Date.parse(health.roster_success)>86400000){
   const roster=await provider.get('players/active');
   await ingest({teams:[...new Map(roster.filter(p=>p.team).map(p=>[p.team.id,team(p.team)])).values()],players:roster.map(p=>player(p,true))});rosterOk=true;
  }
  const injuries=await provider.get('player_injuries');
  await ingest({teams:[...new Map(injuries.filter(i=>i.player?.team).map(i=>[i.player.team.id,team(i.player.team)])).values()],players:injuries.map(i=>player(i.player)),injuries:injuries.map(i=>({player_id:'bdl:'+i.player.id,status:i.status||'Unknown',detail:i.description??null,return_date:i.return_date??null}))});injuryOk=true;
  // Backfill one complete calendar day per run; retry that day on any failure.
  const end=new Date((health.backfill_cursor??shift(-4))+'T12:00:00Z');
  const seasonStart=new Date(Date.UTC(now.getUTCFullYear()-(now.getUTCMonth()<9?2:1),9,1));
  if(end>=seasonStart){
   const old=await provider.get('games',{'dates[]':[day(end)]});await ingest(normalizeGames(old));
   const finalOld=old.filter(g=>/^final\b/i.test(g.status)||g.status_state==='final');
   if(finalOld.length){const stats=await provider.get('stats',{'game_ids[]':finalOld.map(g=>String(g.id))});const payload=normalizeStats(stats,new Map(finalOld.map(g=>[g.id,g])));await ingest(payload);counts.boxes+=payload.boxes.length;}
   cursor=day(new Date(end.getTime()-86400000));
  }
  await finish('current','Schedule, final-game statistics, and injury records updated. Historical backfill continues automatically.');
  return reply(200,{state:'current',...counts});
 }catch(error){
  const message=error instanceof ProviderError?error.message:'Synchronization failed. Last verified records are preserved.';
  try{await finish('error',message);}catch{console.error('Sync completion could not be persisted',owner);}
  return reply(503,{state:'error',message});
 }
});
