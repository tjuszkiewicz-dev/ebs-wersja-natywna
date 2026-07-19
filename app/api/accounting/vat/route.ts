// GET /api/accounting/vat?company_id=&year=&month= — rejestry VAT (widok pochodny)
// Sprzedaż: z faktur (wystawione+zapłacone+przeterminowane; bez szkiców i anulowanych),
// rozbicie na stawki z pozycji. Zakup: wpisy kosztowe (kwoty brutto — VAT naliczony
// wymaga rozbicia na fakturze zakupu; kolumna informacyjna).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess, r2 } from '@/lib/accounting/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const companyId = sp.get('company_id') || '';
  if (!(await companyAccess(auth, companyId))) return NextResponse.json({ error: 'Brak dostępu do firmy' }, { status: 403 });

  const year = /^\d{4}$/.test(sp.get('year') || '') ? sp.get('year')! : String(new Date().getFullYear());
  const month = /^\d{1,2}$/.test(sp.get('month') || '') ? String(sp.get('month')).padStart(2, '0') : null;
  const from = month ? `${year}-${month}-01` : `${year}-01-01`;
  const to = month
    ? (Number(month) === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`)
    : `${Number(year) + 1}-01-01`;

  const sb = admin() as any;
  const [{ data: invoices }, { data: costs }] = await Promise.all([
    sb.from('acc_invoices').select('id, number, issue_date, status, total_net, total_vat, total_gross, contractor:acc_contractors(name, nip)').eq('company_id', companyId).in('status', ['issued', 'paid', 'overdue']).gte('issue_date', from).lt('issue_date', to).order('issue_date'),
    sb.from('acc_entries').select('entry_date, category, description, contractor, invoice_number, amount').eq('company_id', companyId).eq('kind', 'cost').eq('source', 'manual').gte('entry_date', from).lt('entry_date', to).order('entry_date'),
  ]);

  // rozbicie stawek z pozycji (jedno zapytanie zbiorcze)
  const invIds = (invoices || []).map((i: any) => i.id);
  const { data: items } = invIds.length
    ? await sb.from('acc_invoice_items').select('invoice_id, vat_rate, net, vat, gross').in('invoice_id', invIds)
    : { data: [] as any[] };
  const byInv = new Map<string, Record<string, { net: number; vat: number }>>();
  for (const it of items || []) {
    const m = byInv.get(it.invoice_id) || {};
    const k = String(it.vat_rate);
    m[k] = { net: r2((m[k]?.net || 0) + Number(it.net)), vat: r2((m[k]?.vat || 0) + Number(it.vat)) };
    byInv.set(it.invoice_id, m);
  }

  const sales = (invoices || []).map((i: any) => ({
    date: i.issue_date, number: i.number, contractor: i.contractor?.name || null, nip: i.contractor?.nip || null,
    status: i.status, net: Number(i.total_net), vat: Number(i.total_vat), gross: Number(i.total_gross),
    rates: byInv.get(i.id) || {},
  }));
  const salesSums = sales.reduce((a, s) => ({ net: r2(a.net + s.net), vat: r2(a.vat + s.vat), gross: r2(a.gross + s.gross) }), { net: 0, vat: 0, gross: 0 });

  const purchases = (costs || []).map((c: any) => ({
    date: c.entry_date, number: c.invoice_number || null, contractor: c.contractor || null,
    description: c.description || c.category, gross: Number(c.amount),
  }));
  const purchasesSum = r2(purchases.reduce((a, p) => a + p.gross, 0));

  return NextResponse.json({ year, month, sales, sales_sums: salesSums, purchases, purchases_gross_sum: purchasesSum, vat_naleznny: salesSums.vat });
}
