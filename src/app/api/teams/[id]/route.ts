import { NextRequest, NextResponse } from 'next/server';
import { loadTeamGames } from '@/lib/data';
import { isSupportedNbaId } from '@/lib/provider-id';
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const before = req.nextUrl.searchParams.get('before');
  if (!isSupportedNbaId(id) || !before || !/^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))$/.test(before) || !Number.isFinite(Date.parse(before))) {
    return NextResponse.json({ error: 'Invalid team or timestamp' }, { status: 400 });
  }
  try {
    return NextResponse.json({ games: await loadTeamGames(id, new Date(before).toISOString()) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch {
    return NextResponse.json({ error: 'Team context is temporarily unavailable.' }, { status: 503 });
  }
}
