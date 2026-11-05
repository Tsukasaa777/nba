import {notFound} from 'next/navigation';
import LeagueDashboard from '@/components/league-dashboard';
import {nextResearchSlateDate} from '@/lib/analytics';
export const dynamic='force-dynamic';
export default async function MlbPage({params}:{params:Promise<{section?:string[]}>}){
 const route=(await params).section?.join('/')||'overview';
 if(!['overview','games','boxscores'].includes(route))notFound();
 return <LeagueDashboard sport="mlb" section={route as 'overview'|'games'|'boxscores'} initialDate={nextResearchSlateDate()}/>;
}
