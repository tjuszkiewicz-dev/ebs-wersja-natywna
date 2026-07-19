// GET /api/accounting/report?company_id=&year= — rachunek wyników po miesiącach roku
// (przychody, koszty ręczne + auto-składniki Agencji dla firmy hr_linked + amortyzacja).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess, r2 } from '@/lib/accounting/access';
import { assetState } from '@/lib/accounting/assets';
import { rentActiveInPeriod } from '@/lib/hr/rentShare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const companyId = sp.get('company_id') || '';
  if (!(await companyAccess(auth, companyId))) return NextResponse.json({ error: 'Brak dostępu do firmy' }, { status: 403 });
  const year = /^\d{4}$/.test(sp.get('year') || '') ? sp.get('year')! : String(new Date().getFullYear());

  const sb = admin() as any;
  const { data: comp } = await sb.from('acc_companies').select('hr_linked').eq('id', companyId).single();
  const hrLinked = !!comp?.hr_linked;
  const none = Promise.resolve({ data: [] as any[] });

  const [entries, adv, pay, coord, accs, assets] = await Promise.all([
    sb.from('acc_entries').select('entry_date, kind, amount, status').eq('company_id', companyId).gte('entry_date', `${year}-01-01`).lte('entry_date', `${year}-12-31`).neq('status', 'do_weryfikacji'),
    hrLinked ? sb.from('hr_advances').select('period, amount').like('period', `${year}-%`) : none,
    hrLinked ? sb.from('hr_payouts').select('period, amount').like('period', `${year}-%`) : none,
    hrLinked ? sb.from('hr_coordinator_pay').select('period, rate, rate_type, hours, bonus').like('period', `${year}-%`) : none,
    hrLinked ? sb.from('hr_accommodations').select('monthly_rent, available_from, lease_end_date, created_at') : none,
    sb.from('acc_fixed_assets').select('*').eq('company_id', companyId).eq('status', 'active'),
  ] as any[]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const period = `${year}-${String(i + 1).padStart(2, '0')}`;
    const from = `${period}-01`;
    const to = i === 11 ? `${Number(year) + 1}-01-01` : `${year}-${String(i + 2).padStart(2, '0')}-01`;

    const monthEntries = (entries.data || []).filter((e: any) => e.entry_date >= from && e.entry_date < to);
    const income = r2(monthEntries.filter((e: any) => e.kind === 'income').reduce((a: number, e: any) => a + Number(e.amount), 0));
    const manual = r2(monthEntries.filter((e: any) => e.kind === 'cost').reduce((a: number, e: any) => a + Number(e.amount), 0));

    const advances = r2((adv.data || []).filter((x: any) => x.period === period).reduce((a: number, x: any) => a + Number(x.amount || 0), 0));
    const payouts = r2((pay.data || []).filter((x: any) => x.period === period).reduce((a: number, x: any) => a + Number(x.amount || 0), 0));
    const coordinator = r2((coord.data || []).filter((x: any) => x.period === period).reduce((a: number, c: any) =>
      a + (c.rate_type === 'flat' ? Number(c.rate || 0) : Number(c.rate || 0) * Number(c.hours || 0)) + Number(c.bonus || 0), 0));
    const rents = r2((accs.data || [])
      .filter((a: any) => rentActiveInPeriod(a, from, to))
      .reduce((a: number, x: any) => a + Number(x.monthly_rent), 0));
    const amortization = r2((assets.data || []).reduce((a: number, x: any) => a + assetState(x, period).period_write, 0));

    const costs = r2(manual + advances + payouts + coordinator + rents + amortization);
    // miesiące po bieżącym = PROGNOZA (czynsze/amortyzacja projektowane w przyszłość) —
    // nie wliczamy ich do sum rocznych, żeby wynik roku pokazywał tylko to, co poniesione
    const future = period > new Date().toISOString().slice(0, 7);
    return { month: period, future, income, manual, advances, payouts, coordinator, rents, amortization, costs, result: r2(income - costs) };
  });

  const totals = months.filter(m => !m.future).reduce((t, m) => ({
    income: r2(t.income + m.income), manual: r2(t.manual + m.manual), advances: r2(t.advances + m.advances),
    payouts: r2(t.payouts + m.payouts), coordinator: r2(t.coordinator + m.coordinator), rents: r2(t.rents + m.rents),
    amortization: r2(t.amortization + m.amortization), costs: r2(t.costs + m.costs), result: r2(t.result + m.result),
  }), { income: 0, manual: 0, advances: 0, payouts: 0, coordinator: 0, rents: 0, amortization: 0, costs: 0, result: 0 });

  return NextResponse.json({ year, hr_linked: hrLinked, months, totals });
}
