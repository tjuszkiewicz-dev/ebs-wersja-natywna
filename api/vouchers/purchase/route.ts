// POST /api/vouchers/purchase — realizacja voucherów za usługę (pracownik)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const Schema = z.object({
  serviceId:   z.string().min(1).max(100),
  serviceName: z.string().min(1).max(200),
  amount:      z.number().int().positive().max(10_000),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'pracownik') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { serviceId, serviceName, amount } = parsed.data;
  const supabase = supabaseServer();

  const { data: account } = await supabase
    .from('voucher_accounts').select('balance').eq('user_id', auth.id).single();

  if (!account || account.balance < amount)
    return NextResponse.json({ error: `Niewystarczające środki (saldo: ${account?.balance ?? 0}, wymagane: ${amount}).` }, { status: 400 });

  const { data: voucherList, error: fetchErr } = await supabase
    .from('vouchers').select('id, serial_number')
    .eq('current_owner_id', auth.id).eq('status', 'distributed').limit(amount);

  if (fetchErr || !voucherList || voucherList.length < amount)
    return NextResponse.json({ error: `Brak voucherów do realizacji (dostępne: ${voucherList?.length ?? 0}).` }, { status: 400 });

  let redeemed = 0;
  const errors: string[] = [];

  for (const v of voucherList.slice(0, amount)) {
    const { error } = await supabase.rpc('redeem_voucher', {
      p_serial_number: v.serial_number,
      p_user_id:       auth.id,
      p_service_id:    serviceId,
      p_service_name:  serviceName,
    });
    if (error) errors.push(`${v.serial_number}: ${error.message}`);
    else redeemed++;
  }

  if (redeemed === 0)
    return NextResponse.json({ error: 'Nie udało się zrealizować żadnego vouchera.', errors }, { status: 500 });

  return NextResponse.json({ redeemed, serviceName, errors: errors.length ? errors : undefined });
}
