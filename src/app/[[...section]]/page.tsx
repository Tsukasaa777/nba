import { notFound, redirect } from 'next/navigation';
import { loadDataset } from '@/lib/data';
import { nextResearchSlateDate } from '@/lib/analytics';
import Dashboard from '@/components/dashboard';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section}=await params;const route=section?.join('/')||'overview';if(route==='matchups')redirect('/players');if(route==='builder')redirect('/recommended');if(!['overview','games','lab','players','injuries','recommended','picks','methodology','health','privacy','account'].includes(route))notFound();return <Dashboard route={route} initial={await loadDataset(nextResearchSlateDate())}/>;}
