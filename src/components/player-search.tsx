'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowRight,BarChart3,Database,Filter,Search,Users,X} from 'lucide-react';
import {MARKETS,qualifying,summarize,valueOf,formatPHT} from '@/lib/analytics';
import type {BoxScore,Dataset,Market,Player} from '@/lib/types';

const GameChart=dynamic(()=>import('./chart'),{loading:()=> <div className="chart-empty">Loading player chart…</div>});
const SEARCH_MARKETS:Market[]=['pts','reb','ast','fg3m','pr','pa','pra'];
type PositionFilter='all'|'guard'|'forward'|'center';
function playerGroup(position:string|null):PositionFilter{
 const p=(position||'').toUpperCase();
 if(p==='C'||p==='C-F'||p==='F-C')return 'center';
 if(p==='F'||p==='SF'||p==='PF'||p==='F-G')return 'forward';
 if(p==='G'||p==='PG'||p==='SG'||p==='G-F')return 'guard';
 return 'all';
}
function initialPosition(p:Player){return p.position?.trim().toUpperCase()||'POS?';}
function metric(v:number|null,digits=1){return v===null||!Number.isFinite(v)?'—':v.toFixed(digits);}
function pct(v:number|null){return v===null?'—':Math.round(v*100)+'%';}
function medianLine(logs:BoxScore[],market:Market):number|null{
 const values=qualifying(logs,market).map(r=>valueOf(r,market)).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)).sort((a,b)=>a-b);
 if(!values.length)return null;
 const mid=values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2;
 return Math.floor(mid)+0.5;
}
export default function PlayerSearch({dataset}:{dataset:Dataset}){
 const params=useSearchParams();
 const [search,setSearch]=useState(''),[team,setTeam]=useState('all'),[position,setPosition]=useState<PositionFilter>('all');
 const [market,setMarket]=useState<Market>('pts'),[windowSize,setWindowSize]=useState(10);
 const [side,setSide]=useState<'over'|'under'>('over'),[manualLine,setManualLine]=useState('');
 const [logs,setLogs]=useState<BoxScore[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const selectedId=params.get('player')||'';
 const selected=dataset.players.find(p=>p.id===selectedId)||null;
 const teams=useMemo(()=>[...new Map(dataset.players.filter(p=>p.team?.abbreviation).map(p=>[p.team_id!,p.team!])).entries()]
   .map(([id,t])=>({id,name:t.name,code:t.abbreviation})).sort((a,b)=>a.name.localeCompare(b.name)),[dataset.players]);
 const matches=useMemo(()=>{
   const needle=search.trim().toLocaleLowerCase();
   return dataset.players.filter(p=>{
    if(team!=='all'&&p.team_id!==team)return false;
    if(position!=='all'&&playerGroup(p.position)!==position)return false;
    const haystack=(p.name+' '+(p.team?.name||'')+' '+(p.team?.abbreviation||'')+' '+(p.position||'')).toLocaleLowerCase();
    return !needle||haystack.includes(needle);
   });
 },[dataset.players,search,team,position]);
 useEffect(()=>{
   setLogs([]);setError('');
   if(!selectedId)return;
   const abort=new AbortController();
   setLoading(true);
   const revision=encodeURIComponent(dataset.health?.stats_success||'initial');
   fetch('/api/players/'+encodeURIComponent(selectedId)+'?revision='+revision,{signal:abort.signal})
    .then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Game log request failed');return payload;})
    .then(payload=>{if(!abort.signal.aborted)setLogs(Array.isArray(payload.logs)?payload.logs:[]);})
    .catch(e=>{if(!abort.signal.aborted)setError(String(e.message||e));})
    .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
   return()=>abort.abort();
 },[selectedId,dataset.health?.stats_success]);
 useEffect(()=>{setMarket('pts');setWindowSize(10);setManualLine('');setSide('over');},[selectedId]);
 const qualified=useMemo(()=>qualifying(logs,market,{window:windowSize||undefined}),[logs,market,windowSize]);
 const suggestedLine=useMemo(()=>medianLine(logs,market),[logs,market]);
 const researchLine=manualLine.trim()!==''?Number(manualLine):suggestedLine;
 const validLine=researchLine!==null&&Number.isFinite(researchLine)&&researchLine>=0&&researchLine<=300;
 const summary=useMemo(()=>validLine?summarize(qualified,market,researchLine!,side):null,[qualified,market,researchLine,side,validLine]);
 const allMarkets=useMemo(()=>['pts','reb','ast','fg3m'].map(m=>{
  const key=m as Market,values=qualifying(logs,key,{window:10}).map(v=>valueOf(v,key)).filter((x):x is number=>x!==null);
  return {key,label:MARKETS[key].short,count:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};
 }),[logs]);
 return <div className="player-finder-layout">
  <section className="panel player-finder-list">
   <div className="player-search-title"><div><p className="eyebrow">NBA PLAYER DIRECTORY</p><h2>Find any player</h2></div><span className="player-search-count"><Users size={14}/>{dataset.players.length} tracked</span></div>
   <p className="fineprint">Search our verified active NBA roster—no matchup selection needed.</p>
   <label className="player-search-field" htmlFor="nba-player-query"><Search size={18}/><input id="nba-player-query" autoComplete="off" type="search"
    placeholder="Search name, team, or position…" value={search} onChange={e=>setSearch(e.target.value)}/>
    {search&&<button type="button" aria-label="Clear player search" onClick={()=>setSearch('')}><X size={15}/></button>}
   </label>
   <div className="player-search-filterbar">
    <label htmlFor="nba-player-team"><span>Team</span><select id="nba-player-team" value={team} onChange={e=>setTeam(e.target.value)}>
     <option value="all">All 30 teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select></label>
    <label htmlFor="nba-player-position"><span>Position</span><select id="nba-player-position" value={position} onChange={e=>setPosition(e.target.value as PositionFilter)}>
     <option value="all">All positions</option><option value="guard">Guards</option><option value="forward">Forwards</option><option value="center">Centers</option>
    </select></label>
   </div>
   <div className="player-result-heading"><span>{matches.length} matching players</span>
    {(team!=='all'||position!=='all'||search)&&<button type="button" onClick={()=>{setTeam('all');setPosition('all');setSearch('');}}><Filter size={13}/> Clear filters</button>}
   </div>
   <div className="player-results" aria-label="NBA search results">
    {!matches.length?<div className="player-no-results"><Search size={27}/><strong>No matching players</strong><span>Try a different name, team, or position.</span></div>:
     matches.map(p=><Link href={'/players?player='+encodeURIComponent(p.id)} scroll={false} key={p.id}
      className={'player-result '+(p.id===selectedId?'selected':'')} aria-current={p.id===selectedId?'true':undefined}>
      <span className="player-avatar">{p.name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>
      <span className="player-result-identity"><strong>{p.name}</strong><small>{p.team?.name||'Team unverified'}</small></span>
      <span className="player-result-meta"><span>{initialPosition(p)}</span><small>{p.team?.abbreviation||'—'}</small></span>
      <ArrowRight className="player-result-chevron" size={15}/>
     </Link>)}
   </div>
   <p className="fineprint player-finder-foot">Player availability and roster assignments depend on the latest imported database update. Historical game logs may be incomplete.</p>
  </section>
  <div className="player-inspector">
   {!selected?<section className="panel player-search-welcome">
     <div className="search-empty-glyph"><BarChart3 size={30}/></div>
     <p className="eyebrow">PLAYER ANALYSIS</p><h2>Every player's story, in one search.</h2>
     <p>Choose an NBA player on the left to open recent game logs, scoring trends, rebounds, assists, and a detailed prop research chart.</p>
     <div className="player-search-hints"><span>PTS</span><span>REB</span><span>AST</span><span>3PM</span><span>PRA</span><span>L5 / L10 / L20</span></div>
     <p className="fineprint">Browse anyone from the roster—even when they are not on tomorrow's slate.</p>
    </section>:
    <><section className="panel player-spotlight">
     <div className="player-spotlight-top"><div className="player-spotlight-avatar">{selected.name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}</div>
      <div className="player-spotlight-name"><p className="eyebrow">{selected.team?.name||'Current team unverified'} · {initialPosition(selected)}</p><h2>{selected.name}</h2><p>{selected.team?.abbreviation||'NBA'} · Historical NBA research</p></div>
      <Link href={'/lab?player='+encodeURIComponent(selected.id)} className="player-open-lab">Open full Prop Lab <ArrowRight size={15}/></Link>
     </div>
     {loading?<p className="player-source-status">Loading actual game records…</p>:error?<p role="status" className="player-source-status error">{error}</p>:
      <p className="player-source-status"><Database size={13}/>{logs.length} imported game records · latest {logs[0]?.game?.starts_at?formatPHT(logs[0].game.starts_at):'not available'}</p>}
     <div className="player-quick-stat-grid">{allMarkets.map(m=><div className="player-quick-stat" key={m.key}><small>LAST {Math.min(m.count,10)} · {m.label}</small><strong>{metric(m.mean)}</strong><span>Verified game average</span></div>)}</div>
    </section>
    <section className="panel player-search-analysis">
     <div className="section-heading"><div><p className="eyebrow">RECENT GAME LOGS</p><h2>Performance trends</h2></div><span className="tag blue">{MARKETS[market].short}</span></div>
     <div className="player-market-tabs" role="group" aria-label="Player stat market">
      {SEARCH_MARKETS.map(m=><button key={m} type="button" className={market===m?'active':''} aria-pressed={market===m}
       onClick={()=>{setMarket(m);setManualLine('');}}>{MARKETS[m].short}</button>)}
     </div>
     <div className="player-chart-controls">
      <div className="segmented" role="group" aria-label="Game sample">{[5,10,20,0].map(w=><button key={w}
        className={windowSize===w?'selected':''} aria-pressed={windowSize===w} onClick={()=>setWindowSize(w)}>{w?'L'+w:'All'}</button>)}</div>
      <label>Research line <input type="number" min="0" max="300" step="0.5" placeholder={suggestedLine===null?'—':String(suggestedLine)}
       value={manualLine} onChange={e=>setManualLine(e.target.value)}/></label>
      <div className="segmented" role="group" aria-label="Over or under"><button className={side==='over'?'selected':''} onClick={()=>setSide('over')}>Over</button><button className={side==='under'?'selected':''} onClick={()=>setSide('under')}>Under</button></div>
     </div>
     <p className="fineprint">Reference threshold: <b>{validLine?researchLine:'Not available'}</b>. Initially based on the imported historical median, <b>not a sportsbook line</b>. Enter your own line for hit-rate analysis.</p>
     <div className="player-summary-strip">
      <div><small>{side.toUpperCase()} HIT RATE</small><strong>{pct(summary?.rate??null)}</strong><span>{summary?summary.wins+'/'+(summary.n-summary.pushes)+' settled':'No qualifying sample'}</span></div>
      <div><small>AVERAGE</small><strong>{metric(summary?.mean??null)}</strong><span>{summary?.n??0} sampled games</span></div>
      <div><small>MEDIAN</small><strong>{metric(summary?.median??null)}</strong><span>Observed middle result</span></div>
      <div><small>STD DEV</small><strong>{metric(summary?.sd??null)}</strong><span>Historical variability</span></div>
     </div>
     {loading?<div className="player-no-logs">Loading verified game logs…</div>:
      error?<div className="player-no-logs">Game history unavailable. Please try again later.</div>:
      !qualified.length||!validLine?<div className="player-no-logs"><Database size={23}/>No qualifying player game logs are available yet.</div>:
      <GameChart rows={qualified} market={market} line={researchLine!} side={side}/>}
     <p className="fineprint">Historical hit rates describe imported records and are not predicted probabilities or betting recommendations. Full matchup and injury context remains in the Player Prop Lab.</p>
    </section></>}
  </div>
 </div>;
}
