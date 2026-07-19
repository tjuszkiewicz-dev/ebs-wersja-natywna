// GET /api/accounting/kpir?company_id=&year=&month= — Książka Przychodów i Rozchodów
// (widok POCHODNY: wpisy bilansu + zapłacone faktury sprzedaży; kolumny 1-16 KPiR).
// Mapowanie: przychody→kol.7, koszty: wynagrodzenia→kol.12, pozostałe→kol.13.
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
  const [{ data: entries }, { data: invoices }] = await Promise.all([
    sb.from('acc_entries').select('*').eq('company_id', companyId).gte('entry_date', from).lt('entry_date', to).neq('status', 'do_weryfikacji').order('entry_date'),
    sb.from('acc_invoices').select('*, contractor:acc_contractors(name, address, city, postal_code)').eq('company_id', companyId).eq('status', 'paid').gte('issue_date', from).lt('issue_date', to).order('issue_date'),
  ]);

  // wpisy income z source='faktura' pomijamy — te same kwoty reprezentują faktury (bez dubli)
  const rows: any[] = [];
  for (const inv of invoices || []) {
    rows.push({
      date: inv.issue_date, doc: inv.number,
      contractor: inv.contractor?.name || null,
      contractor_addr: [inv.contractor?.address, [inv.contractor?.postal_code, inv.contractor?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
      description: 'Sprzedaż — faktura VAT',
      col7_sprzedaz: Number(inv.total_net), col8_pozostale: 0, col12_wynagrodzenia: 0, col13_pozostale_wydatki: 0,
    });
  }
  for (const e of entries || []) {
    if (e.kind === 'deposit') continue;                       // kaucje = nie KPiR
    if (e.kind === 'income' && e.source === 'faktura') continue; // już z faktur
    if (e.category === 'vat_nalezny') continue;               // VAT to zobowiązanie wobec US, nie przychód podatkowy
    const base = {
      date: e.entry_date, doc: e.invoice_number || null, contractor: e.contractor || null, contractor_addr: null,
      description: e.description || e.category || (e.kind === 'income' ? 'Przychód' : 'Koszt'),
      col7_sprzedaz: 0, col8_pozostale: 0, col12_wynagrodzenia: 0, col13_pozostale_wydatki: 0,
    };
    if (e.kind === 'income') rows.push({ ...base, col8_pozostale: Number(e.amount) });
    else if (e.category === 'wynagrodzenia') rows.push({ ...base, col12_wynagrodzenia: Number(e.amount) });
    else rows.push({ ...base, col13_pozostale_wydatki: Number(e.amount) });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  rows.forEach((r, i) => { r.lp = i + 1; r.col9_przychod_razem = r2(r.col7_sprzedaz + r.col8_pozostale); r.col14_wydatki_razem = r2(r.col12_wynagrodzenia + r.col13_pozostale_wydatki); });

  const sums = rows.reduce((a, r) => ({
    col7: r2(a.col7 + r.col7_sprzedaz), col8: r2(a.col8 + r.col8_pozostale), col9: r2(a.col9 + r.col9_przychod_razem),
    col12: r2(a.col12 + r.col12_wynagrodzenia), col13: r2(a.col13 + r.col13_pozostale_wydatki), col14: r2(a.col14 + r.col14_wydatki_razem),
  }), { col7: 0, col8: 0, col9: 0, col12: 0, col13: 0, col14: 0 });

  return NextResponse.json({ year, month, rows, sums, dochod: r2(sums.col9 - sums.col14) });
}
