// GET /api/hr/map — Mapa Pracowników (koordynator / szef koordynatorów / admin):
// ostatnie pozycje telefonów pracowników (24h), stan sesji pracy (w pracy od…,
// wyszedł o…), strefy zakładów (kontrakty z geokodem + promień geofence).
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.mapa'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin() as any;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: employees }, { data: pings }, { data: sessions }, { data: contracts }] = await Promise.all([
    sb.from('hr_employees').select('id, first_name, last_name, phone, user_id, contract:hr_contracts(id, name)')
      .eq('archived', false).eq('candidate', false).not('user_id', 'is', null),
    sb.from('hr_locations').select('employee_id, lat, lng, accuracy, inside, at').gte('at', since).order('at', { ascending: false }).limit(5000),
    sb.from('hr_work_sessions').select('employee_id, started_at, last_inside_at, ended_at').eq('work_date', today),
    sb.from('hr_contracts').select('id, name, address, lat, lng, geofence_m').not('lat', 'is', null),
  ] as any[]);

  // ostatni ping per pracownik (pings są posortowane malejąco)
  const lastPing = new Map<string, any>();
  for (const p of pings || []) if (!lastPing.has(p.employee_id)) lastPing.set(p.employee_id, p);
  const openSession = new Map<string, any>();
  const lastEnded = new Map<string, any>();
  for (const s of sessions || []) {
    if (!s.ended_at) openSession.set(s.employee_id, s);
    else { const cur = lastEnded.get(s.employee_id); if (!cur || s.ended_at > cur.ended_at) lastEnded.set(s.employee_id, s); }
  }

  const workers = (employees || []).map((e: any) => {
    const p = lastPing.get(e.id);
    const open = openSession.get(e.id);
    const ended = lastEnded.get(e.id);
    return {
      id: e.id,
      name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
      phone: e.phone,
      contract: e.contract?.name ?? null,
      lat: p?.lat ?? null, lng: p?.lng ?? null, accuracy: p?.accuracy ?? null,
      inside: p?.inside ?? null, last_seen: p?.at ?? null,
      working_since: open?.started_at ?? null,
      left_at: !open && ended ? ended.ended_at : null,   // dziś wyszedł z zakładu o…
    };
  });

  return NextResponse.json({
    workers,
    zones: (contracts || []).map((c: any) => ({ id: c.id, name: c.name, address: c.address, lat: c.lat, lng: c.lng, radius_m: c.geofence_m ?? 1000 })),
    generated_at: new Date().toISOString(),
  });
}
