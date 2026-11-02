'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Game } from '@/lib/types';
import { formatPHT } from '@/lib/analytics';
import { injuryForTeam } from '@/lib/injury-feed';
import type { InjurySnapshot, InjuryEntry } from '@/lib/injury-feed';
const sourceUrl='https://official.nba.com/nba-injury-report-2026-27-season/';
const statusTone=(status:string) => {
 const s=status.toLowerCase();
 return s==='out'||s==='suspension'||s==='injured reserve'?'red':
 s==='questionable'||s==='doubtful'||s==='day-to-day'?'amber':'neutral';
};
function TeamInjuries({name,abbreviation,items,hasFeed}:{name:string;abbreviation:string;items:InjuryEntry[];hasFeed:boolean}){
 return <div className="injury-team-card">
  <div className="injury-team-header"><h3>{name}</h3><span className="tag">{abbreviation} · {hasFeed?items.length+' listed':'Status unknown'}</span></div>
  {!hasFeed?<p className="fineprint">Injury source unavailable. Player availability cannot be confirmed.</p>:
   !items.length?<p className="fineprint">No active ESPN injury entries found for this team. This does not confirm that every player is available.</p>:
   <div className="injury-player-list">{items.map(item=><div className="injury-player" key={item.id}>
     <div className="injury-person"><strong>{item.player}</strong><span className={'tag '+statusTone(item.status)}>{item.status}</span></div>
     <small>{item.detail||'Reason not specified'}{item.returnDate?' · Listed return: '+item.returnDate:''}</small>
     {item.reportedAt&&<small>Last player report: {formatPHT(item.reportedAt)}</small>}
    </div>)}</div>}
 </div>;
}
export default function InjuryWatch({games,selectedGameId,showSelector=false}:{
 games:Game[];selectedGameId?:string;showSelector?:boolean;
}){
 const [chosen,setChosen]=useState<string>('');
 const [snapshot,setSnapshot]=useState<InjurySnapshot|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  if(!showSelector)return;
  setChosen(v=>games.some(g=>g.id===v)?v:games[0]?.id||'');
 },[games,showSelector]);
 useEffect(()=>{
  let alive=true;let running=false;
  const load=async()=>{
   if(running||document.hidden)return;
   running=true;
   try {
    const res=await fetch('/api/injuries');
    if(!res.ok)throw new Error('Source unavailable');
    const data=await res.json() as InjurySnapshot;
    if(alive){setSnapshot(data);setError('');}
   }catch{if(alive)setError('Latest ESPN injury report could not be loaded. Previously loaded statuses, if any, may be stale.');}
   finally{if(alive)setLoading(false);running=false;}
  };
  void load();
  const timer=setInterval(()=>void load(),300000);
  const onVisible=()=>{if(!document.hidden)void load();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
 },[]);
 const game=games.find(g=>g.id===(showSelector?chosen:selectedGameId));
 const home=game?.home_team,away=game?.away_team;
 const awayInjuries=useMemo(()=>away?injuryForTeam(snapshot?.reports??[],away.name):[],[snapshot,away?.name]);
 const homeInjuries=useMemo(()=>home?injuryForTeam(snapshot?.reports??[],home.name):[],[snapshot,home?.name]);
 return <section className="panel injury-watch">
  <div className="section-heading"><div><p className="eyebrow">NBA AVAILABILITY WATCH</p><h2>Matchup injury report</h2></div><span className={'tag '+(error?'amber':snapshot?'green':'neutral')}>{error?'Update delayed':snapshot?'ESPN feed':'Loading'}</span></div>
  {showSelector&&<label className="injury-game-select">Choose matchup <select value={chosen} onChange={e=>setChosen(e.target.value)}>
    <option value="">Choose a game</option>{games.map(g=><option key={g.id} value={g.id}>{g.away_team?.abbreviation} @ {g.home_team?.abbreviation}</option>)}
  </select></label>}
  {!game?<p className="muted">Choose a matchup to see each team's reported injuries separately.</p>:<>
    <p className="muted">Selected matchup: <b>{away?.name} @ {home?.name}</b> · {game.starts_at?formatPHT(game.starts_at):'Date pending'}</p>
    <div className="injury-two-teams">
      <TeamInjuries name={away!.name} abbreviation={away!.abbreviation} items={awayInjuries} hasFeed={!!snapshot}/>
      <TeamInjuries name={home!.name} abbreviation={home!.abbreviation} items={homeInjuries} hasFeed={!!snapshot}/>
    </div>
  </>}
  {loading&&!snapshot&&<p className="fineprint">Loading latest available injury data…</p>}
  {error&&<p className="warning-note" role="status">{error}</p>}
  <p className="fineprint">ESPN league-wide availability, not the confirmed designation for this specific game. Changes are checked every 5 minutes while the page is open. {snapshot?.publishedAt?'Source timestamp: '+formatPHT(snapshot.publishedAt)+'. ':''}Do not interpret an unlisted player as confirmed available. <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">Check official NBA injury reports ↗</a></p>
 </section>;
}
