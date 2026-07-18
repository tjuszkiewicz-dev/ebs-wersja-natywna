// GET /api/hr/settlements/pdf?period=YYYY-MM — wydruk rozliczeń pracowników za miesiąc
// (te same reguły widoczności co GET settlements: koordynator widzi tylko swoich).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { rentSharePerPerson } from '@/lib/hr/rentShare';
import { fullName } from '@/lib/hr/docPlaceholders';
import { renderOfferPdfBatch } from '@/lib/pdf/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const money = (n: number) => Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = new URL(request.url).searchParams.get('period');
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: 'Brak okresu' }, { status: 400 });

  const sb = admin() as any;
  const [emp, set, adv, pay] = await Promise.all([
    sb.from('hr_employees').select('id, first_name, second_name, last_name, second_last_name, team, coordinator_id, contract:hr_contracts(name), accommodation:hr_accommodations(monthly_rent, rented_spots, capacity)').eq('archived', false).eq('candidate', false).order('last_name'),
    sb.from('hr_settlements').select('*').eq('period', period),
    sb.from('hr_advances').select('employee_id, amount').eq('period', period),
    sb.from('hr_payouts').select('employee_id, amount').eq('period', period),
  ]);
  const setMap = new Map((set.data || []).map((s: any) => [s.employee_id, s]));
  const sumBy = (rows: any[] | null) => { const m = new Map<string, number>(); for (const r of rows || []) m.set(r.employee_id, (m.get(r.employee_id) || 0) + Number(r.amount || 0)); return m; };
  const advMap = sumBy(adv.data), payMap = sumBy(pay.data);

  const visible = auth.role === 'koordynator' ? (emp.data || []).filter((e: any) => e.coordinator_id === auth.id) : (emp.data || []);
  const rows = visible.map((e: any) => {
    const s: any = setMap.get(e.id) || {};
    const gross = (s.rate_type === 'monthly' ? Number(s.rate || 0) : Number(s.rate || 0) * Number(s.hours || 0));
    const rentShare = rentSharePerPerson(e.accommodation);
    const remaining = gross + Number(s.bonus || 0) - (advMap.get(e.id) || 0) - (payMap.get(e.id) || 0) - Number(s.housing_deduction || 0) - Number(s.other_deduction || 0) - rentShare;
    return { name: fullName(e), contract: e.contract?.name || '—', team: e.team || '', rate: Number(s.rate || 0), type: s.rate_type === 'monthly' ? 'mies.' : 'godz.', hours: Number(s.hours || 0), gross, bonus: Number(s.bonus || 0), adv: advMap.get(e.id) || 0, pay: payMap.get(e.id) || 0, rentShare, housing: Number(s.housing_deduction || 0), other: Number(s.other_deduction || 0), remaining };
  });
  const t = rows.reduce((a, r) => ({ gross: a.gross + r.gross, bonus: a.bonus + r.bonus, adv: a.adv + r.adv, pay: a.pay + r.pay, rent: a.rent + r.rentShare, ded: a.ded + r.housing + r.other, rem: a.rem + r.remaining }), { gross: 0, bonus: 0, adv: 0, pay: 0, rent: 0, ded: 0, rem: 0 });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 8.5pt; color: #111; }
    h1 { font-size: 13pt; margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #bbb; padding: 3px 5px; }
    th { background: #f1f3f5; font-size: 7.5pt; text-transform: uppercase; text-align: left; }
    td.r, th.r { text-align: right; }
    tfoot td { font-weight: bold; background: #f8f9fa; }
  </style></head><body>
    <h1>Rozliczenia pracowników — ${esc(period)}</h1>
    <table>
      <thead><tr>
        <th>Pracownik</th><th>Kontrakt</th><th class="r">Stawka</th><th class="r">Godz.</th><th class="r">Brutto</th>
        <th class="r">Premia</th><th class="r">Zaliczki</th><th class="r">Wypłacono</th><th class="r">Nocleg −</th>
        <th class="r">Mieszkanie −</th><th class="r">Inne −</th><th class="r">Pozostało</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td>${esc(r.name)}</td><td>${esc(r.contract)}${r.team ? ' · ' + esc(r.team) : ''}</td>
          <td class="r">${money(r.rate)} (${r.type})</td><td class="r">${r.hours || ''}</td><td class="r">${money(r.gross)}</td>
          <td class="r">${r.bonus ? money(r.bonus) : ''}</td><td class="r">${r.adv ? money(r.adv) : ''}</td><td class="r">${r.pay ? money(r.pay) : ''}</td>
          <td class="r">${r.rentShare ? money(r.rentShare) : ''}</td><td class="r">${r.housing ? money(r.housing) : ''}</td><td class="r">${r.other ? money(r.other) : ''}</td>
          <td class="r"><strong>${money(r.remaining)}</strong></td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="4">Razem (${rows.length} os.)</td><td class="r">${money(t.gross)}</td><td class="r">${money(t.bonus)}</td>
        <td class="r">${money(t.adv)}</td><td class="r">${money(t.pay)}</td><td class="r">${money(t.rent)}</td>
        <td class="r" colspan="2">${money(t.ded)}</td><td class="r">${money(t.rem)}</td>
      </tr></tfoot>
    </table>
  </body></html>`;

  try {
    const [pdf] = await renderOfferPdfBatch([{ html }]);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Rozliczenia_${period}.pdf"` },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Render PDF: ${e?.message || e}` }, { status: 500 });
  }
}
