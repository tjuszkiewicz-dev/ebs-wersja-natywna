// GET /api/tasks/people — osoby, którym można zlecić zadanie lub dopisać je do wydarzenia.
// Port z BBS-Unified (E7b) z dwiema zmianami:
//   * dołożona bramka `crm.kalendarz` (w BBS wystarczyło samo zalogowanie),
//   * odpowiedź zawiera też `me` — w BBS kalendarz brał zalogowanego z `/api/chat/users`,
//     a komunikatora w EBS nie ma do E6a. Dzięki temu kalendarz obchodzi się jednym wywołaniem.
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLE_PL: Record<string, string> = {
  superadmin: 'Admin', owner: 'Właściciel', dyrektor: 'Dyrektor',
  szef_koordynatorow: 'Szef koordynatorów', koordynator: 'Koordynator',
  menedzer: 'Menedżer', partner: 'Partner', leadowiec: 'Leadowiec',
  hr: 'HR', pracodawca: 'Pracodawca',
};

// Role bez dostępu operacyjnego — nie zlecamy im zadań ani nie dopisujemy do spotkań.
const EXCLUDED_ROLES = ['pracownik', 'pracownik_tymczasowy', 'klient', 'platnik'];

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data } = await (admin() as any)
    .from('user_profiles')
    .select('id, full_name, role')
    .not('full_name', 'is', null)
    .order('full_name');

  const people = (data || [])
    .filter((u: any) => !EXCLUDED_ROLES.includes(u.role))
    .map((u: any) => ({ id: u.id, name: u.full_name, role: ROLE_PL[u.role] || u.role }));

  const meRow = (data || []).find((u: any) => u.id === auth.id);
  return NextResponse.json({
    people,
    me: { id: auth.id, name: meRow?.full_name || auth.email, role: ROLE_PL[auth.role] || auth.role },
  });
}
