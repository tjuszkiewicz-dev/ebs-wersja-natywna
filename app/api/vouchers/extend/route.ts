// POST /api/vouchers/extend
// Pracownik przedłuża wygasające vouchery (status EXPIRED → DISTRIBUTED, nowa valid_until)
// Musi być wywołane przed godz. 8:00 dnia wygaśnięcia

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function POST(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'pracownik') {
    return NextResponse.json({ error: 'Tylko pracownik może przedłużać vouchery' }, { status: 403 });
  }

  // Sprawdź czy jest przed 8:00
  const hour = new Date().getHours();
  if (hour >= 8) {
    return NextResponse.json(
      { error: 'Przedłużenie możliwe tylko do godziny 8:00 dnia wygaśnięcia' },
      { status: 400 }
    );
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

  // Use Supabase RPC so hour:minute are included
  let newValidUntil: string;
  const { data: computedUntil } = await (supabase.rpc as any)('compute_voucher_valid_until', {
    p_expiry_day:    expiryDay,
    p_expiry_hour:   expiryHour,
    p_expiry_minute: expiryMinute,
  });
  if (computedUntil) {
    newValidUntil = computedUntil as string;
  } else {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, expiryDay);
    newValidUntil = target.toISOString().slice(0, 10);
  }

  // Znajdź wygasłe vouchery należące do pracownika
  const { data: expired, error: vErr } = await supabase
    .from('vouchers')
    .select('id')
    .eq('current_owner_id', auth.id)
    .eq('status', 'expired');

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!expired || expired.length === 0) {
    return NextResponse.json({ error: 'Brak wygasłych voucherów do przedłużenia' }, { status: 400 });
  }

  const ids = expired.map((v: any) => v.id);

  // Zaktualizuj: expired → distributed + nowa valid_until
  const { error: updateErr } = await supabase
    .from('vouchers')
    .update({ status: 'distributed', valid_until: newValidUntil } as any)
    .in('id', ids);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    extended:      ids.length,
    newValidUntil,
  });
}
