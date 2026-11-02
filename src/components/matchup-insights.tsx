'use client';
import {useEffect,useState} from 'react';
import type {Game,Market,Player} from '@/lib/types';
import type {RoleContext} from '@/lib/role-context';
import type {InjurySnapshot,InjuryEntry} from '@/lib/injury-feed';
import {formatPHT,MARKETS} from '@/lib/analytics';
const injuryStatus=(player:string,team:string,feed:InjurySnapshot|null):InjuryEntry|null=>
 feed?.reports.find(i=>i.teamName.toLowerCase()===team.toLowerCase()&&i.player.toLowerCase()===player.toLowerCase())||null;
export default function MatchupInsights({game,player,market}:{game:Game|undefined;player:Player|undefined;market:Market}){
 const [insights,setInsights]=useState<RoleContext|null>(null),[feed,setFeed]=useState<InjurySnapshot|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  setInsights(null);setError('');
  if(!game||!player)return;
  const ctrl=new AbortController();
  fetch('/api/matchup-context?game='+encodeURIComponent(game.id)+'&player='+encodeURIComponent(player.id),{signal:ctrl.signal})
   .then(async r=>{const v=await r.json();if(!r.ok)throw new Error(v.error||'Matchup service error');return v;})
   .then((data:RoleContext)=>setInsights(data))
   .catch(e=>{if(!ctrl.signal.aborted)setError('Matchup analysis could not be loaded. '+e.message);});
  return()=>ctrl.abort();
 },[game?.id,player?.id]);
 useEffect(()=>{
  const ctrl=new AbortController();
  fetch('/api/injuries',{signal:ctrl.signal}).then(r=>r.ok?r.json():null).then(x=>setFeed(x)).catch(()=>{});
  return()=>ctrl.abort();
 },[game?.id]);
 const opponent=game&&player?.team_id===game.home_team_id?game.away_team:game?.home_team;
 const own=game&&player?.team_id===game.home_team_id?game.home_team:game?.away_team;
 const marketLabel=MARKETS[market].short;
 const isPoints=['pts','pa','pr','pra','fg3m'].includes(market);
 return <section className="panel matchup-inference">
  <h3>Potential defender matchups</h3>
  {!game||!player?<p className="fineprint">Select a player and their upcoming game for a position-based opponent shortlist.</p>:
  error?<p role="status" className="warning-note">{error}</p>:
  !insights?<p className="fineprint">Analyzing opposing roster and verified minutes…</p>:
  !insights.defenders.length?<p className="fineprint">No opponent has enough verified recent minutes and matching position for a responsible shortlist. No defender is assumed.</p>:
  <><p className="fineprint">Possible on-ball or switch defenders from {opponent?.abbreviation}. Ranked by role fit and recent playing time—not defensive rating or confirmed assignments.</p>
  <div className="candidate-list">{insights.defenders.map((d,i)=>{
    const report=injuryStatus(d.name,opponent?.name||'',feed);
    return <div key={d.id} className="candidate-card">
      <div className="candidate-head"><strong>{i+1}. {d.name}</strong><span className="tag">{d.position||'Pos. unknown'}</span></div>
      <p className="fineprint">{d.avgMinutes.toFixed(1)} recent MIN · {d.games} games · {d.match==='similar'?'position match':'possible switch'}</p>
      {report&&<p className="fineprint">ESPN status: <b>{report.status}</b> — do not assume he will defend if unavailable.</p>}
      <p className="fineprint">{market==='reb'?'If he matches up inside, contested rebounds could affect opportunities.':
        market==='ast'?'If assigned at the point of attack, pressure could change passing opportunities or create kick-out chances.':
        isPoints?'If assigned, his presence could alter shot quality and touches; an under is not implied without tracking.':
        'A plausible matchup, but its effect on this stat is not established by box scores.'}</p>
    </div>;
   })}</div><p className="fineprint">These names are **estimated candidates**, not a scouting or player-vs-player defensive tracking report. Without assignment/contest data, no claimed defender suppression percentage is shown.</p></>}
  <h3 style={{marginTop:22}}>Key teammate opportunities</h3>
  {!game||!player?<p className="fineprint">Select a player to examine their own team's scoring and availability context.</p>:
  !insights?<p className="fineprint">Analyzing scoring/assist roles…</p>:
  !insights.teammates.length?<p className="fineprint">Not enough imported teammate games to identify verified key contributors.</p>:
  <div className="candidate-list">{insights.teammates.map(t=>{
    const injury=injuryStatus(t.name,own?.name||'',feed),status=injury?.status.toLowerCase()||'';
    const out=['out','suspension','injured reserve'].includes(status),uncertain=['questionable','day-to-day','doubtful'].includes(status);
    const highScorer=t.pts>=15,playmaker=t.ast>=5,sharedRole=Boolean(t.position&&player.position&&t.position===player.position);
    return <div className="candidate-card" key={t.id}>
      <div className="candidate-head"><strong>{t.name}</strong><span className="tag">{t.position||'Pos. unknown'}</span></div>
      <p className="fineprint">Recent {t.games} games · {t.pts.toFixed(1)} PTS · {t.ast.toFixed(1)} AST · {t.avgMinutes.toFixed(1)} MIN</p>
      <p className="fineprint"><b>Availability:</b> {injury?('ESPN '+injury.status+' (verify for this game)'):'Not confirmed by this feed'}</p>
      <p className="fineprint">{out?
        (highScorer?'If he misses this matchup, his scoring attempts could be redistributed; '+player.name+' may gain touches, but an increase is unverified.':
         'If absent, the rotation could change, but there is no verified increase in '+player.name+'\'s minutes or usage.'):
        uncertain?
         'His availability is uncertain. If out, extra opportunities are possible; if active, rotations may remain similar.':
        highScorer?
         (sharedRole?'If both play, they may share similar-position minutes and shot attempts; being active is not proof of lower scoring.':
          'If he plays, scoring responsibilities can be shared. His playmaking may also create easier chances for teammates.'):
         playmaker?
          'As a recent playmaker, his presence may create assisted looks; an absence may change who initiates offense.':
          'His role may affect rotations, but no specific usage shift is established.'}</p>
    </div>;
   })}</div>}
  <p className="fineprint">Scenario analysis only: recent box-score production and league-wide injuries, not possession-level on/off data. Teammate scoring does not automatically reduce the selected player's {marketLabel}; injuries do not automatically increase it. {feed?.publishedAt?'ESPN last published '+formatPHT(feed.publishedAt)+'.':''}</p>
 </section>;
}
