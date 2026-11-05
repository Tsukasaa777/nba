import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import LeagueDashboard from '@/components/league-dashboard';
import {nextResearchSlateDate} from '@/lib/analytics';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'MLB',description:'MLB-only baseball games, verified batting and pitching box scores in Philippine Time · The Tsukasa Picks'};
export default async function MlbPage({params}:{params:Promise<{section?:string[]}>}){
 const route=(await params).section?.join('/')||'overview';
 if(!['overview','games','boxscores'].includes(route))notFound();
 return <LeagueDashboard sport="mlb" section={route as 'overview'|'games'|'boxscores'} initialDate={nextResearchSlateDate()}/>;
}
