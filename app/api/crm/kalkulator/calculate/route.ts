// POST /api/crm/kalkulator/calculate — przelicza kalkulację ofertową, opcjonalnie zapisuje.
// Port z BBS-Unified (E7c). Adaptacje:
//  - bramka: `can(auth, 'crm.kalkulator')` zamiast listy ról zaszytej w kodzie
//    (w BBS: superadmin/partner/menedzer/dyrektor); brak dostępu → 403, nie 401.
//  - silnik podatkowy z `@/lib/agencja/tax-engine` — plik w plik ten sam co BBS-owy
//    `lib/crm/tax-engine`, więc nie duplikujemy go w repo.
//  - `calculator_configs` nie jest portowana (brak panelu do edycji) → DEFAULT_CONFIG.
//  - zapis idzie do `crm_calculations` (migracja 057), nie do `payroll_calculations`
//    — ta nazwa myliłaby się z listami płac agencji pracy.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';
import { obliczGlobalnie } from '@/lib/agencja/tax-engine/calculator';
import { DEFAULT_CONFIG } from '@/lib/agencja/tax-engine/constants';
import type { Firma, Pracownik, CalcConfig } from '@/lib/agencja/tax-engine/types';

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalkulator'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { firma, pracownicy, provisionPct, save, leadId } = body as {
    firma: Firma;
    pracownicy: Pracownik[];
    provisionPct?: number;
    save?: boolean;
    leadId?: string | null;
  };

  if (!firma || !Array.isArray(pracownicy) || pracownicy.length === 0) {
    return NextResponse.json({ error: 'firma i pracownicy są wymagani' }, { status: 400 });
  }

  const config: CalcConfig = DEFAULT_CONFIG;
  const provision = provisionPct ?? config.prowizja.standard;
  const wyniki = obliczGlobalnie(pracownicy, firma, provision, config);

  if (save) {
    const { error } = await (admin() as any).from('crm_calculations').insert({
      created_by: auth.id,
      lead_id: leadId ?? null,
      company_name: firma.nazwa,
      nip: firma.nip ?? null,
      period: firma.okres ?? null,
      employees: pracownicy,
      results: wyniki,
      config,
      provision_percent: provision,
      status: 'draft',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wyniki, config });
}
