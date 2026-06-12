// GET  /api/companies/[id]/buyback-batches  — lista paczek przelewów dla firmy
// POST /api/companies/[id]/buyback-batches  — generuj nową paczkę (zbyte vouchery → BUYBACK_COMPLETE)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

// ─── GET — lista paczek ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params: __paramsP }: Params) {
  const params = await __paramsP;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: companyId } = params;
  if (auth.role !== 'superadmin' && auth.companyId !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer() as any;
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

// ─── Helpers: generate bank-specific file content ─────────────────────────────

type BatchItem = {
  full_name: string;
  iban: string;
  amount_pln: number;
  title: string;
  date: string;
};

function generateBatchFile(format: string, items: BatchItem[]): { content: string; ext: string } {
  switch (format) {
    case 'ing': {
      // ING Business Direct — polecenie przelewu CSV
      const lines = ['Numer rachunku odbiorcy;Kwota;Waluta;Tytuł przelewu;Nazwa odbiorcy'];
      for (const it of items) {
        const iban = it.iban.replace(/\s/g, '');
        lines.push(`${iban};${it.amount_pln.toFixed(2)};PLN;${it.title};${it.full_name}`);
      }
      return { content: lines.join('\r\n'), ext: '.csv' };
    }
    case 'pko': {
      // PKO BP Videotel — kwota w groszach, numer bez prefixu PL
      const lines = ['Numer rachunku;Kwota w groszach;Waluta;Tytuł;Nazwa odbiorcy'];
      for (const it of items) {
        const raw = it.iban.replace(/\s/g, '').replace(/^PL/i, '');
        const grosze = Math.round(it.amount_pln * 100);
        lines.push(`${raw};${grosze};PLN;${it.title};${it.full_name}`);
      }
      return { content: lines.join('\r\n'), ext: '.csv' };
    }
    case 'mbank': {
      // mBank MultiTransfer
      const lines = ['"nazwa odbiorcy";"numer rachunku";"kwota";"tytuł";"waluta"'];
      for (const it of items) {
        const iban = it.iban.replace(/\s/g, '');
        const amountStr = it.amount_pln.toFixed(2).replace('.', ',');
        lines.push(`"${it.full_name}";"${iban}";"${amountStr}";"${it.title}";"PLN"`);
      }
      return { content: lines.join('\r\n'), ext: '.csv' };
    }
    case 'santander': {
      // Santander Business CSV
      const lines = ['beneficiary_name;account_number;amount;currency;reference'];
      for (const it of items) {
        const iban = it.iban.replace(/\s/g, '');
        lines.push(`${it.full_name};${iban};${it.amount_pln.toFixed(2)};PLN;${it.title}`);
      }
      return { content: lines.join('\r\n'), ext: '.csv' };
    }
    default: {
      // standard — semicolon quoted CSV (universal)
      const lines = ['"Nazwa odbiorcy";"IBAN";"Kwota";"Tytuł przelewu";"Data"'];
      for (const it of items) {
        const amountStr = it.amount_pln.toFixed(2).replace('.', ',');
        lines.push(`"${it.full_name}";"${it.iban.replace(/\s/g, '')}";"${amountStr}";"${it.title}";"${it.date}"`);
      }
      return { content: lines.join('\r\n'), ext: '.csv' };
    }
  }
}

// ─── POST — generuj paczkę ────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params: __paramsP }: Params) {
  const params = await __paramsP;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: companyId } = params;
  if (auth.role !== 'superadmin' && auth.companyId !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body — format defaults to 'standard'
  const body = await req.json().catch(() => ({}));
  const format: string = typeof body?.format === 'string' ? body.format : 'standard';

  const supabase = supabaseServer() as any;

  // 1. Pobierz vouchery EXPIRED lub BUYBACK_PENDING dla tej firmy
  // Uwaga: expire_vouchers_and_create_buybacks ustawia status = 'expired',
  // nie 'buyback_pending' — musimy szukać obu statusów.
  const { data: pendingVouchers, error: vErr } = await supabase
    .from('vouchers')
    .select('id, current_owner_id, valid_until')
    .eq('company_id', companyId)
    .in('status', ['expired', 'buyback_pending']);

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!pendingVouchers || pendingVouchers.length === 0) {
    return NextResponse.json({ error: 'Brak voucherów do zbycia — żaden voucher nie ma statusu expired/buyback_pending' }, { status: 400 });
  }

  // 2. Grupuj po current_owner_id
  const grouped: Record<string, string[]> = {};
  for (const v of pendingVouchers) {
    if (!v.current_owner_id) continue;
    if (!grouped[v.current_owner_id]) grouped[v.current_owner_id] = [];
    grouped[v.current_owner_id].push(v.id);
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

  const profileMap: Map<string, any> = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // 4. Sprawdź brakujące IBANy — blokuj generowanie jeśli komuś brakuje
  const missingIban: string[] = [];
  for (const empId of employeeIds) {
    const profile = profileMap.get(empId);
    if (!profile?.iban || (profile.iban as string).trim() === '') {
      missingIban.push(profile?.full_name ?? empId);
    }
  }
  if (missingIban.length > 0) {
    return NextResponse.json({
      error: `Brak numeru IBAN dla ${missingIban.length} pracownik${missingIban.length === 1 ? 'a' : 'ów'}: ${missingIban.join(', ')}. Uzupełnij IBAN w kartotece pracowników.`,
      missingIban,
    }, { status: 422 });
  }

  // 5. Buduj items
  const now = new Date();
  const periodLabel = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  const dateStr = now.toISOString().slice(0, 10);
  const title = `Wykup voucherów ${periodLabel}`;

  const items: Array<{
    employee_id: string;
    full_name: string;
    iban: string;
    voucher_count: number;
    amount_pln: number;
    voucher_ids: string[];
  }> = [];

  let totalAmount = 0;
  let totalVouchers = 0;

  for (const [empId, vIds] of Object.entries(grouped)) {
    const profile = profileMap.get(empId);
    if (!profile) continue;

    const count = vIds.length;
    const amount = count * 1.0; // 1 voucher = 1 PLN

    items.push({
      employee_id: empId,
      full_name:   profile.full_name ?? 'Nieznany pracownik',
      iban:        profile.iban as string,
      voucher_count: count,
      amount_pln:  amount,
      voucher_ids: vIds,
    });

    totalAmount   += amount;
    totalVouchers += count;
  }

  // 6. Generuj plik w wybranym formacie
  const batchItems: BatchItem[] = items.map(i => ({
    full_name:  i.full_name,
    iban:       i.iban,
    amount_pln: i.amount_pln,
    title,
    date:       dateStr,
  }));
  const { content: fileContent, ext: fileExt } = generateBatchFile(format, batchItems);

  // 7. Utwórz rekord buyback_batch
  const { data: batch, error: bErr } = await supabase
    .from('buyback_batches')
    .insert({
      company_id:    companyId,
      created_by:    auth.id,
      period_label:  periodLabel,
      total_amount:  totalAmount,
      voucher_count: totalVouchers,
      file_csv:      fileContent,
      format,
      status:        'generated',
    } as any)
    .select('id')
    .single();

  if (bErr || !batch) return NextResponse.json({ error: bErr?.message ?? 'Błąd tworzenia paczki' }, { status: 500 });

  // 8. Utwórz rekordy buyback_batch_items
  const itemRows = items.map(item => ({
    batch_id:      batch.id,
    employee_id:   item.employee_id,
    full_name:     item.full_name,
    iban:          item.iban,
    voucher_count: item.voucher_count,
    amount_pln:    item.amount_pln,
    voucher_ids:   item.voucher_ids,
  }));

  const { error: itemErr } = await supabase
    .from('buyback_batch_items')
    .insert(itemRows as any[]);

  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

  // 9. Zmień status voucherów → BUYBACK_COMPLETE
  const allVoucherIds = items.flatMap(i => i.voucher_ids);
  const { error: updateErr } = await supabase
    .from('vouchers')
    .update({ status: 'buyback_complete' })
    .in('id', allVoucherIds);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    batchId:      batch.id,
    periodLabel,
    totalAmount,
    voucherCount: totalVouchers,
    csv:          fileContent,
    fileExt,
    format,
    items: items.map(i => ({ fullName: i.full_name, iban: i.iban, voucherCount: i.voucher_count, amountPln: i.amount_pln })),
  });
}
