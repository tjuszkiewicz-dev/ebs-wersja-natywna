// GET /api/crm/offers?leadId=... — oferty wygenerowane dla leada (albo 50 najnowszych).
//
// NIE jest to port — w BBS-Unified tego endpointu NIE MA. `DetailsPanel` i `ActivityPanel`
// (port 1:1 z E7a) wołają go od początku i degradują się cicho (`r.ok ? … : { offers: [] }`),
// więc w BBS sekcja „Oferty" w panelu leada jest po prostu zawsze pusta. W EBS domykamy
// pętlę: kalkulator generuje ofertę → oferta jest widoczna przy leadzie.
//
// Kontrakt wymuszony przez istniejące komponenty: odpowiedź `{ offers: [...] }`.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, applyVisibilityFilter, admin } from '@/lib/crm/visibility';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  // Oferty widzi każdy, kto ma dostęp do pipeline'u — panel leada jest ich miejscem.
  if (!auth || !(await can(auth, 'crm.pipeline'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const leadId = new URL(req.url).searchParams.get('leadId');

  let query = (admin() as any)
    .from('crm_offers')
    .select(
      'id, lead_id, created_by, company_name, company_nip, employees_count, provision_pct, ' +
      'total_savings_monthly, total_savings_yearly, net_savings_monthly, pdf_url, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (leadId) query = query.eq('lead_id', leadId);

  query = applyVisibilityFilter(query, await getVisibleUserIds(auth.id, auth.role), false, 'created_by');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ offers: data ?? [] });
}
