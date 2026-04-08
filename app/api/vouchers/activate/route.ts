// POST /api/vouchers/activate
// Pracownik aktywuje wygasłe vouchery (status expired → distributed, nowa valid_until).
// Brak ograniczeń czasowych — pracownik może aktywować w dowolnym momencie po wygaśnięciu.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

function nextExpiryDate(expiryDay: number): string {
  const today = new Date();
  const thisMonthExpiry = new Date(today.getFullYear(), today.getMonth(), expiryDay);
  const targetDate = today >= thisMonthExpiry
    ? new Date(today.getFullYear(), today.getMonth() + 1, expiryDay)
    : thisMonthExpiry;

  const year  = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(expiryDay, lastDay);
  return new Date(year, month, day).toISOString().slice(0, 10);
}

export async function POST(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'pracownik') {
    return NextResponse.json({ error: 'Tylko pracownik może aktywować vouchery' }, { status: 403 });
  }

  const supabase = supabaseServer();

  // Pobierz profil pracownika (company_id)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, company_id')
    .eq('id', auth.id)
    .single();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Brak przypisanej firmy' }, { status: 400 });
  }

  // Pobierz voucher_expiry_day + hour + minute firmy
  const { data: company } = await supabase
    .from('companies')
    .select('voucher_expiry_day, voucher_expiry_hour, voucher_expiry_minute')
    .eq('id', profile.company_id)
    .single();

  const expiryDay:    number = (company as any)?.voucher_expiry_day    ?? 10;
  const expiryHour:   number = (company as any)?.voucher_expiry_hour   ?? 0;
  const expiryMinute: number = (company as any)?.voucher_expiry_minute ?? 5;
  const newValidUntil = nextExpiryDate(expiryDay);

  // Znajdź wygasłe vouchery należące do pracownika
  const { data: expired, error: vErr } = await supabase
    .from('vouchers')
    .select('id')
    .eq('current_owner_id', auth.id)
    .eq('status', 'expired');

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!expired || expired.length === 0) {
    return NextResponse.json({ error: 'Brak wygasłych voucherów do aktywacji' }, { status: 400 });
  }

  const ids = expired.map((v: any) => v.id);

  // expired → distributed + nowa data ważności
  const { error: updateErr } = await supabase
    .from('vouchers')
    .update({ status: 'distributed', valid_until: newValidUntil } as any)
    .in('id', ids);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ activated: ids.length, newValidUntil, expiryHour, expiryMinute });
}
