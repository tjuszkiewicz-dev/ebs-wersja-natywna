// GET  /api/hr/schedule?employeeId=&month=YYYY-MM — grafik pracownika na miesiąc
// POST  — zapis dnia (zmiana lub własne godziny); godziny liczone z czasu
// DELETE ?employeeId=&date=YYYY-MM-DD — usuń dzień
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function calcHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 1440; // przejście przez północ (np. zmiana III 22–6)
  return Math.round((mins / 60) * 100) / 100;
}
function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const month = searchParams.get('month');
  if (!employeeId || !month) return NextResponse.json({ error: 'Brak pracownika/miesiąca' }, { status: 400 });
  const { from, to } = monthRange(month);
  const { data, error } = await (admin() as any).from('hr_schedule')
    .select('*').eq('employee_id', employeeId).gte('work_date', from).lt('work_date', to).order('work_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const total = (data || []).reduce((a: number, r: any) => a + Number(r.hours || 0), 0);
  return NextResponse.json({ entries: data || [], total_hours: Math.round(total * 100) / 100 });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.employee_id || !b?.work_date) return NextResponse.json({ error: 'Brak pracownika/daty' }, { status: 400 });
  if (!b.start_time || !b.end_time) return NextResponse.json({ error: 'Brak godzin' }, { status: 400 });
  const hours = calcHours(b.start_time, b.end_time);
  const { data, error } = await (admin() as any).from('hr_schedule').upsert({
    employee_id: b.employee_id,
    work_date: b.work_date,
    shift: b.shift || null,
    start_time: b.start_time,
    end_time: b.end_time,
    hours,
    source: 'grafik',
    note: b.note?.trim() || null,
    created_by: auth.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'employee_id,work_date' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const date = searchParams.get('date');
  if (!employeeId || !date) return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
  const { error } = await (admin() as any).from('hr_schedule').delete().eq('employee_id', employeeId).eq('work_date', date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
