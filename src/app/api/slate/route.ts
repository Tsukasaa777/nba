import { NextRequest, NextResponse } from 'next/server';
import { loadDataset } from '@/lib/data';
import { manilaDate } from '@/lib/analytics';
export async function GET(req:NextRequest){const day=req.nextUrl.searchParams.get('date')??manilaDate();if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day).toISOString().slice(0,10)!==day)return NextResponse.json({error:'Invalid date'},{status:400});const data=await loadDataset(day);return NextResponse.json(data,{headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=60'}});}
