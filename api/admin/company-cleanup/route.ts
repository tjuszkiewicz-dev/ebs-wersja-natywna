// POST /api/admin/company-cleanup
// Czyści wszystkie dane transakcyjne dla konkretnej firmy (po company_id).
// Zachowuje: konto HR (user_profiles role=pracodawca), strukturę firmy (companies).
// Dostępny tylko dla superadmin.
//
// Wymaga jednorazowego wklejenia supabase/migrations/020_company_cleanup_fn.sql
// w Supabase Dashboard → SQL Editor żeby voucher_transactions też były czyszczone.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Wymagana rola superadmin' }, { status: 403 });
  }

  const { companyId } = await req.json();
  if (!companyId) {
    return NextResponse.json({ error: 'Brak companyId' }, { status: 400 });
  }

  const supabase = supabaseServer();

  // Próba 1: użyj funkcji SQL company_cleanup (omija trigger immutable przez SECURITY DEFINER)
  const { data: rpcData, error: rpcError } = await (supabase as any)
    .rpc('company_cleanup', { p_company_id: companyId });

  if (!rpcError && rpcData) {
    // Supabase zwraca JSONB bezpośrednio jako obiekt
    const result = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
    if (result?.ok) {
      return NextResponse.json({ ok: true, companyId, deleted: result.deleted });
    }
  }

  // Fallback: ręczne usuwanie bez voucher_transactions (trigger blokuje DELETE)
  const results: Record<string, number | string> = {};

  const del = async (table: string, field: string, value: string) => {
    const { error, count } = await (supabase as any)
      .from(table)
      .delete({ count: 'exact' })
      .eq(field, value);
    if (error) throw new Error(`${table}: ${error.message}`);
    results[table] = count ?? 0;
  };

  try {
    const { data: hrProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'pracodawca')
      .maybeSingle();

    const { data: empProfiles } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'pracownik');
    const empIds = (empProfiles ?? []).map((e: any) => e.id);
    const allUserIds = [...empIds, ...(hrProfile ? [hrProfile.id] : [])];

    await del('buyback_batches', 'company_id', companyId);
    await del('financial_documents', 'company_id', companyId);

    // voucher_transactions i voucher_orders są powiązane FK i trigger blokuje DELETE.
    // Bez funkcji SQL company_cleanup() nie można ich usunąć przez API.
    // Wklej supabase/migrations/020_company_cleanup_fn.sql w SQL Editor.
    results['voucher_transactions'] = 'pominięto — wklej 020_company_cleanup_fn.sql';
    results['voucher_orders']       = 'pominięto — wklej 020_company_cleanup_fn.sql';

    if (allUserIds.length > 0) {
      const { error: vaErr, count: vaCnt } = await (supabase as any)
        .from('voucher_accounts')
        .delete({ count: 'exact' })
        .in('user_id', allUserIds);
      if (vaErr) throw new Error(`voucher_accounts: ${vaErr.message}`);
      results['voucher_accounts'] = vaCnt ?? 0;
    } else {
      results['voucher_accounts'] = 0;
    }

    await del('vouchers', 'company_id', companyId);

    // voucher_orders pominięto (FK do voucher_transactions, trigger blokuje DELETE)

    const { error: empErr, count: empCnt } = await supabase
      .from('user_profiles')
      .delete({ count: 'exact' })
      .eq('company_id', companyId)
      .eq('role', 'pracownik');
    if (empErr) throw new Error(`user_profiles(pracownicy): ${empErr.message}`);
    results['pracownicy'] = empCnt ?? 0;

    return NextResponse.json({ ok: true, companyId, deleted: results });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

