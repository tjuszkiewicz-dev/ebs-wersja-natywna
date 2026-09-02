// GET /api/crm/leaderboard?period=month|quarter|year — ranking sprzedaży.
// Port z BBS-Unified (E7d). Adaptacje: bramka `can(auth,'crm.leaderboard')` zamiast listy
// ról zaszytej w kodzie (dzięki temu ranking widzi też `owner`, którego BBS nie zna),
// brak dostępu → 403 (wzorzec EBS).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import {
  fetchLeaderboard,
  fetchPartnerSelfStanding,
  type LeaderboardEntry,
  type Period,
} from '@/lib/crm/leaderboard';

export type { LeaderboardEntry };

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.leaderboard'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const periodParam = new URL(request.url).searchParams.get('period') ?? 'month';
  const period: Period = (['month', 'quarter', 'year'] as const).includes(periodParam as Period)
    ? (periodParam as Period)
    : 'month';

  try {
    // Partner widzi wyłącznie własną pozycję na tle wszystkich partnerów — nie cudze wyniki.
    if (auth.role === 'partner') {
      const self = await fetchPartnerSelfStanding(auth.id, period);
      return NextResponse.json({ self, entries: [] as LeaderboardEntry[] });
    }
    const entries = await fetchLeaderboard(auth.id, auth.role, period);
    return NextResponse.json({ self: null, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
