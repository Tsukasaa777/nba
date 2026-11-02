export type Json = Record<string,any>;
export interface NBAProvider { get(path:string,params?:Record<string,string|string[]>):Promise<Json[]>; }
export class ProviderError extends Error {constructor(public status:number,message:string){super(message);}}
export class BallDontLieProvider implements NBAProvider {
 private calls=0;private lastCall=0;
 constructor(private key:string,private interval=1100,private limit=40,private fetcher:typeof fetch=fetch){}
 async get(path:string,params:Record<string,string|string[]>={}) {
  const all:Json[]=[];let cursor:string|undefined;
  do {
   const url=new URL('https://api.balldontlie.io/v1/'+path);
   url.searchParams.set('per_page','100');
   for(const [k,v] of Object.entries(params))for(const x of Array.isArray(v)?v:[v])url.searchParams.append(k,x);
   if(cursor)url.searchParams.set('cursor',cursor);
   let page:Json|null=null;
   for(let attempt=0;attempt<3;attempt++){
    if(++this.calls>this.limit)throw new ProviderError(429,'Per-run request budget reached; the next scheduled run will resume.');
    const delay=Math.max(0,this.interval-(Date.now()-this.lastCall));if(delay)await new Promise(r=>setTimeout(r,delay));
    this.lastCall=Date.now();
    let response:Response;
    try{response=await this.fetcher(url,{headers:{Authorization:this.key,Accept:'application/json'},signal:AbortSignal.timeout(10000)});}catch{if(attempt===2)throw new ProviderError(504,'NBA provider timed out.');await new Promise(r=>setTimeout(r,500*2**attempt));continue;}
    if(response.ok){page=await response.json();break;}
    if(response.status===401||response.status===403)throw new ProviderError(response.status,'API key or plan does not permit this endpoint.');
    if(response.status!==429&&response.status<500)throw new ProviderError(response.status,'NBA provider rejected the request.');
    if(attempt===2)throw new ProviderError(response.status,'NBA provider is temporarily unavailable.');
    const retry=Math.min(10000,Math.max(500*2**attempt,Number(response.headers.get('retry-after')||0)*1000));
    await new Promise(r=>setTimeout(r,retry));
   }
   if(!page||!Array.isArray(page.data))throw new ProviderError(502,'Unexpected NBA provider response.');
   all.push(...page.data);const next=page.meta?.next_cursor; if(next!=null && String(next)===cursor)throw new ProviderError(502,'Provider pagination did not advance.');cursor=next==null?undefined:String(next);
  }while(cursor);
  return all;
 }
}
function id(v:unknown){if(!Number.isInteger(v)||Number(v)<=0)throw new Error('Invalid source identifier');return 'bdl:'+v;}
const numeric=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
export function minutes(value:unknown):number|null {if(typeof value==='number')return value>=0&&value<=80?value:null;if(typeof value!=='string'||!/^\d+(?::\d{2})?(?:\.\d+)?$/.test(value))return null;const [a,b]=value.split(':').map(Number);if(b!==undefined&&b>=60)return null;const n=a+(b||0)/60;return n<=80?n:null;}
export function team(t:Json){return {id:id(t.id),name:String(t.full_name||t.name),abbreviation:String(t.abbreviation),conference:t.conference??null};}
export function player(p:Json,active?:boolean){return {id:id(p.id),name:[p.first_name,p.last_name].filter(Boolean).join(' '),position:p.position||null,...(active!==undefined?{active,team_id:p.team?.id?id(p.team.id):null}:{})};}
export function game(g:Json){
 const raw=String(g.status??'').toLowerCase();const lifecycle=String(g.status_state??'');
 const status=lifecycle==='final'||/^final\b/.test(raw)?'final':lifecycle==='postponed'||raw.includes('postpon')?'postponed':lifecycle==='canceled'||/cancel/.test(raw)?'canceled':lifecycle==='in_progress'||(/quarter|halftime|\bot\b/.test(raw))?'live':lifecycle==='scheduled'||/\d{1,2}:\d{2}\s?(am|pm)|scheduled|not started/i.test(raw)?'scheduled':'unknown';
 const dt=g.datetime??(String(g.date).includes('T')?g.date:null);
 return {id:id(g.id),provider_date:String(g.date).slice(0,10),starts_at:dt&&Number.isFinite(Date.parse(dt))?new Date(dt).toISOString():null,season:g.season,status,home_team_id:id(g.home_team.id),away_team_id:id(g.visitor_team.id),home_score:status==='scheduled'?null:numeric(g.home_team_score),away_score:status==='scheduled'?null:numeric(g.visitor_team_score),postseason:!!g.postseason};
}
export function normalizeGames(games:Json[]){const teams=new Map<string,Json>();for(const g of games)for(const t of [g.home_team,g.visitor_team])teams.set(id(t.id),team(t));return {teams:[...teams.values()],games:games.map(game)};}
export function normalizeStats(stats:Json[],knownGames:Map<number,Json>){
 const teams=new Map<string,Json>(),players=new Map<string,Json>(),games=new Map<string,Json>(),boxes:Json[]=[];
 for(const s of stats){
  const g=knownGames.get(s.game?.id);if(!g)continue;const n=game(g);if(n.status!=='final')continue;
  for(const t of [g.home_team,g.visitor_team,s.team])teams.set(id(t.id),team(t));
  players.set(id(s.player.id),player(s.player));games.set(n.id,n);
  const min=minutes(s.min),values:Json={};for(const k of ['pts','reb','ast','fg3m','stl','blk','turnover','fga','fgm','fta'])values[k]=numeric(s[k]);
  boxes.push({game_id:n.id,player_id:id(s.player.id),team_id:id(s.team.id),played_at:n.starts_at??n.provider_date+'T12:00:00Z',minutes:min,played:min!==null&&min>0,stats:values});
 }
 return {teams:[...teams.values()],players:[...players.values()],games:[...games.values()],boxes};
}
