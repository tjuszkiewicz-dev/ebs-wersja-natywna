// GET /api/crm/kalkulator/sessions — lista zapisanych kalkulacji (50 najnowszych).
// Port z BBS-Unified (E7c). Adaptacje: bramka `can(auth,'crm.kalkulator')` zamiast
// listy ról, brak dostępu → 403 (wzorzec EBS), tabela `crm_calculations` (migracja 057),
// oraz filtr widoczności — w BBS route oddawał kalkulacje WSZYSTKICH użytkowników
// każdemu, kto miał rolę CRM.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, applyVisibilityFilter, admin } from '@/lib/crm/visibility';

export async function GET(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalkulator'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const visibleIds = await getVisibleUserIds(auth.id, auth.role);

  let query = (admin() as any)
    .from('crm_calculations')
    .select('id, created_at, company_name, nip, period, provision_percent, status, lead_id')
    .order('created_at', { ascending: false })
    .limit(50);

  query = applyVisibilityFilter(query, visibleIds, false, 'created_by');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
