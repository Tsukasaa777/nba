import { NextResponse } from 'next/server';
import { loadPlayerLogs } from '@/lib/data';
import { isSupportedNbaId } from '@/lib/provider-id';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isSupportedNbaId(id)) return NextResponse.json({ error: 'Invalid player identifier' }, { status: 400 });
  try {
    const logs = await loadPlayerLogs(id);
    return NextResponse.json({ logs, coverage: 'Up to 500 ingested final-game records; missing games are excluded.' },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ error: 'Historical data is temporarily unavailable.' }, { status: 503 });
  }
}
