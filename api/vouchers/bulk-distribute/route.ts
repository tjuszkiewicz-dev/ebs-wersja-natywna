// POST /api/vouchers/bulk-distribute — masowe przekazanie voucherów (lista dystrybucyjna)
// Jeden protokół dla całej listy.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const BulkDistributeSchema = z.object({
  items: z.array(z.object({
    employeeId: z.string().uuid(),
    amount:     z.number().int().positive().max(50_000),
  })).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = BulkDistributeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items } = parsed.data;
  const totalNeeded = items.reduce((acc, i) => acc + i.amount, 0);
  const supabase = supabaseServer();

  // Pobierz company_id i dane HR z profilu server-side (migracja 004)
  const { data: hrProfileData } = await supabase
    .from('user_profiles')
    .select('full_name, company_id')
    .eq('id', auth.id)
    .single();
  const companyId = hrProfileData?.company_id ?? null;

  // Sprawdź saldo
  const { data: account } = await supabase
    .from('voucher_accounts')
    .select('balance')
    .eq('user_id', auth.id)
    .single();

  if (!account || account.balance < totalNeeded) {
    return NextResponse.json({
      error: `Niewystarczające saldo. Masz ${account?.balance ?? 0} pkt, potrzebujesz ${totalNeeded}.`,
    }, { status: 400 });
  }
  const batchId = `PROTOCOL-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const batchItems: { batch_id: string; user_id: string; user_name: string; amount: number }[] = [];
  const errors: string[] = [];
  let distributedTotal = 0;

  for (const item of items) {
    const { error: transferError } = await supabase.rpc('transfer_vouchers', {
      p_from_user_id: auth.id,
      p_to_user_id:   item.employeeId,
      p_amount:       item.amount,
      p_type:         'przekazanie',
      p_order_id:     null,
    });

    if (transferError) {
      errors.push(`${item.employeeId}: ${transferError.message}`);
      continue;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', item.employeeId)
      .single();

    batchItems.push({
      batch_id:  batchId,
      user_id:   item.employeeId,
      user_name: profile?.full_name ?? item.employeeId,
      amount:    item.amount,
    });
    distributedTotal += item.amount;

    await supabase.from('notifications').insert({
      user_id: item.employeeId,
      message: `Otrzymałeś ${item.amount} nowych voucherów (lista zbiorcza)!`,
      type:    'SUCCESS',
    });
  }

  // Zapisz protokół
  if (batchItems.length > 0) {
    await supabase.from('distribution_batches').insert({
      id:           batchId,
      company_id:   companyId,
      hr_user_id:   auth.id,
      hr_name:      hrProfileData?.full_name ?? auth.email ?? 'HR',
      total_amount: distributedTotal,
      status:       'completed',
    });
    await supabase.from('distribution_batch_items').insert(batchItems);
  }

  return NextResponse.json({
    distributed: distributedTotal,
    batchId:     batchItems.length > 0 ? batchId : null,
    errors,
  });
}
