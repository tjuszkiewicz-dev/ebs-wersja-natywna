// POST /api/vouchers/simulate-expiration — symulacja wygaśnięcia (superadmin only)
// Przenosi distributed vouchery do buyback_pending dla max 5 pracowników.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function POST(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  // Pobierz distributed vouchery (maks 5 unikalnych właścicieli)
  const { data: vouchers, error } = await supabase
    .from('vouchers')
    .select('id, current_owner_id, company_id')
    .eq('status', 'distributed')
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!vouchers || vouchers.length === 0)
    return NextResponse.json({ message: 'Brak rozdanych voucherów do wygaszenia.' });

  // Wybierz do 5 unikalnych właścicieli
  const ownerMap = new Map<string, typeof vouchers>();
  for (const v of vouchers) {
    if (!v.current_owner_id) continue;
    if (!ownerMap.has(v.current_owner_id)) ownerMap.set(v.current_owner_id, []);
    ownerMap.get(v.current_owner_id)!.push(v);
    if (ownerMap.size >= 5) break;
  }

  if (ownerMap.size === 0) return NextResponse.json({ message: 'Brak przypisanych voucherów.' });

  const agreements: any[] = [];

  for (const [ownerId, ownerVouchers] of ownerMap) {
    const ids = ownerVouchers.map(v => v.id);

    // Ustaw status na buyback_pending
    await supabase.from('vouchers').update({ status: 'buyback_pending' }).in('id', ids);

    // Pobierz dane właściciela
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, pesel, iban')
      .eq('id', ownerId)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(ownerId);
    const email = authUser?.user?.email ?? '';

    const count = ids.length;
    const agreementId = `UMOWA-ODKUP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const { data: inserted } = await supabase.from('buyback_agreements').insert({
      user_id:         ownerId,
      voucher_count:   count,
      total_value_pln: count,
      status:          'pending_approval',
      snapshot: {
        user: {
          name:  profile?.full_name ?? 'Nieznany',
          email,
          pesel: profile?.pesel ?? '',
          iban:  profile?.iban  ?? '',
        },
        vouchers:     ids,
        termsVersion: '1.0',
      } as unknown,
    }).select('id').single();

    const dbAgreementId = inserted?.id ?? agreementId;

    // Powiadom pracownika
    await supabase.from('notifications').insert({
      user_id: ownerId,
      message: `Twoje vouchery (${count} szt.) wygasły. Wygenerowano umowę odkupu.`,
      type:    'WARNING',
    });

    agreements.push({ agreementId: dbAgreementId, userId: ownerId, count });
  }

  return NextResponse.json({ expiredOwners: agreements.length, agreements });
}
