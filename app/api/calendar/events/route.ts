// GET  /api/calendar/events?from=ISO&to=ISO — wydarzenia, w których uczestniczę lub które utworzyłem
// POST /api/calendar/events — nowe wydarzenie
// Port z BBS-Unified (E7b). Adaptacje EBS:
//   * `adminWorkspace(request)` → `admin()` (brak warstwy workspace),
//   * `profilesMap` z `lib/crm/profiles` zamiast z `lib/chat/server` (czatu nie ma do E6a),
//   * `logEvent` usunięty — audyt idzie triggerami DB (`trg_audit_calendar_events`),
//   * **dołożona bramka uprawnień `crm.kalendarz`** — w BBS te route'y nie miały ŻADNEJ
//     bramki poza samym zalogowaniem, więc każdy użytkownik systemu widział moduł.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';
import { profilesMap } from '@/lib/crm/profiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sp = new URL(request.url).searchParams;
  const from = sp.get('from') || new Date(Date.now() - 32 * 86400000).toISOString();
  const to = sp.get('to') || new Date(Date.now() + 64 * 86400000).toISOString();

  const sb = admin() as any;
  // wydarzenia, w których jestem uczestnikiem
  const { data: att } = await sb.from('calendar_attendees').select('event_id').eq('user_id', auth.id);
  const myIds = (att || []).map((a: any) => a.event_id);

  let q = sb.from('calendar_events')
    .select('*, calendar_attendees(user_id)')
    .gte('starts_at', from)
    .lte('starts_at', to)
    .order('starts_at');
  q = myIds.length ? q.or(`created_by.eq.${auth.id},id.in.(${myIds.join(',')})`) : q.eq('created_by', auth.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((data || []).flatMap((e: any) => (e.calendar_attendees || []).map((a: any) => a.user_id)))];
  const profiles = await profilesMap(userIds as string[]);
  const events = (data || []).map((e: any) => ({
    id: e.id, title: e.title, description: e.description, starts_at: e.starts_at, ends_at: e.ends_at,
    all_day: e.all_day, location: e.location, source: e.source, conversation_id: e.conversation_id,
    mine: e.created_by === auth.id,
    attendees: (e.calendar_attendees || []).map((a: any) => ({ id: a.user_id, name: profiles.get(a.user_id)?.full_name || '—' })),
  }));
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const b = await request.json().catch(() => null);
  if (!b?.title?.trim() || !b?.starts_at) {
    return NextResponse.json({ error: 'Wymagany tytuł i termin' }, { status: 400 });
  }

  const sb = admin() as any;
  const { data: ev, error } = await sb.from('calendar_events').insert({
    title: String(b.title).trim().slice(0, 200),
    description: b.description?.trim() || null,
    starts_at: b.starts_at,
    ends_at: b.ends_at || null,
    all_day: !!b.all_day,
    location: b.location?.trim() || null,
    source: ['manual', 'meeting', 'ai'].includes(b.source) ? b.source : 'manual',
    conversation_id: b.conversation_id || null,
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set([auth.id, ...(Array.isArray(b.attendee_ids) ? b.attendee_ids : [])])].filter(Boolean);
  await sb.from('calendar_attendees').insert(ids.map((uid: string) => ({ event_id: ev.id, user_id: uid })));
  return NextResponse.json({ id: ev.id }, { status: 201 });
}
