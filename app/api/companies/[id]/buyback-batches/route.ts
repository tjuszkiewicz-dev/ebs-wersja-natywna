// GET  /api/companies/[id]/buyback-batches  — lista paczek przelewów dla firmy
// POST /api/companies/[id]/buyback-batches  — generuj nową paczkę (zbyte vouchery → BUYBACK_COMPLETE)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

type Params = { params: { id: string } };

// ─── GET — lista paczek ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: companyId } = params;
  if (auth.role !== 'superadmin' && auth.companyId !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('buyback_batches')
    .select(`
      id, period_label, total_amount, voucher_count, status, created_at,
      buyback_batch_items (
        id, full_name, iban, voucher_count, amount_pln
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ─── POST — generuj paczkę ────────────────────────────────────────────────────
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: companyId } = params;
  if (auth.role !== 'superadmin' && auth.companyId !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();

  // 1. Pobierz vouchery BUYBACK_PENDING dla tej firmy
  const { data: pendingVouchers, error: vErr } = await supabase
    .from('vouchers')
    .select('id, owner_id, expiry_date')
    .eq('company_id', companyId)
    .eq('status', 'BUYBACK_PENDING');

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!pendingVouchers || pendingVouchers.length === 0) {
    return NextResponse.json({ error: 'Brak voucherów do zbycia' }, { status: 400 });
  }

  // 2. Grupuj po owner_id
  const grouped: Record<string, string[]> = {};
  for (const v of pendingVouchers) {
    if (!v.owner_id) continue;
    if (!grouped[v.owner_id]) grouped[v.owner_id] = [];
    grouped[v.owner_id].push(v.id);
  }

  const employeeIds = Object.keys(grouped);
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: 'Brak przypisanych właścicieli voucherów' }, { status: 400 });
  }

  // 3. Pobierz dane pracowników (imię, IBAN)
  const { data: profiles, error: pErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, iban')
    .in('id', employeeIds);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

  // 4. Buduj items i CSV
  const now = new Date();
  const periodLabel = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  const dateStr = now.toISOString().slice(0, 10);

  const items: Array<{
    employee_id: string;
    full_name: string;
    iban: string;
    voucher_count: number;
    amount_pln: number;
    voucher_ids: string[];
  }> = [];

  const csvLines = ['"Nazwa odbiorcy";"IBAN";"Kwota";"Tytuł przelewu";"Data"'];

  let totalAmount = 0;
  let totalVouchers = 0;

  for (const [empId, vIds] of Object.entries(grouped)) {
    const profile = profileMap.get(empId);
    if (!profile) continue;

    const fullName = profile.full_name ?? 'Nieznany pracownik';
    const iban = (profile as any).iban ?? '';
    const count = vIds.length;
    const amount = count * 1.0; // 1 voucher = 1 PLN
    const title = `Wykup voucherów ${periodLabel}`;

    items.push({
      employee_id: empId,
      full_name: fullName,
      iban,
      voucher_count: count,
      amount_pln: amount,
      voucher_ids: vIds,
    });

    const amountStr = amount.toFixed(2).replace('.', ',');
    csvLines.push(`"${fullName}";"${iban}";"${amountStr}";"${title}";"${dateStr}"`);

    totalAmount += amount;
    totalVouchers += count;
  }

  const csvContent = csvLines.join('\n');

  // 5. Utwórz rekord buyback_batch
  const { data: batch, error: bErr } = await supabase
    .from('buyback_batches')
    .insert({
      company_id:   companyId,
      created_by:   auth.userId,
      period_label: periodLabel,
      total_amount: totalAmount,
      voucher_count: totalVouchers,
      file_csv:     csvContent,
      status:       'generated',
    } as any)
    .select('id')
    .single();

  if (bErr || !batch) return NextResponse.json({ error: bErr?.message ?? 'Błąd tworzenia paczki' }, { status: 500 });

  // 6. Utwórz rekordy buyback_batch_items
  const itemRows = items.map(item => ({
    batch_id:     batch.id,
    employee_id:  item.employee_id,
    full_name:    item.full_name,
    iban:         item.iban,
    voucher_count: item.voucher_count,
    amount_pln:   item.amount_pln,
    voucher_ids:  item.voucher_ids,
  }));

  const { error: itemErr } = await supabase
    .from('buyback_batch_items')
    .insert(itemRows as any[]);

  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

  // 7. Zmień status voucherów → BUYBACK_COMPLETE
  const allVoucherIds = items.flatMap(i => i.voucher_ids);
  const { error: updateErr } = await supabase
    .from('vouchers')
    .update({ status: 'BUYBACK_COMPLETE' })
    .in('id', allVoucherIds);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    batchId:      batch.id,
    periodLabel,
    totalAmount,
    totalVouchers,
    csvContent,
    items: items.map(i => ({ fullName: i.full_name, iban: i.iban, voucherCount: i.voucher_count, amountPln: i.amount_pln })),
  });
}
