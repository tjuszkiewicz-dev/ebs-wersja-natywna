// Wynagrodzenia koordynatorów za okres (zakładka Rozliczenia).
// GET ?period=YYYY-MM — koordynatorzy + stawka/typ/godziny/kwota + liczba pracowników.
// POST — upsert {user_id, period, rate, rate_type hourly|flat, hours, note} (tylko superadmin/dyrektor).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDIT_ROLES = ['superadmin', 'dyrektor'];
const r2 = (n: number) => Math.round(n * 100) / 100;
const payAmount = (row: { rate?: any; rate_type?: any; hours?: any; bonus?: any }) =>
  r2((row.rate_type === 'flat' ? Number(row.rate || 0) : Number(row.rate || 0) * Number(row.hours || 0)) + Number(row.bonus || 0));

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const period = new URL(request.url).searchParams.get('period');
  if (!period) return NextResponse.json({ error: 'Brak okresu' }, { status: 400 });

  const sb = admin() as any;
  const [users, pays, emps] = await Promise.all([
    sb.from('user_profiles').select('id, full_name, role').in('role', ['koordynator', 'szef_koordynatorow', 'dyrektor', 'superadmin']).order('full_name'),
    sb.from('hr_coordinator_pay').select('*').eq('period', period),
    sb.from('hr_employees').select('coordinator_id').eq('archived', false).eq('candidate', false).not('coordinator_id', 'is', null),
  ]);
  if (users.error) return NextResponse.json({ error: users.error.message }, { status: 500 });

  const payMap = new Map((pays.data || []).map((p: any) => [p.user_id, p]));
  const counts = new Map<string, number>();
  for (const e of emps.data || []) counts.set(e.coordinator_id, (counts.get(e.coordinator_id) || 0) + 1);

  // pokazujemy koordynatorów + każdego, kto ma przypisanych pracowników lub wpis wynagrodzenia;
  // zwykły koordynator widzi TYLKO WŁASNE wynagrodzenie (szef koordynatorów i admini — wszystkich)
  const onlySelf = auth.role === 'koordynator';
  const rows = (users.data || [])
    .filter((u: any) => u.role === 'koordynator' || u.role === 'szef_koordynatorow' || counts.get(u.id) || payMap.get(u.id))
    .filter((u: any) => !onlySelf || u.id === auth.id)
    .map((u: any) => {
      const p: any = payMap.get(u.id);
      return {
        user: { id: u.id, name: u.full_name || u.id, role: u.role },
        assigned_count: counts.get(u.id) || 0,
        rate: Number(p?.rate || 0),
        rate_type: p?.rate_type === 'flat' ? 'flat' : 'hourly',
        hours: Number(p?.hours || 0),
        bonus: Number(p?.bonus || 0),
        note: p?.note || null,
        amount: payAmount(p || {}),
      };
    });

  return NextResponse.json({ period, rows, canEdit: EDIT_ROLES.includes(auth.role ?? '') });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !EDIT_ROLES.includes(auth.role ?? '')) return NextResponse.json({ error: 'Tylko administrator może ustawiać wynagrodzenia koordynatorów' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.user_id || !b?.period) return NextResponse.json({ error: 'Brak koordynatora/okresu' }, { status: 400 });
  const { data, error } = await (admin() as any).from('hr_coordinator_pay').upsert({
    user_id: b.user_id,
    period: b.period,
    rate: Math.max(0, Number(b.rate) || 0),
    rate_type: b.rate_type === 'flat' ? 'flat' : 'hourly',
    hours: Math.max(0, Number(b.hours) || 0),
    bonus: Math.max(0, Number(b.bonus) || 0),
    note: b.note?.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, amount: payAmount(data) });
}
