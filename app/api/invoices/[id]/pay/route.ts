// PATCH /api/invoices/[id]/pay — oznacz dokument jako opłacony + emituj i dystrybuuj vouchery
// Superadmin lub pracodawca (tylko własne dokumenty). Po opłaceniu noty → mint_vouchers + distribute_to_employee.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { calculateAndSaveCommissions } from '@/lib/vouchers';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { id: docId } = await params;
  const now = new Date().toISOString();

  // Pobierz dokument
  const { data: doc, error: fetchErr } = await supabase
    .from('financial_documents')
    .select('id, status, linked_order_id, company_id, type')
    .eq('id', docId)
    .single();

  if (fetchErr || !doc) return NextResponse.json({ error: 'Dokument nie istnieje' }, { status: 404 });
  if (doc.status === 'paid') return NextResponse.json({ error: 'Dokument już oznaczony jako opłacony' }, { status: 409 });

  // Pracodawca może oznaczać tylko dokumenty swojej firmy
  if (auth.role === 'pracodawca') {
    const { data: hrProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    if (hrProfile?.company_id !== doc.company_id) {
      return NextResponse.json({ error: 'Forbidden — nie jesteś właścicielem tego dokumentu' }, { status: 403 });
    }
  }

  // Oznacz jako opłacony
  const { error: updateErr } = await supabase
    .from('financial_documents')
    .update({ status: 'paid', payment_confirmed_at: now, updated_at: now })
    .eq('id', docId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  let vouchersDistributed = 0;
  let orderId: string | null = doc.linked_order_id ?? null;

  // Sprawdź czy OBA dokumenty dla tego zamówienia są opłacone
  if (orderId) {
    const { data: allDocs } = await supabase
      .from('financial_documents')
      .select('status')
      .eq('linked_order_id', orderId);

    const allPaid = allDocs && allDocs.length > 0 && allDocs.every(d => d.status === 'paid');

    if (allPaid) {
      // Pobierz zamówienie
      const { data: order } = await supabase
        .from('voucher_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (order && order.status !== 'paid') {
        // 1. Oznacz zamówienie jako opłacone
        await supabase
          .from('voucher_orders')
          .update({ status: 'paid', updated_at: now })
          .eq('id', orderId);

        // 2. Emituj vouchery na konto HR
        const { error: mintErr } = await supabase.rpc('mint_vouchers', {
          p_order_id:     orderId,
          p_company_id:   order.company_id,
          p_owner_id:     order.hr_user_id,
          p_quantity:     order.amount_vouchers,
          p_valid_months: 12,
        });

        if (!mintErr) {
          // 3. Dystrybuuj do pracowników wg planu
          const planSource: any[] =
            (order.payroll_snapshots as any[] | null) ??
            (order.distribution_plan as any[] | null) ??
            [];

          const batchItems: { userId: string; userName: string; amount: number }[] = [];

          for (const entry of planSource) {
            const userId = entry.matched_user_id ?? entry.matchedUserId;
            const amount = Math.floor(entry.final_netto_voucher ?? entry.voucherPartNet ?? entry.amount ?? 0);
            if (!userId || amount <= 0) continue;

            const { data: distCount, error: transferErr } = await (supabase.rpc as any)('distribute_to_employee', {
              p_company_id:   order.company_id,
              p_from_user_id: order.hr_user_id,
              p_to_user_id:   userId,
              p_amount:       amount,
              p_order_id:     orderId,
            });

            if (transferErr) continue;
            const actual = Number(distCount) || amount;
            vouchersDistributed += actual;

            const { data: profile } = await supabase
              .from('user_profiles')
              .select('full_name')
              .eq('id', userId)
              .single();

            batchItems.push({ userId, userName: profile?.full_name ?? userId, amount: actual });

            // Powiadomienie dla pracownika
            await supabase.from('notifications').insert({
              user_id: userId,
              message: `Otrzymałeś ${actual} nowych voucherów od pracodawcy.`,
              type:    'SUCCESS',
            });
          }

          // 4. Zapisz protokół dystrybucji
          if (batchItems.length > 0) {
            const batchId = `PROTOCOL-PAY-${now.slice(0, 10)}-${orderId.slice(-8).toUpperCase()}`;
            const { error: batchErr } = await supabase
              .from('distribution_batches')
              .insert({
                id:           batchId,
                company_id:   order.company_id,
                hr_user_id:   order.hr_user_id,
                hr_name:      'System (Po opłaceniu noty)',
                total_amount: vouchersDistributed,
                order_id:     orderId,
                status:       'completed',
              });

            if (!batchErr) {
              await supabase
                .from('distribution_batch_items')
                .insert(batchItems.map(item => ({
                  batch_id:  batchId,
                  user_id:   item.userId,
                  user_name: item.userName,
                  amount:    item.amount,
                })));
            }
          }
        }

        // 5. Prowizje
        await calculateAndSaveCommissions(
          orderId,
          Number(order.fee_pln ?? 0),
          order.company_id,
          order.is_first_invoice ?? false,
        );
      }
    }
  }

  return NextResponse.json({
    paid: true,
    docId,
    linkedOrderId: orderId,
    vouchersDistributed,
  });
}

