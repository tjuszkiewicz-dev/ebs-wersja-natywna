import { getVisibleUserIds, admin } from '@/lib/crm/visibility';

// UWAGA (E7d): w BBS lista ról była bramką dostępu do leaderboardu. W EBS bramkuje
// `can(auth,'crm.leaderboard')` w route'ach, a tu zostaje TYLKO lista ról, które
// w ogóle występują w rankingu sprzedaży (owner/superadmin są obserwatorami, nie zawodnikami).
export const ROLE_SPRZEDAZOWE = ['partner', 'menedzer', 'dyrektor'] as const;

export type Period = 'month' | 'quarter' | 'year';

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  leads_count: number;
  deals_closed: number;
  conversion_rate: number;
  rank: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

export function getPeriodStart(period: Period): string {
  const now = new Date();
  let start: Date;

  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'quarter') {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), quarterMonth, 1);
  } else {
    // year
    start = new Date(now.getFullYear(), 0, 1);
  }

  return start.toISOString();
}

/**
 * Fetch the leaderboard for a given caller and period.
 * Throws on DB errors; returns an empty array when no visible users exist.
 */
export async function fetchLeaderboard(
  callerId: string,
  callerRole: string,
  period: Period,
): Promise<LeaderboardEntry[]> {
  const periodStart = getPeriodStart(period);

  const visibleIds = await getVisibleUserIds(callerId, callerRole);

  let profilesQuery = (admin() as any)
    .from('user_profiles')
    .select('id, full_name')
    .in('role', ROLE_SPRZEDAZOWE as unknown as string[]);

  if (visibleIds !== null) {
    if (visibleIds.length === 0) {
      return [];
    }
    profilesQuery = profilesQuery.in('id', visibleIds);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;
  if (profilesError) {
    throw new Error(profilesError.message);
  }
  if (!profiles || profiles.length === 0) {
    return [];
  }

  const userIds = profiles.map((p: { id: string }) => p.id);

  // Filter by created_at per spec. Limitation: leads created before the period
  // but signed within it are excluded. Add a signed_at column to leads and filter
  // on that instead if precise "closed this period" tracking is needed.
  const { data: leads, error: leadsError } = await (admin() as any)
    .from('leads')
    .select('id, assigned_to, status')
    .in('assigned_to', userIds)
    .gte('created_at', periodStart);

  if (leadsError) {
    throw new Error(leadsError.message);
  }

  const leadsData = leads ?? [];

  const leadsByUser = new Map<string, { total: number; signed: number }>();
  for (const userId of userIds) {
    leadsByUser.set(userId, { total: 0, signed: 0 });
  }
  for (const lead of leadsData as { assigned_to: string | null; status: string }[]) {
    if (!lead.assigned_to) continue;
    const entry = leadsByUser.get(lead.assigned_to);
    if (!entry) continue;
    entry.total += 1;
    if (lead.status === 'SIGNED') {
      entry.signed += 1;
    }
  }

  const entries: Omit<LeaderboardEntry, 'rank' | 'badge'>[] = profiles.map(
    (profile: { id: string; full_name: string | null }) => {
      const stats = leadsByUser.get(profile.id) ?? { total: 0, signed: 0 };
      const conversion_rate =
        stats.total > 0 ? Math.round((stats.signed / stats.total) * 100 * 100) / 100 : 0;
      return {
        user_id: profile.id,
        full_name: profile.full_name ?? '',
        avatar_url: null,
        leads_count: stats.total,
        deals_closed: stats.signed,
        conversion_rate,
      };
    },
  );

  entries.sort((a, b) => {
    if (b.deals_closed !== a.deals_closed) return b.deals_closed - a.deals_closed;
    return b.leads_count - a.leads_count;
  });

  const BADGES: Array<'gold' | 'silver' | 'bronze'> = ['gold', 'silver', 'bronze'];

  const leaderboard: LeaderboardEntry[] = entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    badge: idx < 3 ? BADGES[idx] : null,
  }));

  return leaderboard;
}

export interface PartnerSelfStanding {
  rank: number;
  total_count: number;
  leads_count: number;
  deals_closed: number;
  conversion_rate: number;
  full_name: string;
}

/**
 * Dla partnera: jego pozycja wśród WSZYSTKICH partnerów w danym okresie.
 * Ranking globalny — nie ograniczony do zespołu.
 */
export async function fetchPartnerSelfStanding(
  callerId: string,
  period: Period,
): Promise<PartnerSelfStanding | null> {
  const periodStart = getPeriodStart(period);

  const { data: partners, error: partnersError } = await (admin() as any)
    .from('user_profiles')
    .select('id, full_name')
    .eq('role', 'partner');

  if (partnersError) throw new Error(partnersError.message);
  if (!partners || partners.length === 0) return null;

  const userIds = partners.map((p: { id: string }) => p.id);

  const { data: leads, error: leadsError } = await (admin() as any)
    .from('leads')
    .select('id, assigned_to, status')
    .in('assigned_to', userIds)
    .gte('created_at', periodStart);

  if (leadsError) throw new Error(leadsError.message);
  const leadsData = leads ?? [];

  const statsByUser = new Map<string, { total: number; signed: number }>();
  for (const userId of userIds) statsByUser.set(userId, { total: 0, signed: 0 });
  for (const lead of leadsData as { assigned_to: string | null; status: string }[]) {
    if (!lead.assigned_to) continue;
    const entry = statsByUser.get(lead.assigned_to);
    if (!entry) continue;
    entry.total += 1;
    if (lead.status === 'SIGNED') entry.signed += 1;
  }

  const ranked = partners
    .map((p: { id: string; full_name: string | null }) => {
      const s = statsByUser.get(p.id) ?? { total: 0, signed: 0 };
      return { id: p.id, full_name: p.full_name ?? '', total: s.total, signed: s.signed };
    })
    .sort((a, b) => (b.signed - a.signed) || (b.total - a.total));

  const idx = ranked.findIndex(r => r.id === callerId);
  if (idx === -1) return null;

  const me = ranked[idx];
  const conversion_rate = me.total > 0 ? Math.round((me.signed / me.total) * 100 * 100) / 100 : 0;

  return {
    rank: idx + 1,
    total_count: ranked.length,
    leads_count: me.total,
    deals_closed: me.signed,
    conversion_rate,
    full_name: me.full_name,
  };
}
