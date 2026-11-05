import Link from 'next/link';
import {CircleDot,Activity} from 'lucide-react';
export type SportSector='nba'|'wnba'|'mlb';
export function SportSwitcher({active}:{active:SportSector}){
 const tabs=[
  {id:'nba' as const,label:'NBA',url:'/',icon:<Activity size={14}/>},
  {id:'wnba' as const,label:'WNBA',url:'/wnba',icon:<Activity size={14}/>},
  {id:'mlb' as const,label:'MLB',url:'/mlb',icon:<CircleDot size={14}/>}
 ];
 return <div className="league-switcher" aria-label="Choose sports sector">
  {tabs.map(t=><Link key={t.id} href={t.url} className={'league-tab '+(active===t.id?'selected':'')}
   aria-current={active===t.id?'page':undefined}>{t.icon}<span>{t.label}</span></Link>)}
 </div>;
}
