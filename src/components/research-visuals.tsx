'use client';
import {useEffect,useMemo,useState} from 'react';
import {formatPHT,MARKETS} from '@/lib/analytics';
import type {Game,Market,Player} from '@/lib/types';
import type {RotationPlayer,SimilarResult,HeatmapCell} from '@/lib/research-visuals';
import type {InjuryEntry,InjurySnapshot} from '@/lib/injury-feed';

type VisualResponse={rotations:{home:RotationPlayer[];away:RotationPlayer[]};similar:SimilarResult[];matrix:HeatmapCell[]};
type Stat='pts'|'reb'|'ast'|'fg3m';
function resultValue(row:SimilarResult,market:Market):number|null{
 const map:Record<Market,Stat[]>={pts:['pts'],reb:['reb'],ast:['ast'],fg3m:['fg3m'],
 pr:['pts','reb'],pa:['pts','ast'],ra:['reb','ast'],pra:['pts','reb','ast'],
 stl:[],blk:[],turnover:[]};
 const keys=map[market];
 if(!keys.length)return null;
 const values=keys.map(k=>row[k]);
 return values.every(v=>typeof v==='number')?values.reduce<number>((s,v)=>s+(v||0),0):null;
}
const fmt=(v:number|null|undefined,n=1)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(n):'—';
function injuryFor(name:string,team:string,feed:InjurySnapshot|null):InjuryEntry|null{
 return feed?.reports.find(v=>v.player.toLowerCase()===name.toLowerCase()&&v.teamName.toLowerCase()===team.toLowerCase())||null;
}
const injuryTone=(s:string)=>/^(out|suspension|injured reserve)$/i.test(s)?'out':/^(questionable|doubtful|day-to-day)$/i.test(s)?'questionable':'other';
export default function ResearchVisuals({game,player,market,line}:{game:Game|undefined;player:Player|undefined;market:Market;line:number}){
 const [context,setContext]=useState<VisualResponse|null>(null),[feed,setFeed]=useState<InjurySnapshot|null>(null);
 const [error,setError]=useState(''),[teamSide,setTeamSide]=useState<'away'|'home'>('away');
 const [overrides,setOverrides]=useState<Record<string,number>>({});
 useEffect(()=>{setOverrides({});setTeamSide('away');},[game?.id]);
 useEffect(()=>{
  setContext(null);setError('');
  if(!game||!player)return;
  const ctrl=new AbortController();
  fetch('/api/matchup-context?game='+encodeURIComponent(game.id)+'&player='+encodeURIComponent(player.id),{signal:ctrl.signal})
   .then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||'Matchup unavailable');return x;})
   .then((x:VisualResponse)=>setContext(x)).catch(e=>{if(!ctrl.signal.aborted)setError(String(e.message||e));});
  return()=>ctrl.abort();
 },[game?.id,player?.id]);
 useEffect(()=>{
  const ctrl=new AbortController();
  fetch('/api/injuries',{signal:ctrl.signal}).then(r=>r.ok?r.json():null).then(x=>{if(x)setFeed(x);}).catch(()=>{});
  return()=>ctrl.abort();
 },[game?.id]);
 const team=teamSide==='away'?game?.away_team:game?.home_team;
 const rotation=context?.rotations?.[teamSide]||[];
 const opponent=game&&player?(player.team_id===game.home_team_id?game.away_team:game.home_team):undefined;
 const similar=context?.similar||[];
 const supported=useMemo(()=>similar.map(r=>({...r,value:resultValue(r,market)})).filter((r):r is SimilarResult&{value:number}=>r.value!==null),[similar,market]);
 return <div className="research-visuals">
  <section className="panel">
   <div className="section-heading"><div><p className="eyebrow">ROTATION INTELLIGENCE</p><h2>Minutes &amp; lineup scenarios</h2></div>
    {game&&<div className="segmented"><button className={teamSide==='away'?'selected':''} onClick={()=>setTeamSide('away')}>{game.away_team?.abbreviation}</button><button className={teamSide==='home'?'selected':''} onClick={()=>setTeamSide('home')}>{game.home_team?.abbreviation}</button></div>}
   </div>
   <p className="fineprint">Each player's last 10 imported final-game appearances. Adjust a minutes slider for a <b>manual scenario</b>—not an official starter or minutes projection.</p>
   {!game||!player?<p className="fineprint">Select a matchup and player to see both teams' recent rotations.</p>:
    error?<p className="warning-note">{error}</p>:
    !context?<p className="fineprint">Loading verified minutes…</p>:
    !rotation.length?<p className="fineprint">No verified minutes available for this team yet.</p>:
    <div className="rotation-list">
     <div className="rotation-table-header"><span>Player / position</span><span>Manual minutes scenario</span><span>Recent avg</span></div>
     {rotation.map((p,i)=>{
      const injury=injuryFor(p.name,team?.name||'',feed);
      const value=overrides[p.id]??Math.round(p.minutes);
      return <div className={'rotation-entry '+(i<5?'rotation-leader':'')} key={p.id}>
       <div className="rotation-name"><strong>{p.name}</strong><span>{p.position||'Position unverified'} · {p.sample} games</span>
        {injury&&<span className={'availability-state '+injuryTone(injury.status)}>{injury.status} · ESPN</span>}</div>
       <div className="rotation-slider"><input aria-label={'Manual scenario minutes for '+p.name} type="range" min="0" max="48" step="1" value={value}
        onChange={e=>setOverrides(v=>({...v,[p.id]:Number(e.target.value)}))}/><span className="rotation-set">{value} MIN</span></div>
       <div className="rotation-average">{fmt(p.minutes)}<small>{fmt(p.minMinutes,0)}–{fmt(p.maxMinutes,0)} observed</small></div>
      </div>;
     })}
    </div>}
   <p className="fineprint">Highlighted rows are recent minutes leaders, <b>not confirmed starters</b>. An injured player does not automatically transfer minutes to a teammate. Manual scenarios are not constrained to a 240-minute team total.</p>
  </section>
  <div className="two-grid">
   <section className="panel">
    <div className="section-heading"><div><p className="eyebrow">POSITION INTELLIGENCE</p><h2>Opponent stat heatmap</h2></div></div>
    <p className="fineprint">Raw points, rebounds and assists produced by each broad position group against <b>{opponent?.abbreviation||'the opponent'}</b>.</p>
    {!game||!player?<p className="fineprint">Choose a matchup and player.</p>:
     !context?<p className="fineprint">{error||'Loading verified comparisons…'}</p>:
     <div className="role-heatmap">
      <div className="role-heat-head"><span>ROLE</span><span>PTS</span><span>REB</span><span>AST</span></div>
      {(context.matrix||[]).map(item=>{
       const p=item.profile;
       return <div className="role-heat-row" key={item.role}>
        <span className="heat-role">{item.role==='wing'?'F / Wing':item.role==='guard'?'G / Guard':'C / Big'}</span>
        {[p?.pts,p?.reb,p?.ast].map((num,i)=>{
         const value=typeof num==='number'?num:null;
         const denom=i===0?28:i===1?11:8;
         const alpha=value===null?0:Math.min(.35,.07+value/denom*.26);
         const bg=value===null?'#152033':'rgba(90,125,224,'+alpha.toFixed(2)+')';
         return <span key={i} className="heat-value" style={{background:bg}}>{fmt(value)}</span>;
        })}
       </div>;
      })}
     </div>}
    <p className="fineprint">Minimum three verified opponent games and eight player-games per populated role. Higher raw averages do <b>not</b> prove weaker defense; pace and minutes are uncontrolled. Shot-zone graphics require real shot-location data that our free feed does not supply.</p>
   </section>
   <section className="panel">
    <div className="section-heading"><div><p className="eyebrow">SIMILAR PLAYERS</p><h2>Similar roles vs. {opponent?.abbreviation||'opponent'}</h2></div></div>
    <p className="fineprint">Actual previous games by similar-position players against this opponent. Market: <b>{MARKETS[market].short}</b>, line: <b>{Number.isFinite(line)?line:'—'}</b>.</p>
    {!game||!player?<p className="fineprint">Select a matchup and player.</p>:
     !context?<p className="fineprint">{error||'Loading comparable games…'}</p>:
     !supported.length?<p className="fineprint">Insufficient verified similar-player games for this market.</p>:
     <div className="similar-result-list">{supported.map((r,i)=>{
      const difference=r.value-line;
      return <div className="similar-result" key={r.gameId+'-'+r.playerId+'-'+i}>
       <div><strong>{r.name}</strong><small>{r.position||'Position unverified'} · {formatPHT(r.date)} · {fmt(r.minutes)} MIN</small></div>
       <div className="similar-numbers"><strong>{fmt(r.value)}</strong><span className={difference>0?'above':difference<0?'below':'push'}>{difference>0?'+':''}{fmt(difference)} vs line</span></div>
      </div>;
     })}</div>}
    <p className="fineprint">Broad G/F/C role comparison, not talent-matched, usage-adjusted or a prediction for the selected player.</p>
   </section>
  </div>
 </div>;
}
