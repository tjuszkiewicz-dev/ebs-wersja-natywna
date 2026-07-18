// GET /api/hr/settlements?period=YYYY-MM — rozliczenia pracowników za miesiąc
// POST — zapis stawki/godzin (upsert per pracownik+okres)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { rentSharePerPerson } from '@/lib/hr/rentShare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = new URL(request.url).searchParams.get('period');
  if (!period) return NextResponse.json({ error: 'Brak okresu' }, { status: 400 });

  const sb = admin() as any;
  // zakres miesiąca dla grafiku
  const [py, pm] = period.split('-').map(Number);
  const schedFrom = `${period}-01`;
  const schedTo = pm === 12 ? `${py + 1}-01-01` : `${py}-${String(pm + 1).padStart(2, '0')}-01`;

  const [emp, set, adv, pay, sched] = await Promise.all([
    sb.from('hr_employees').select('id, first_name, second_name, last_name, second_last_name, status, team, coordinator_id, contract:hr_contracts(id, name), accommodation:hr_accommodations(id, name, monthly_rent, rented_spots, capacity)').eq('archived', false).eq('candidate', false).order('last_name'),
    sb.from('hr_settlements').select('*').eq('period', period),
    sb.from('hr_advances').select('employee_id, amount').eq('period', period),
    sb.from('hr_payouts').select('employee_id, amount').eq('period', period),
    sb.from('hr_schedule').select('employee_id, hours').gte('work_date', schedFrom).lt('work_date', schedTo),
  ]);

  const setMap = new Map((set.data || []).map((s: any) => [s.employee_id, s]));
  const advMap = new Map<string, number>();
  for (const a of adv.data || []) advMap.set(a.employee_id, (advMap.get(a.employee_id) || 0) + Number(a.amount || 0));
  const payMap = new Map<string, number>();
  for (const p of pay.data || []) payMap.set(p.employee_id, (payMap.get(p.employee_id) || 0) + Number(p.amount || 0));
  const schedMap = new Map<string, number>();
  for (const s of sched.data || []) schedMap.set(s.employee_id, (schedMap.get(s.employee_id) || 0) + Number(s.hours || 0));

  // koordynator widzi w rozliczeniach tylko swoich pracowników
  const visibleEmp = auth.role === 'koordynator'
    ? (emp.data || []).filter((e: any) => e.coordinator_id === auth.id)
    : (emp.data || []);

  const rows = visibleEmp.map((e: any) => {
    const s: any = setMap.get(e.id);
    const rate = Number(s?.rate || 0);
    const rate_type = s?.rate_type || 'hourly';
    const hours = Number(s?.hours || 0);
    const gross = rate_type === 'monthly' ? rate : rate * hours;
    const advances = advMap.get(e.id) || 0;
    const payouts = payMap.get(e.id) || 0;
    const housing_deduction = Number(s?.housing_deduction || 0);
    const other_deduction = Number(s?.other_deduction || 0);
    const bonus = Number(s?.bonus || 0);
    // udział w czynszu noclegu = czynsz ÷ liczba miejsc — AUTO koszt pracownika
    const rent_share = rentSharePerPerson(e.accommodation);
    const remaining = Math.round((gross + bonus - advances - payouts - housing_deduction - other_deduction - rent_share) * 100) / 100;
    return {
      employee: { id: e.id, first_name: e.first_name, last_name: e.last_name, second_name: e.second_name, second_last_name: e.second_last_name, status: e.status, team: e.team, contract: e.contract },
      rate, rate_type, hours,
      gross: Math.round(gross * 100) / 100,
      advances, payouts, bonus, housing_deduction, other_deduction, other_note: s?.other_note || null,
      rent_share, accommodation_name: e.accommodation?.name || null,
      remaining,
      schedule_hours: Math.round((schedMap.get(e.id) || 0) * 100) / 100,
      note: s?.note || null,
    };
  });

  // koordynator: tylko podgląd rozliczeń (bez stawek/godzin/zaliczek/wypłat/potrąceń)
  return NextResponse.json({ period, rows, can_edit: auth.role !== 'koordynator' });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (auth.role === 'koordynator') return NextResponse.json({ error: 'Koordynator ma w rozliczeniach tylko podgląd' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.employee_id || !b?.period) return NextResponse.json({ error: 'Brak pracownika/okresu' }, { status: 400 });
  const { data, error } = await (admin() as any).from('hr_settlements').upsert({
    employee_id: b.employee_id,
    period: b.period,
    rate: Number(b.rate) || 0,
    rate_type: b.rate_type === 'monthly' ? 'monthly' : 'hourly',
    hours: Number(b.hours) || 0,
    bonus: Math.max(0, Number(b.bonus) || 0),
    housing_deduction: Math.max(0, Number(b.housing_deduction) || 0),
    other_deduction: Math.max(0, Number(b.other_deduction) || 0),
    other_note: b.other_note?.trim() || null,
    note: b.note?.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'employee_id,period' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
