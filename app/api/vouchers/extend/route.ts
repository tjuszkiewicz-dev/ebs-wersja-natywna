// POST /api/vouchers/extend
// Pracownik przedłuża wygasające vouchery (status EXPIRED → DISTRIBUTED, nowa expiry_date)
// Musi być wywołane przed godz. 8:00 dnia wygaśnięcia

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

function nextExpiryDate(expiryDay: number): string {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), expiryDay);
  const targetDay = today.getDate() >= expiryDay
    ? new Date(today.getFullYear(), today.getMonth() + 1, expiryDay)
    : thisMonth;

  // Obsługa krótkiego miesiąca (np. dzień 31 w lutym → ostatni dzień miesiąca)
  const year = targetDay.getFullYear();
  const month = targetDay.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(expiryDay, lastDay);
  return new Date(year, month, day).toISOString().slice(0, 10);
}

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
    .eq('id', auth.userId)
    .single();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Brak przypisanej firmy' }, { status: 400 });
  }

  // Pobierz voucher_expiry_day firmy
  const { data: company } = await supabase
    .from('companies')
    .select('voucher_expiry_day')
    .eq('id', profile.company_id)
    .single();

  const expiryDay = (company as any)?.voucher_expiry_day ?? 10;
  const newExpiryDate = nextExpiryDate(expiryDay);

  // Znajdź vouchery EXPIRED należące do pracownika
  const { data: expired, error: vErr } = await supabase
    .from('vouchers')
    .select('id')
    .eq('owner_id', auth.userId)
    .eq('status', 'EXPIRED');

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!expired || expired.length === 0) {
    return NextResponse.json({ error: 'Brak wygasłych voucherów do przedłużenia' }, { status: 400 });
  }

  const ids = expired.map(v => v.id);

  // Zaktualizuj: EXPIRED → DISTRIBUTED + nowa expiry_date
  const { error: updateErr } = await supabase
    .from('vouchers')
    .update({ status: 'DISTRIBUTED', expiry_date: newExpiryDate } as any)
    .in('id', ids);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    extended: ids.length,
    newExpiryDate,
  });
}
