'use client';
import {useState} from 'react';
import {formatPHT,MARKETS,valueOf} from '@/lib/analytics';
import type {BoxScore,Market} from '@/lib/types';

const average=(rows:BoxScore[],key:'minutes'|'pts'|'reb'|'ast'|'fg3m')=>{
 const nums=rows.map(r=>key==='minutes'?r.minutes:r.stats?.[key]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
 return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null;
};
const fmt=(v:number|null|undefined)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(1):'—';

export default function GameChart({rows,market,line,side}:{rows:BoxScore[];market:Market;line:number;side:'over'|'under'}){
 const [selected,setSelected]=useState<string|null>(null);
 const sorted=[...rows].reverse();
 const active=sorted.find(r=>r.game_id===selected)||sorted[sorted.length-1]||null;
 const max=Math.max(Number.isFinite(line)?line*1.3:0,...rows.map(r=>valueOf(r,market)||0),5)*1.12;
 const total=rows.filter(r=>{const v=valueOf(r,market);return v!==null&&v!==line;}).length;
 const wins=rows.filter(r=>{const v=valueOf(r,market);return v!==null&&(side==='over'?v>line:v<line);}).length;
 if(!rows.length)return <div className="chart-empty"><div className="chart-grid"/><span className="empty-chart-icon">▥</span><h3>No qualifying games yet</h3><p>Verified game logs will appear here. Try All games or a broader filter.</p></div>;
 return <div className="research-chart">
  <div className="chart-dashboard-head">
   <div><small>LAST {rows.length} VERIFIED GAMES</small><strong>{total?Math.round(wins/total*100)+'%':'—'}</strong><span>{wins} of {total} settled · {rows.length-total} pushes</span></div>
   <div><small>AVERAGE</small><strong>{fmt(average(rows,market==='pts'?'pts':market==='reb'?'reb':market==='ast'?'ast':market==='fg3m'?'fg3m':'minutes'))}</strong><span>{MARKETS[market].short} {['pr','pa','ra','pra','stl','blk','turnover'].includes(market)?'— see summary above':''}</span></div>
   <div><small>SELECTED GAME</small><strong className="chart-selected-stat">{active?valueOf(active,market):'—'}</strong><span>{active?formatPHT(active.game.starts_at):'—'}</span></div>
  </div>
  <div className="chart-detail" aria-live="polite">{active&&<>
   <div><strong>{active.team_id===active.game.home_team_id?active.game.away_team?.abbreviation:active.game.home_team?.abbreviation}</strong>
    <span>{formatPHT(active.game.starts_at)} · {active.team_id===active.game.home_team_id?'Home':'Away'}</span></div>
   <div className="chart-detail-stats">
    <span><b>{fmt(active.minutes)}</b> MIN</span>
    <span><b>{active.stats.pts??'—'}</b> PTS</span>
    <span><b>{active.stats.reb??'—'}</b> REB</span>
    <span><b>{active.stats.ast??'—'}</b> AST</span>
    <span><b>{active.stats.fg3m??'—'}</b> 3PM</span>
   </div>
  </>}</div>
  <div className="chart-scroll">
   <div className="bar-chart upgraded-bar-chart" style={{minWidth:Math.max(700,sorted.length*49)}}>
    {Number.isFinite(line)&&line>=0&&<div className="chart-line" style={{bottom:(line/max*100)+'%'}}><span>LINE {line}</span></div>}
    {sorted.map(r=>{
     const v=valueOf(r,market)!;
     const win=side==='over'?v>line:v<line;
     const opp=r.team_id===r.game.home_team_id?r.game.away_team:r.game.home_team;
     const isSelected=active?.game_id===r.game_id;
     return <div className="bar-column" key={r.game_id}>
      <button type="button" className={'bar '+(v===line?'push':win?'win':'loss')+(isSelected?' focused':'')}
       style={{height:Math.max(1,v/max*100)+'%'}} onMouseEnter={()=>setSelected(r.game_id)}
       onFocus={()=>setSelected(r.game_id)} onClick={()=>setSelected(r.game_id)}
       aria-pressed={isSelected}
       aria-label={(r.game.provider_date||'Unknown date')+', vs '+opp?.name+', '+v+' '+MARKETS[market].label+', '+(v===line?'push':win?'hit':'miss')}>
       <span className="bar-value">{v}</span>
      </button>
      <span className="bar-label">{opp?.abbreviation||'—'}<small>{r.team_id===r.game.home_team_id?'H':'A'}</small><small>{r.game.provider_date.slice(5)}</small></span>
     </div>;
    })}
   </div>
  </div>
  <div className="legend"><span><i className="dot green"/>Hit</span><span><i className="dot red"/>Miss</span><span><i className="dot amber"/>Push</span><span>Click or hover to inspect · oldest to newest</span></div>
  <div className="supporting-grid">
   {([{name:'Minutes',key:'minutes'},{name:'Points',key:'pts'},{name:'Rebounds',key:'reb'},{name:'Assists',key:'ast'},{name:'3PT made',key:'fg3m'}] as const).map(item=>
    <div key={item.key}><small>{item.name}</small><strong>{fmt(average(rows,item.key))}</strong><span>Observed avg · {rows.length} games max</span></div>
   )}
  </div>
  <p className="fineprint">Supporting stats use available final-game box scores only; no rebound-chance, possession, contested-shot, or shot-location tracking is implied.</p>
 </div>;
}
