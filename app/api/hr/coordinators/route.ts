// GET /api/hr/coordinators — lista koordynatorów (do przypisywania pracowników
// w kartotece) + liczba przypisanych pracowników.
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin() as any;
  const [users, emps] = await Promise.all([
    sb.from('user_profiles').select('id, full_name, role').in('role', ['koordynator', 'szef_koordynatorow', 'dyrektor', 'superadmin']).order('full_name'),
    sb.from('hr_employees').select('coordinator_id').eq('archived', false).eq('candidate', false).not('coordinator_id', 'is', null),
  ]);
  if (users.error) return NextResponse.json({ error: users.error.message }, { status: 500 });
  const counts = new Map<string, number>();
  for (const e of emps.data || []) counts.set(e.coordinator_id, (counts.get(e.coordinator_id) || 0) + 1);
  const coordinators = (users.data || []).map((u: any) => ({
    id: u.id, name: u.full_name || u.id, role: u.role, assigned_count: counts.get(u.id) || 0,
  }));
  return NextResponse.json({ coordinators });
}
