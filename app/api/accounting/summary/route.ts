// GET /api/accounting/summary?period=YYYY-MM — bilans miesiąca (superadmin+dyrektor)
// Przychody i koszty = wpisy ręczne + AUTO z modułów:
//  - zaliczki (hr_advances) i wypłaty (hr_payouts) za okres,
//  - czynsze najmu (hr_accommodations.monthly_rent) lokali aktywnych w okresie.
// Kaucje (wpłacone, niezwrócone) pokazywane osobno — to zamrożone środki, nie koszt.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { rentSharePerPerson, rentActiveInPeriod } from '@/lib/hr/rentShare';
import { companyAccess } from '@/lib/accounting/access';
import { assetState } from '@/lib/accounting/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  const sp = new URL(request.url).searchParams;
  const companyId = sp.get('company_id');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // dostęp: członkostwo w firmie (multi-firma) LUB stare uprawnienie bilansu
  const viaCompany = companyId ? await companyAccess(auth, companyId) : null;
  if (!viaCompany && !(await can(auth, 'ksiegowosc.bilans'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = sp.get('period');
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: 'Brak okresu' }, { status: 400 });

  // auto-składniki Agencji (zaliczki/wypłaty/czynsze/koordynatorzy) tylko dla firmy hr_linked
  let hrLinked = true; // brak company_id = stary widok (Baltic)
  const sb = admin() as any;
  if (companyId) {
    const { data: comp } = await sb.from('acc_companies').select('hr_linked').eq('id', companyId).single();
    hrLinked = !!comp?.hr_linked;
  }

  const [y, m] = period.split('-').map(Number);
  const from = `${period}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  let entriesQ = sb.from('acc_entries').select('kind, category, amount, status').gte('entry_date', from).lt('entry_date', to);
  if (companyId) entriesQ = entriesQ.eq('company_id', companyId);
  const none = Promise.resolve({ data: [] as any[] });
  const [entries, adv, pay, acc, setl, coord, emp] = await Promise.all([
    entriesQ,
    hrLinked ? sb.from('hr_advances').select('amount').eq('period', period) : none,
    hrLinked ? sb.from('hr_payouts').select('amount').eq('period', period) : none,
    hrLinked ? sb.from('hr_accommodations').select('id, name, monthly_rent, deposit, deposit_returned, available_from, lease_end_date, created_at') : none,
    hrLinked ? sb.from('hr_settlements').select('housing_deduction, other_deduction').eq('period', period) : none,
    hrLinked ? sb.from('hr_coordinator_pay').select('rate, rate_type, hours, bonus').eq('period', period) : none,
    // pracownicy z przypisanym noclegiem → auto-udział w czynszu (koszt pracownika)
    hrLinked ? sb.from('hr_employees').select('id, accommodation:hr_accommodations(monthly_rent, rented_spots, capacity)').eq('archived', false).eq('candidate', false).not('accommodation_id', 'is', null) : none,
  ] as any[]);

  const sum = (rows: any[] | null, key = 'amount') => (rows || []).reduce((a, r) => a + Number(r[key] || 0), 0);

  const booked = (entries.data || []).filter((e: any) => e.status !== 'do_weryfikacji');
  const manualCosts = booked.filter((e: any) => e.kind === 'cost');
  const incomes = booked.filter((e: any) => e.kind === 'income');
  const pendingCount = (entries.data || []).filter((e: any) => e.status === 'do_weryfikacji').length;

  // koszty ręczne wg kategorii
  const byCategory: Record<string, number> = {};
  for (const e of manualCosts) {
    const c = e.category || 'inne';
    byCategory[c] = r2((byCategory[c] || 0) + Number(e.amount || 0));
  }

  // auto-czynsze: lokal aktywny w okresie („dostępny od" przed końcem, najem nie skończył się przed początkiem)
  const rents = (acc.data || [])
    .filter((a: any) => rentActiveInPeriod(a, from, to))
    .map((a: any) => ({ id: a.id, name: a.name, monthly_rent: Number(a.monthly_rent) }));

  const advances = r2(sum(adv.data));
  const payouts = r2(sum(pay.data));
  const rentsTotal = r2(sum(rents, 'monthly_rent'));
  const manualCostsTotal = r2(sum(manualCosts));
  const incomeTotal = r2(sum(incomes));

  // potrącenia od pracowników (mieszkanie + kary/inne z Rozliczeń) — pomniejszają
  // „pozostało do wypłaty", więc NIE odejmujemy ich drugi raz od kosztów;
  // pokazujemy osobno, żeby bilans się zliczał 1:1 z Rozliczeniami
  const dedHousing = r2(sum(setl.data, 'housing_deduction'));
  const dedOther = r2(sum(setl.data, 'other_deduction'));
  // auto-udział w czynszu: Σ (czynsz obiektu ÷ liczba miejsc) po pracownikach z noclegiem —
  // to część czynszu najmu odzyskiwana od pracowników (pomniejsza koszt netto najmu)
  const rentShareAuto = r2((emp.data || []).reduce((a: number, e: any) => a + rentSharePerPerson(e.accommodation), 0));

  // wynagrodzenia koordynatorów (godzinowe rate*hours lub jednorazowe rate, + premia) — KOSZT
  const coordinatorPay = r2((coord.data || []).reduce((a: number, c: any) =>
    a + (c.rate_type === 'flat' ? Number(c.rate || 0) : Number(c.rate || 0) * Number(c.hours || 0)) + Number(c.bonus || 0), 0));

  // kaucje: zamrożone przy lokalach (niezwrócone) — stan bieżący, nie per okres
  const depositsFrozen = r2(sum((acc.data || []).filter((a: any) => !a.deposit_returned && Number(a.deposit) > 0), 'deposit'));

  // amortyzacja środków trwałych firmy — odpis za TEN okres (liniowa) = auto-koszt
  let assetsQ = sb.from('acc_fixed_assets').select('*').eq('status', 'active');
  assetsQ = companyId ? assetsQ.eq('company_id', companyId) : assetsQ; // brak firmy = wszystkie (stary widok Baltic i tak ma 1 firmę)
  const { data: assets } = await assetsQ;
  const amortization = r2((assets || []).reduce((a: number, x: any) => a + assetState(x, period).period_write, 0));

  const costsTotal = r2(manualCostsTotal + advances + payouts + rentsTotal + coordinatorPay + amortization);

  return NextResponse.json({
    period,
    income: { total: incomeTotal, entries_count: incomes.length },
    costs: {
      total: costsTotal,
      manual: manualCostsTotal,
      by_category: byCategory,
      auto: {
        advances,   // zaliczki z Rozliczeń
        payouts,    // wypłaty z Rozliczeń
        rents: rentsTotal,
        rents_detail: rents,
        coordinator_pay: coordinatorPay,
        amortization,
        deductions: { rent_share: rentShareAuto, housing: dedHousing, other: dedOther, total: r2(rentShareAuto + dedHousing + dedOther) },
      },
    },
    result: r2(incomeTotal - costsTotal),
    deposits_frozen: depositsFrozen,
    pending_count: pendingCount,
  });
}
