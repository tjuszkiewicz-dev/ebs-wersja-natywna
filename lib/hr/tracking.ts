// Automatyczna karta pracy z lokalizacji: ping z telefonu pracownika →
// geofence zakładu (promień hr_contracts.geofence_m od geokodowanego adresu) →
// wejście otwiera sesję pracy, wyjście (po karencji) zamyka i dopisuje godziny
// do grafiku (hr_schedule, source='gps' — NIE nadpisuje wpisów ręcznych koordynatora).

export const GRACE_MS = 10 * 60 * 1000;   // tyle poza strefą uznajemy za wyjście (krótkie GPS-owe skoki nie zamykają sesji)
export const MIN_SESSION_MS = 5 * 60 * 1000; // sesje krótsze niż 5 min ignorujemy (przejazd obok zakładu)

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

const hhmm = (d: Date) => d.toISOString().slice(11, 16); // UTC — spójnie w całym module

// suma godzin z zamkniętych sesji GPS danego dnia → upsert wiersza grafiku
async function writeDayToSchedule(sb: any, employeeId: string, workDate: string) {
  const { data: sessions } = await sb.from('hr_work_sessions')
    .select('started_at, ended_at').eq('employee_id', employeeId).eq('work_date', workDate).not('ended_at', 'is', null);
  const closed = (sessions || []).filter((s: any) => new Date(s.ended_at).getTime() - new Date(s.started_at).getTime() >= MIN_SESSION_MS);
  if (!closed.length) return;
  const totalH = closed.reduce((a: number, s: any) => a + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000, 0);
  const first = closed.reduce((m: any, s: any) => (!m || s.started_at < m ? s.started_at : m), null);
  const last = closed.reduce((m: any, s: any) => (!m || s.ended_at > m ? s.ended_at : m), null);

  // ręczny wpis koordynatora ma pierwszeństwo — GPS uzupełnia tylko puste dni i własne wpisy
  const { data: existing } = await sb.from('hr_schedule').select('id, source').eq('employee_id', employeeId).eq('work_date', workDate).maybeSingle();
  if (existing && existing.source && existing.source !== 'gps') return;
  await sb.from('hr_schedule').upsert({
    employee_id: employeeId, work_date: workDate,
    start_time: hhmm(new Date(first)), end_time: hhmm(new Date(last)),
    hours: Math.round(totalH * 100) / 100,
    source: 'gps', note: 'automatyczna karta pracy (lokalizacja)',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'employee_id,work_date' });
}

export interface PingOutcome {
  inside: boolean;
  distance_m: number | null;
  session_open: boolean;
  started_at?: string | null;
  event?: 'entered' | 'left' | null;
}

// przetworzenie pingu: aktualizacja sesji pracy wg pozycji względem strefy zakładu
export async function processPing(sb: any, employee: any, contract: any, lat: number, lng: number, at: Date): Promise<PingOutcome> {
  const hasZone = contract && contract.lat != null && contract.lng != null;
  const dist = hasZone ? haversineM(lat, lng, Number(contract.lat), Number(contract.lng)) : null;
  const inside = hasZone ? dist! <= Number(contract.geofence_m ?? 1000) : false;

  const { data: open } = await sb.from('hr_work_sessions')
    .select('*').eq('employee_id', employee.id).is('ended_at', null)
    .order('started_at', { ascending: false }).limit(1).maybeSingle();

  let event: PingOutcome['event'] = null;
  let sessionOpen = !!open;
  let startedAt: string | null = open?.started_at ?? null;

  if (inside) {
    if (!open) {
      const { data: created } = await sb.from('hr_work_sessions').insert({
        employee_id: employee.id, contract_id: contract?.id ?? null,
        work_date: at.toISOString().slice(0, 10),
        started_at: at.toISOString(), last_inside_at: at.toISOString(),
      }).select().single();
      sessionOpen = true; startedAt = created?.started_at ?? at.toISOString(); event = 'entered';
    } else {
      await sb.from('hr_work_sessions').update({ last_inside_at: at.toISOString() }).eq('id', open.id);
    }
  } else if (open) {
    // poza strefą: zamykamy dopiero po karencji, końcem sesji jest OSTATNI moment w strefie
    if (at.getTime() - new Date(open.last_inside_at).getTime() > GRACE_MS) {
      await sb.from('hr_work_sessions').update({ ended_at: open.last_inside_at }).eq('id', open.id);
      await writeDayToSchedule(sb, employee.id, open.work_date);
      sessionOpen = false; startedAt = null; event = 'left';
    }
  }

  return { inside, distance_m: dist, session_open: sessionOpen, started_at: startedAt, event };
}
