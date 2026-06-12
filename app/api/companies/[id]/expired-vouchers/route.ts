// GET /api/companies/[id]/expired-vouchers
// Zwraca mapę { [employeeId]: count } dla voucherów z danej firmy
// o statusie EXPIRED lub BUYBACK_PENDING — źródło prawdy dla zakładki "Anulowanie subskrypcji".

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

export interface ExpiredVoucherEmployee {
  employeeId: string;
  fullName:   string;
  count:      number;
}

export async function GET(_req: NextRequest, { params: __paramsP }: Params) {
  const params = await __paramsP;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: companyId } = params;
  if (auth.role !== 'superadmin' && auth.companyId !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer() as any;

  // Próba 1: SQL RPC (migracja 036) — COUNT GROUP BY w bazie, 1 wiersz per pracownik.
  const { data: grouped, error: rpcErr } = await supabase
    .rpc('get_expired_vouchers_by_employee', { p_company_id: companyId });

  let countByOwner: Map<string, number>;

  if (!rpcErr && Array.isArray(grouped)) {
    countByOwner = new Map(grouped.map((r: any) => [r.employee_id, Number(r.voucher_count)]));
  } else {
    // Fallback: paginacja — pobiera po 1000 wierszy aż do wyczerpania.
    // Omija domyślny limit 1000 wierszy PostgREST bez nowej funkcji SQL.
    countByOwner = new Map();
    let offset = 0;
    while (true) {
      const { data: page, error: pageErr } = await supabase
        .from('vouchers')
        .select('current_owner_id')
        .eq('company_id', companyId)
        .in('status', ['expired', 'buyback_pending'])
        .not('current_owner_id', 'is', null)
        .range(offset, offset + 999);
      if (pageErr || !page?.length) break;
      for (const v of page) {
        countByOwner.set(v.current_owner_id, (countByOwner.get(v.current_owner_id) ?? 0) + 1);
      }
      if (page.length < 1000) break;
      offset += 1000;
    }
  }

  if (countByOwner.size === 0) return NextResponse.json([]);

  // Pobierz imiona pracowników
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', [...countByOwner.keys()]);

  const profileMap: Map<string, string> = new Map((profiles ?? []).map((p: any) => [p.id, String(p.full_name ?? '')]));

  const result: ExpiredVoucherEmployee[] = [...countByOwner.entries()].map(([empId, count]) => ({
    employeeId: empId,
    fullName:   profileMap.get(empId) || empId,
    count,
  }));

  return NextResponse.json(result);
}
