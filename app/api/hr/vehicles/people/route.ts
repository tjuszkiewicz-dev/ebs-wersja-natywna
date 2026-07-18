// GET /api/hr/vehicles/people — kandydaci na głównego użytkownika pojazdu:
// wszyscy użytkownicy systemu (każda rola: koordynator, szef, dyrektor, admin…)
// + pracownicy z kartoteki agencji.
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLE_PL: Record<string, string> = {
  superadmin: 'Admin', dyrektor: 'Dyrektor', szef_koordynatorow: 'Szef koordynatorów', koordynator: 'Koordynator',
  menedzer: 'Menedżer', partner: 'Partner', leadowiec: 'Leadowiec', hr: 'HR', hr_panel: 'HR', pracodawca: 'Pracodawca', ksiegowa: 'Księgowa',
};

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin() as any;
  const [{ data: users }, { data: employees }] = await Promise.all([
    sb.from('user_profiles').select('id, full_name, role').not('full_name', 'is', null).order('full_name'),
    sb.from('hr_employees').select('id, first_name, last_name').eq('archived', false).eq('candidate', false).order('last_name'),
  ]);
  return NextResponse.json({
    users: (users || []).filter((u: any) => !['pracownik', 'pracownik_tymczasowy', 'klient'].includes(u.role))
      .map((u: any) => ({ id: u.id, name: u.full_name, role: ROLE_PL[u.role] || u.role })),
    employees: (employees || []).map((e: any) => ({ id: e.id, name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() })),
  });
}
