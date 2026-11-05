'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {Activity,BarChart3,BookOpen,ChevronLeft,ChevronRight,Clock3,Database,Menu,X} from 'lucide-react';
import {formatPHT,nextResearchSlateDate} from '@/lib/analytics';
import {SportSwitcher} from '@/components/sport-switcher';
import type {ExtraSport,SportBoxRow,SportsGame,SportsSlate} from '@/lib/sports';

const statsFor={
 wnba:{overview:'WNBA overview',games:'WNBA games',boxscores:'WNBA player stats'},
 mlb:{overview:'MLB overview',games:'MLB games',boxscores:'MLB batting & pitching'}
};
const sourceFor={wnba:'ESPN (unofficial public feed)',mlb:'MLB Stats API'};
const examples={wnba:'2026-11-01',mlb:'2026-10-28'};
const dayShift=(date:string,days:number)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
function statusText(status:SportsGame['status']){
 return status==='final'?'Final':status==='live'?'Live':status==='scheduled'?'Upcoming':status==='postponed'?'Postponed':status==='canceled'?'Canceled':'Status not confirmed';
}
const DISPLAY_KEYS={wnba:['MIN','PTS','REB','AST','3PM','STL','BLK'],batting:['AB','H','TB','R','RBI','HR','BB'],pitching:['IP','SO','ER','H','BB']} as const;
function BoxTable({rows,category}:{rows:SportBoxRow[];category:'basketball'|'batting'|'pitching'}){
 const filtered=rows.filter(r=>r.category===category);
 const keys=category==='basketball'?DISPLAY_KEYS.wnba:DISPLAY_KEYS[category];
 if(!filtered.length)return <p className="sport-note">No verified player statistics for this category.</p>;
 return <div className="sport-table-scroll"><table className="sport-box-table">
  <thead><tr><th>Player / team</th><th>POS</th>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead>
  <tbody>{filtered.map((row,i)=><tr key={row.playerId+category+i}>
   <td><strong>{row.name}</strong><small>{row.team}</small></td><td>{row.position||'—'}</td>
   {keys.map(k=><td key={k}>{row.metrics[k]??'—'}</td>)}
  </tr>)}</tbody>
 </table></div>;
}
export default function LeagueDashboard({sport,section,initialDate}:{sport:ExtraSport;section:'overview'|'games'|'boxscores';initialDate:string}){
 const [date,setDate]=useState(initialDate),[auto,setAuto]=useState(true),[games,setGames]=useState<SportsGame[]>([]);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[message,setMessage]=useState('');
 const [gameId,setGameId]=useState(''),[rows,setRows]=useState<SportBoxRow[]>([]),[boxLoading,setBoxLoading]=useState(false),[boxError,setBoxError]=useState('');
 const [mobile,setMobile]=useState(false);
 const labels=statsFor[sport];
 const route=section==='overview'?'/'+sport:'/'+sport+'/'+section;
 const links=[
  {id:'overview',text:'Overview',href:'/'+sport,icon:<Activity size={17}/>},
  {id:'games',text:labels.games,href:'/'+sport+'/games',icon:<Clock3 size={17}/>},
  {id:'boxscores',text:labels.boxscores,href:'/'+sport+'/boxscores',icon:<BookOpen size={17}/>}
 ];
 const selected=useMemo(()=>games.find(g=>g.id===gameId)||null,[games,gameId]);
 const title=labels[section];
 useEffect(()=>{
  const controller=new AbortController();setStatus('loading');setMessage('');setGameId('');setRows([]);
  fetch('/api/sports/'+sport+'/slate?date='+encodeURIComponent(date),{signal:controller.signal})
   .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Schedule unavailable');return data as SportsSlate;})
   .then(d=>{setGames(d.games);setStatus('ready');})
   .catch(e=>{if(!controller.signal.aborted){setGames([]);setStatus('error');setMessage(String(e.message||e));}});
  return()=>controller.abort();
 },[sport,date]);
 useEffect(()=>{
  if(!auto)return;
  const rollover=()=>{
   if(document.hidden)return;
   const target=nextResearchSlateDate();
   if(target!==date)setDate(target);
  };
  rollover();
  const interval=setInterval(rollover,15000);
  document.addEventListener('visibilitychange',rollover);
  return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',rollover);};
 },[auto,date]);
 useEffect(()=>{
  const controller=new AbortController();
  setRows([]);setBoxError('');
  if(!gameId||!selected||selected.status!=='final')return;
  setBoxLoading(true);
  fetch('/api/sports/'+sport+'/boxscore?game='+encodeURIComponent(gameId),{signal:controller.signal})
   .then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||'Box score unavailable');return x;})
   .then(d=>setRows(d.rows||[]))
   .catch(e=>{if(!controller.signal.aborted)setBoxError(String(e.message||e));})
   .finally(()=>{if(!controller.signal.aborted)setBoxLoading(false);});
  return()=>controller.abort();
 },[sport,gameId,selected?.status]);
 const changeDate=(value:string)=>{setAuto(false);setDate(value);};
 const choose=(id:string)=>{setGameId(id);};
 return <div className="workspace">
  <aside className={'sidebar sport-page-sidebar '+(mobile?'mobile-open':'')}>
   <Link className="brand" href="/" aria-label="The Tsukasa Picks"><span className="brand-mark"><BarChart3 size={25}/></span><span>The Tsukasa <b>Picks</b></span></Link>
   <button className="mobile-close icon-btn" onClick={()=>setMobile(false)} aria-label="Close navigation"><X size={20}/></button>
   <SportSwitcher active={sport}/>
   <div className="nav-caption">{sport.toUpperCase()} RESEARCH</div>
   <nav aria-label={sport.toUpperCase()+' navigation'}>{links.map(l=><Link key={l.id} className={'nav-item '+(section===l.id?'active':'')} aria-current={section===l.id?'page':undefined} href={l.href} onClick={()=>setMobile(false)}>{l.icon}<span>{l.text}</span></Link>)}</nav>
   <div className="sidebar-bottom">
    </div>
  </aside>
  <div className="main-shell">
   <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobile(true)} aria-label="Open navigation"><Menu size={21}/></button>
    <div className="breadcrumb">Sports <ChevronRight size={14}/><b>{sport.toUpperCase()}</b><ChevronRight size={13}/>{title}</div>
    <div className="topbar-right"><span className="timezone">PHT <span>UTC +08:00</span></span></div></header>
   <main id="main-content">
    <div className="page-heading"><div><p className="eyebrow">{sport.toUpperCase()}</p>
     <h1>{title}</h1><p>{sport==='wnba'?'Games and player stats':'Games, batting and pitching'}</p></div>
     <div className="date-control">
      <button aria-label="Previous day" onClick={()=>changeDate(dayShift(date,-1))}><ChevronLeft size={17}/></button>
      <input type="date" aria-label={sport.toUpperCase()+' date in Philippine time'} value={date} onChange={e=>e.target.value&&changeDate(e.target.value)}/>
      <button aria-label="Next day" onClick={()=>changeDate(dayShift(date,1))}><ChevronRight size={17}/></button>
      <button className={'auto-slate '+(auto?'active':'')} aria-pressed={auto} onClick={()=>{setAuto(true);setDate(nextResearchSlateDate());}}>{auto?'Auto ON':'Auto slate'}</button>
     </div>
    </div>
    <div className="sport-hub">
     {section==='overview'&&<section className="panel sport-overview">
      <p className="eyebrow">YOUR {sport.toUpperCase()} SECTOR</p>
      <h2>{sport==='wnba'?"Women's basketball research":'Baseball research workspace'}</h2>
      
      <div className="sport-overview-actions">
       <Link className="primary-button" href={'/'+sport+'/games'}>Browse {sport.toUpperCase()} games <ChevronRight size={16}/></Link>
       <Link className="secondary-button" href={'/'+sport+'/boxscores'}>Player box scores <ChevronRight size={15}/></Link>
      </div>
     </section>}
     <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">{sport.toUpperCase()} SCHEDULE</p><h2>{section==='boxscores'?'Select a game':'Games & results'}</h2></div>
       <span className="sport-source-tag">{sourceFor[sport]}</span>
      </div>
      <p className="sport-note">{date} · PHT</p>
      {status==='loading'?<p className="sport-empty">Loading verified {sport.toUpperCase()} games…</p>:
       status==='error'?<p role="alert" className="sport-empty">{message}</p>:
       !games.length?<div className="sport-empty">
        <Database size={28}/><h3>No {sport.toUpperCase()} games found on this date</h3>
        <p>The league may be off-season. Browse completed 2026 results instead; we do not invent upcoming matchups.</p>
        <button className="sport-history-button" onClick={()=>changeDate(examples[sport])}>View a verified 2026 results date</button>
       </div>:
       <div className="sport-game-list">{games.map(g=><button type="button" className={'sport-game-card '+(gameId===g.id?'active':'')} key={g.id} onClick={()=>choose(g.id)}>
         <div className="sport-game-timing"><span className={'sport-status '+g.status}>{statusText(g.status)}</span><small>{formatPHT(g.starts_at)}</small></div>
         <div className="sport-game-team"><span>{g.away.name}</span><strong>{g.away.score??'—'}</strong></div>
         <div className="sport-game-team"><span>{g.home.name}</span><strong>{g.home.score??'—'}</strong></div>
         <small>{g.venue||'Venue not listed'}</small>
        </button>)}</div>}
     </section>
     {(section==='boxscores'||gameId)&&<section className="panel sport-stats-section">
      <div className="section-heading"><div><p className="eyebrow">{sport.toUpperCase()} GAME STATISTICS</p><h2>{selected?selected.away.name+' @ '+selected.home.name:'Player box scores'}</h2></div></div>
      {!selected?<p className="sport-empty">Select a completed game above to inspect verified player statistics.</p>:
       selected.status!=='final'?<p className="sport-empty">This game is not final yet. Player box-score statistics will be available when the source publishes them.</p>:
       boxLoading?<p className="sport-empty">Loading verified player stats…</p>:
       boxError?<p role="status" className="sport-empty">{boxError}</p>:
       rows.length===0?<p className="sport-empty">Player box score unavailable for this completed game.</p>:
       sport==='wnba'?<BoxTable rows={rows} category="basketball"/>:
       <><h3>Batters</h3><BoxTable rows={rows} category="batting"/><h3 className="sport-subheading">Pitchers</h3><BoxTable rows={rows} category="pitching"/></>}
      <p className="sport-note">Game-level observations only. No fabricated L10 hit rates, projections, or odds. {sourceFor[sport]}.</p>
     </section>}
     <footer className="sport-footer">© The Tsukasa Picks · {sport.toUpperCase()}</footer>
    </div>
   </main>
  </div>
 </div>;
}
