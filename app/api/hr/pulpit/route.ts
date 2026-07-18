// GET /api/hr/pulpit — Pulpit Agencji: KPI + wszystkie alerty w jednym miejscu
// (dokumenty pracowników, braki PESEL/ZUS, kończące się najmy, flota, rozliczenia miesiąca).
// Koordynator widzi tylko swoich pracowników.
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { can } from '@/lib/permissions/server';
import { fullName } from '@/lib/hr/docPlaceholders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOC_FIELDS: [string, string][] = [
  ['passport_expiry', 'paszport'],
  ['visa_expiry', 'wiza'],
  ['residence_card_expiry', 'karta pobytu'],
  ['work_permit_expiry', 'pozwolenie na pracę'],
];

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await can(auth, 'agencja.pulpit'))) return NextResponse.json({ error: 'Brak dostępu do Pulpitu Agencji' }, { status: 403 });
  const sb = admin() as any;
  const isCoord = auth.role === 'koordynator';

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const leaseSoon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const period = today.slice(0, 7);

  // pracownicy aktywni (+ scope koordynatora)
  let empQ = sb.from('hr_employees')
    .select('id, first_name, second_name, last_name, second_last_name, pesel, zus_registration_date, passport_expiry, visa_expiry, residence_card_expiry, work_permit_expiry, coordinator_id, contract:hr_contracts(name)')
    .eq('archived', false).eq('candidate', false);
  if (isCoord) empQ = empQ.eq('coordinator_id', auth.id);

  let candQ = sb.from('hr_employees').select('id', { count: 'exact', head: true }).eq('archived', false).eq('candidate', true);
  if (isCoord) candQ = candQ.eq('submitted_by', auth.id);

  const [{ data: emps }, { count: kandydaci }, { data: accs }, { data: vehicles }, settle, adv, pay] = await Promise.all([
    empQ,
    candQ,
    isCoord ? Promise.resolve({ data: [] as any[] }) : sb.from('hr_accommodations').select('name, lease_end_date, hr_employees(count)').not('lease_end_date', 'is', null).lte('lease_end_date', leaseSoon).order('lease_end_date'),
    isCoord ? Promise.resolve({ data: [] as any[] }) : sb.from('hr_vehicles').select('make, model, registration, insurance_until, inspection_until, license_expiry, license_name, main_user_name, driver_name').neq('status', 'wycofany'),
    sb.from('hr_settlements').select('employee_id, rate, rate_type, hours, bonus').eq('period', period),
    sb.from('hr_advances').select('amount').eq('period', period),
    sb.from('hr_payouts').select('amount').eq('period', period),
  ]);

  // alerty dokumentów + braki
  const docList: { name: string; contract: string; what: string; date: string; expired: boolean }[] = [];
  let bezPesel = 0, bezZus = 0;
  for (const e of emps || []) {
    if (!(e as any).pesel) bezPesel++;
    if (!(e as any).zus_registration_date) bezZus++;
    for (const [f, label] of DOC_FIELDS) {
      const v = (e as any)[f];
      if (v && v <= soon) docList.push({ name: fullName(e), contract: (e as any).contract?.name || '—', what: label, date: v, expired: v < today });
    }
  }
  docList.sort((a, b) => a.date.localeCompare(b.date));
  const wygasle = docList.filter(d => d.expired).length;

  // flota
  const VEH: [string, string][] = [['insurance_until', 'OC'], ['inspection_until', 'przegląd'], ['license_expiry', 'prawo jazdy']];
  const fleet: { vehicle: string; what: string; date: string; expired: boolean }[] = [];
  for (const v of vehicles || []) {
    const label = [(v as any).make, (v as any).model].filter(Boolean).join(' ') + ((v as any).registration ? ` (${(v as any).registration})` : '');
    for (const [f, what] of VEH) { const val = (v as any)[f]; if (val && val <= soon) fleet.push({ vehicle: label || '—', what, date: val, expired: val < today }); }
  }
  fleet.sort((a, b) => a.date.localeCompare(b.date));

  // rozliczenia miesiąca
  const n = (x: any) => Number(x || 0);
  const brutto = (settle.data || []).reduce((a: number, s: any) => a + (s.rate_type === 'monthly' ? n(s.rate) : n(s.rate) * n(s.hours)) + n(s.bonus), 0);
  const zaliczki = (adv.data || []).reduce((a: number, x: any) => a + n(x.amount), 0);
  const wyplacono = (pay.data || []).reduce((a: number, x: any) => a + n(x.amount), 0);
  const r2 = (x: number) => Math.round(x * 100) / 100;

  return NextResponse.json({
    pracownicy: { aktywni: (emps || []).length, kandydaci: kandydaci || 0 },
    dokumenty: { wygasle, wkrotce: docList.length - wygasle, bez_pesel: bezPesel, bez_zus: bezZus, lista: docList.slice(0, 10) },
    najmy: (accs || []).map((a: any) => ({ name: a.name, date: a.lease_end_date, people: a.hr_employees?.[0]?.count ?? 0 })),
    flota: { liczba: fleet.length, alerty: fleet.slice(0, 10) },
    rozliczenia: { period, rozliczonych: (settle.data || []).length, brutto: r2(brutto), zaliczki: r2(zaliczki), wyplacono: r2(wyplacono), pozostalo: r2(brutto - zaliczki - wyplacono) },
    scope: isCoord ? 'koordynator' : 'all',
  });
}
