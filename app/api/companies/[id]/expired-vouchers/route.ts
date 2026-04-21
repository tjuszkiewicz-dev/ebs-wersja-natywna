// GET /api/companies/[id]/expired-vouchers
// Zwraca mapę { [employeeId]: count } dla voucherów z danej firmy
// o statusie EXPIRED lub BUYBACK_PENDING — źródło prawdy dla zakładki "Anulowanie subskrypcji".

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

type Params = { params: { id: string } };

export interface ExpiredVoucherEmployee {
  employeeId: string;
  fullName:   string;
  count:      number;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: companyId } = params;
  if (auth.role !== 'superadmin' && auth.companyId !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();

  // Pobierz vouchery przeterminowane lub oczekujące na wykup dla tej firmy
  const { data: vouchers, error } = await supabase
    .from('vouchers')
    .select('id, owner_id, status')
    .eq('company_id', companyId)
    .in('status', ['EXPIRED', 'BUYBACK_PENDING']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!vouchers || vouchers.length === 0) return NextResponse.json([]);

  // Grupuj po owner_id
  const countByOwner = new Map<string, number>();
  for (const v of vouchers) {
    if (!v.owner_id) continue;
    countByOwner.set(v.owner_id, (countByOwner.get(v.owner_id) ?? 0) + 1);
  }

  if (countByOwner.size === 0) return NextResponse.json([]);

  // Pobierz imiona pracowników
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', [...countByOwner.keys()]);

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name as string]));

  const result: ExpiredVoucherEmployee[] = [...countByOwner.entries()].map(([empId, count]) => ({
    employeeId: empId,
    fullName:   profileMap.get(empId) ?? empId,
    count,
  }));

  return NextResponse.json(result);
}
