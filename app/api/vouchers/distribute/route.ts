// POST /api/vouchers/distribute — przekaż vouchery pojedynczemu pracownikowi

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const DistributeSchema = z.object({
  employeeId: z.string().uuid(),
  amount:     z.number().int().positive().max(50_000),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = DistributeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { employeeId, amount } = parsed.data;
  const supabase = supabaseServer();

  // Pobierz company_id z profilu HR server-side (migracja 004)
  const { data: hrProfileData } = await supabase
    .from('user_profiles')
    .select('full_name, company_id')
    .eq('id', auth.id)
    .single();
  const companyId = hrProfileData?.company_id ?? null;

  // Sprawdź saldo HR
  const { data: account } = await supabase
    .from('voucher_accounts')
    .select('balance')
    .eq('user_id', auth.id)
    .single();

  if (!account || account.balance < amount) {
    return NextResponse.json({
      error: `Niewystarczające saldo. Masz ${account?.balance ?? 0} pkt, próbujesz przekazać ${amount}.`,
    }, { status: 400 });
  }

  // Przesuń fizyczne rekordy voucherów do pracownika (aktualizuje current_owner_id + saldo)
  const { error: transferError } = await supabase.rpc('distribute_to_employee', {
    p_company_id:   companyId ?? auth.id,
    p_from_user_id: auth.id,
    p_to_user_id:   employeeId,
    p_amount:       amount,
    p_order_id:     null,
  });

  if (transferError) {
    return NextResponse.json({ error: transferError.message }, { status: 500 });
  }

  // Pobierz dane pracownika do protokołu (dane HR mamy już z hrProfileData)
  const { data: employeeProfile } = await supabase
    .from('user_profiles').select('full_name').eq('id', employeeId).single();

  // Utwórz protokół dystrybucji
  const batchId = `PROTOCOL-S-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await supabase.from('distribution_batches').insert({
    id:           batchId,
    company_id:   companyId ?? null,
    hr_user_id:   auth.id,
    hr_name:      hrProfileData?.full_name ?? auth.email,
    total_amount: amount,
    status:       'completed',
  });
  await supabase.from('distribution_batch_items').insert({
    batch_id:  batchId,
    user_id:   employeeId,
    user_name: employeeProfile?.full_name ?? employeeId.slice(0, 8),
    amount,
  });

  // Powiadomienie dla pracownika
  await supabase.from('notifications').insert({
    user_id: employeeId,
    message: `Otrzymałeś ${amount} nowych voucherów!`,
    type:    'SUCCESS',
  });

  return NextResponse.json({ distributed: true, batchId });
}
