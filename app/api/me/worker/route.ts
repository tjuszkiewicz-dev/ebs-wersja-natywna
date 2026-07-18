// GET /api/me/worker?month=YYYY-MM — portal pracownika tymczasowego:
// jego dane z kartoteki, dokumenty (signed URLs), rozliczenia, grafik miesiąca,
// stan dzisiejszej sesji pracy (GPS) i limit tłumacza.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { rentSharePerPerson } from '@/lib/hr/rentShare';
import { consumeTranslator } from '@/lib/hr/translatorLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'pracownik_tymczasowy') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin();
  const { data: e } = await (sb as any).from('hr_employees')
    .select('*, contract:hr_contracts(id, name, address, geofence_m, lat, lng), accommodation:hr_accommodations(id, name, address, monthly_rent, rented_spots, capacity)')
    .eq('user_id', auth.id).maybeSingle();
  if (!e) return NextResponse.json({ error: 'Brak powiązanej kartoteki — zgłoś się do koordynatora' }, { status: 404 });

  const month = /^\d{4}-\d{2}$/.test(String(new URL(request.url).searchParams.get('month') || ''))
    ? new URL(request.url).searchParams.get('month')!
    : new Date().toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const today = new Date().toISOString().slice(0, 10);

  const [docs, sched, setl, adv, pay, openSession, todaySessions, limit] = await Promise.all([
    (sb as any).from('hr_documents').select('id, filename, content_type, size, created_at, path').eq('employee_id', e.id).order('created_at', { ascending: false }),
    (sb as any).from('hr_schedule').select('work_date, shift, start_time, end_time, hours, source, note').eq('employee_id', e.id).gte('work_date', from).lt('work_date', to).order('work_date'),
    (sb as any).from('hr_settlements').select('*').eq('employee_id', e.id).order('period', { ascending: false }).limit(12),
    (sb as any).from('hr_advances').select('period, amount').eq('employee_id', e.id),
    (sb as any).from('hr_payouts').select('period, amount').eq('employee_id', e.id),
    (sb as any).from('hr_work_sessions').select('started_at, work_date').eq('employee_id', e.id).is('ended_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    (sb as any).from('hr_work_sessions').select('started_at, ended_at').eq('employee_id', e.id).eq('work_date', today),
    consumeTranslator(auth, 0),
  ] as any[]);

  // dokumenty z podpisanymi linkami (1h)
  const documents = await Promise.all((docs.data || []).map(async (d: any) => {
    const { data: s } = await sb.storage.from('hr-documents').createSignedUrl(d.path, 3600);
    return { id: d.id, filename: d.filename, content_type: d.content_type, size: d.size, created_at: d.created_at, url: s?.signedUrl ?? null };
  }));

  // rozliczenia: ta sama arytmetyka co w panelu koordynatora
  const sumBy = (rows: any[] | null, period: string) => (rows || []).filter(r => r.period === period).reduce((a, r) => a + Number(r.amount || 0), 0);
  const rentShare = rentSharePerPerson(e.accommodation);
  const settlements = (setl.data || []).map((s: any) => {
    const gross = s.rate_type === 'monthly' ? Number(s.rate || 0) : Number(s.rate || 0) * Number(s.hours || 0);
    const advances = sumBy(adv.data, s.period);
    const payouts = sumBy(pay.data, s.period);
    const remaining = gross + Number(s.bonus || 0) - advances - payouts - rentShare - Number(s.housing_deduction || 0) - Number(s.other_deduction || 0);
    return {
      period: s.period, rate: s.rate, rate_type: s.rate_type, hours: s.hours, bonus: s.bonus,
      gross: Math.round(gross * 100) / 100, advances, payouts, rent_share: rentShare,
      housing_deduction: s.housing_deduction, other_deduction: s.other_deduction,
      remaining: Math.round(remaining * 100) / 100,
    };
  });

  const todayMs = (todaySessions.data || []).reduce((a: number, s: any) =>
    a + (new Date(s.ended_at ?? new Date().toISOString()).getTime() - new Date(s.started_at).getTime()), 0);

  return NextResponse.json({
    employee: {
      id: e.id, first_name: e.first_name, second_name: e.second_name, last_name: e.last_name, second_last_name: e.second_last_name,
      phone: e.phone, email: e.email, bank_account: e.bank_account, country_of_origin: e.country_of_origin,
      pesel: e.pesel, passport_number: e.passport_number, passport_expiry: e.passport_expiry,
      residence_card_number: e.residence_card_number, residence_card_expiry: e.residence_card_expiry,
      work_permit_number: e.work_permit_number, work_permit_expiry: e.work_permit_expiry,
      profession: e.profession, language: e.language,
      shoe_size: e.shoe_size, clothing_size: e.clothing_size,
      contract: e.contract ? { name: e.contract.name, address: e.contract.address, geofence_m: e.contract.geofence_m, has_zone: e.contract.lat != null } : null,
      accommodation: e.accommodation ? { name: e.accommodation.name, address: e.accommodation.address } : null,
    },
    documents,
    schedule: { month, entries: sched.data || [], total_hours: Math.round((sched.data || []).reduce((a: number, r: any) => a + Number(r.hours || 0), 0) * 100) / 100 },
    settlements,
    work_today: { session_open: !!openSession.data, started_at: openSession.data?.started_at ?? null, hours: Math.round((todayMs / 3600000) * 100) / 100 },
    translator: { limited: limit.limited, remaining_s: limit.remaining },
  });
}
