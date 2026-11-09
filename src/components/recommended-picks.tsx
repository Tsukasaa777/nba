'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,BarChart3,CalendarDays,Clock3,Filter,RefreshCw,ShieldAlert} from 'lucide-react';
import {formatPHT} from '@/lib/analytics';
import type {Candidate,RankedSlate} from '@/lib/recommendations';

type ResponseData=RankedSlate&{
 mode:string;injuryVerified:boolean;feedFresh:string|null;calculatedAt:string;rowsAnalyzed:number;
 explanation:string;
};
function rankLabel(score:number){return score>=82?'Strong sample':score>=72?'Positive sample':'Watchlist';}
function CandidateCard({item}:{item:Candidate}){
 const isOver=item.side==='over';
 return <article className="recommendation-card">
  <div className="recommendation-card-head">
   <div className="recommendation-name"><div className="recommendation-player">{item.playerName}</div>
    <span>{item.team} · {item.position||'NBA'} · vs {item.opponent}</span></div>
   <div className="recommendation-rank"><strong>{item.rankScore}<small>/100</small></strong><span>{rankLabel(item.rankScore)}</span></div>
  </div>
  <div className="recommendation-selection"><span className={isOver?'recommendation-over':'recommendation-under'}>{item.side.toUpperCase()}</span>
   <strong>{item.referenceLine} {item.marketName}</strong>
   <small>Historical reference line</small></div>
  <div className="recommendation-metrics">
   <div><small>L5</small><strong>{item.last5Hit}/{item.last5N}</strong></div>
   <div><small>L10 SAMPLE</small><strong>{item.last10Hit}/{item.last10N}</strong></div>
   <div><small>L10 AVG</small><strong>{item.average}</strong></div>
   <div><small>MIN AVG</small><strong>{item.averageMinutes}</strong></div>
  </div>
  <div className="recommendation-reasons">
   <strong>Why it ranked</strong>
   {item.reasons.slice(0,3).map((r,i)=><p key={i}>{r}</p>)}
  </div>
  <div className="recommendation-card-bottom">
   <span><ShieldAlert size={13}/> Injury/starting status not confirmed</span>
   <Link href={'/lab?game='+encodeURIComponent(item.gameId)+'&player='+encodeURIComponent(item.playerId)}
    className="recommendation-lab-link">Check actual line in Prop Lab <ArrowRight size={14}/></Link>
  </div>
 </article>;
}
export default function RecommendedPicks({date}:{date:string}){
 const [data,setData]=useState<ResponseData|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0),[gameFilter,setGameFilter]=useState('all');
 const [minScore,setMinScore]=useState(60);
 useEffect(()=>{
  const controller=new AbortController();
  const fetchRecommendations=async()=>{
   setBusy(true);setError('');
   try{
    const r=await fetch('/api/recommendations?date='+encodeURIComponent(date),{
     signal:controller.signal,cache:'no-store'});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Recommendations unavailable');
    if(!controller.signal.aborted)setData(d as ResponseData);
   }catch(e){if(!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:'Unable to load');}}
   finally{if(!controller.signal.aborted)setBusy(false);}
  };
  void fetchRecommendations();
  const timer=setInterval(()=>{if(!document.hidden)void fetchRecommendations();},300000);
  const visible=()=>{if(!document.hidden)void fetchRecommendations();};
  document.addEventListener('visibilitychange',visible);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[date,refresh]);
 const matches=useMemo(()=>data?.matches.filter(m=>gameFilter==='all'||m.gameId===gameFilter)
  .map(m=>({...m,candidates:m.candidates.filter(c=>c.rankScore>=minScore)}))||[],[data,gameFilter,minScore]);
 const shown=matches.reduce((s,m)=>s+m.candidates.length,0);
 return <div className="recommendations-page">
  <section className="panel recommendations-header">
   <div>
    <p className="eyebrow">NBA · DAILY RESEARCH</p>
    <h2>Recommended Picks</h2>
    <p>Automatically screened candidates from verified player logs. Compare with a real sportsbook line before considering a selection.</p>
   </div>
   <div className="recommendations-header-count"><strong>{shown}</strong><small>Research candidates</small></div>
  </section>
  <div className="recommendation-toolbar">
   <div className="recommendation-day"><CalendarDays size={16}/><span>{date} · PHT slate</span><small>Auto: 2 PM PHT reset</small></div>
   <label><Filter size={15}/><select aria-label="Filter recommended picks by matchup" value={gameFilter} onChange={e=>setGameFilter(e.target.value)}>
    <option value="all">All games</option>
    {data?.matches.map(m=><option key={m.gameId} value={m.gameId}>{m.away} @ {m.home}</option>)}
   </select></label>
   <label>Evidence <select aria-label="Filter by evidence score" value={minScore} onChange={e=>setMinScore(Number(e.target.value))}>
    <option value={60}>All candidates</option><option value={72}>72+ score</option><option value={82}>82+ score</option>
   </select></label>
   <button type="button" className="secondary-button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>
    <RefreshCw size={15} className={busy?'spin':''}/> Refresh
   </button>
  </div>
  {error&&<section className="panel recommendation-warning" role="alert">{error}</section>}
  {busy&&!data?<div className="panel recommendation-loading"><RefreshCw size={20} className="spin"/> Scanning player games…</div>:null}
  {data&&<>
   <div className="recommendation-context">
    <span><Clock3 size={13}/> {data.calculatedAt?'Updated '+formatPHT(data.calculatedAt):'Auto refresh every 5 minutes'}</span>
    <span>{data.matches.length} verified scheduled games</span>
    <span>{data.rowsAnalyzed.toLocaleString()} imported player game records</span>
   </div>
   {!data.injuryVerified&&<div className="recommendation-warning"><ShieldAlert size={16}/>
    Injuries and confirmed lineups are not verified. Check player availability before using any candidate.</div>}
   {data.partial&&<div className="recommendation-warning">Historical search reached the data limit. Some candidate samples may be incomplete.</div>}
   {!data.matches.length?<section className="panel recommendation-loading">No verified upcoming NBA games for {date} PHT.</section>:
    <div className="recommendation-matchups">{matches.map(m=><section key={m.gameId} className="panel recommendation-matchup">
      <header className="recommendation-matchup-head">
       <div><p className="eyebrow">NBA MATCHUP</p><h3>{m.away} <span>@</span> {m.home}</h3></div>
       <div><span>{m.startsAt?formatPHT(m.startsAt):'Tipoff not verified'}</span><small>{m.candidates.length} candidates</small></div>
      </header>
      {m.candidates.length?<div className="recommendation-grid">{m.candidates.map(c=><CandidateCard key={c.id} item={c}/>)}</div>:
       <div className="recommendation-empty">No candidates passed this screen. Insufficient verified history or a weaker statistical signal.</div>}
     </section>)}</div>}
   <div className="recommendation-method">
    <BarChart3 size={17}/><div><strong>How recommendations work</strong>
     <p>Experimental, deterministic research ranking: recent L5/L10 hit rates against a fixed historical-median reference, minutes stability and sample coverage. One market per player, up to three per matchup. No real-time odds, bookmaker thresholds, opponent tracking, calibrated probabilities, or positive expected value are claimed. A high evidence score is <b>not</b> an estimated chance of winning. Not generated by an LLM.</p></div>
   </div>
  </>}
 </div>;
}
