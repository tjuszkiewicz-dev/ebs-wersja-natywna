// POST /api/me/location — ping lokalizacji z telefonu pracownika (co ~2 min).
// Zapisuje pozycję i prowadzi automatyczną kartę pracy: wejście w strefę zakładu
// (geofence kontraktu) otwiera sesję, wyjście (po karencji) zamyka i dopisuje
// godziny do grafiku. Zwraca stan (w strefie / sesja / godziny dziś).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { processPing } from '@/lib/hr/tracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'pracownik_tymczasowy') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Nieprawidłowa pozycja' }, { status: 400 });
  }
  const accuracy = Number.isFinite(Number(b.accuracy)) ? Math.round(Number(b.accuracy)) : null;

  const sb = admin();
  const { data: e } = await (sb as any).from('hr_employees')
    .select('id, contract:hr_contracts(id, lat, lng, geofence_m)')
    .eq('user_id', auth.id).maybeSingle();
  if (!e) return NextResponse.json({ error: 'Brak powiązanej kartoteki' }, { status: 404 });

  // anty-spam: przyjmujemy max 1 ping / 45 s
  const { data: last } = await (sb as any).from('hr_locations').select('at').eq('employee_id', e.id).order('at', { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.at).getTime() < 45_000) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  const now = new Date();
  const outcome = await processPing(sb, e, e.contract, lat, lng, now);
  await (sb as any).from('hr_locations').insert({ employee_id: e.id, lat, lng, accuracy, inside: outcome.inside, at: now.toISOString() });

  // godziny dziś (zamknięte sesje + otwarta do teraz)
  const today = now.toISOString().slice(0, 10);
  const { data: sessions } = await (sb as any).from('hr_work_sessions').select('started_at, ended_at').eq('employee_id', e.id).eq('work_date', today);
  const ms = (sessions || []).reduce((a: number, s: any) => a + (new Date(s.ended_at ?? now.toISOString()).getTime() - new Date(s.started_at).getTime()), 0);

  return NextResponse.json({
    ok: true, inside: outcome.inside, distance_m: outcome.distance_m,
    session_open: outcome.session_open, started_at: outcome.started_at,
    today_hours: Math.round((ms / 3600000) * 100) / 100,
    has_zone: !!(e.contract && (e.contract as any).lat != null),
  });
}
