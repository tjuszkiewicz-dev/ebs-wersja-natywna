// PATCH / DELETE /api/calendar/events/[id] — edycja i usunięcie wydarzenia (twórca albo admin).
// Port z BBS-Unified (E7b). `logEvent` zastąpiony triggerem `trg_audit_calendar_events`;
// dołożona bramka `crm.kalendarz` (w BBS jej nie było).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['superadmin', 'dyrektor'];

async function loadOwn(id: string, auth: { id: string; role: string }) {
  const { data } = await (admin() as any).from('calendar_events').select('*').eq('id', id).single();
  if (!data) return null;
  if (data.created_by !== auth.id && !ADMIN_ROLES.includes(auth.role)) return null;
  return data;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const ev = await loadOwn(id, auth);
  if (!ev) return NextResponse.json({ error: 'Brak wydarzenia lub uprawnień' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const patch: any = {};
  for (const f of ['title', 'description', 'starts_at', 'ends_at', 'location'] as const) if (f in b) patch[f] = b[f] || null;
  if ('all_day' in b) patch.all_day = !!b.all_day;
  if (patch.title !== undefined && !String(patch.title || '').trim()) {
    return NextResponse.json({ error: 'Tytuł wymagany' }, { status: 400 });
  }

  const { error } = await (admin() as any).from('calendar_events').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(b.attendee_ids)) {
    await (admin() as any).from('calendar_attendees').delete().eq('event_id', id);
    const ids = [...new Set([ev.created_by, ...b.attendee_ids])].filter(Boolean);
    await (admin() as any).from('calendar_attendees').insert(ids.map((uid: string) => ({ event_id: id, user_id: uid })));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const ev = await loadOwn(id, auth);
  if (!ev) return NextResponse.json({ error: 'Brak wydarzenia lub uprawnień' }, { status: 403 });

  // Uczestnicy znikają kaskadą (FK z ON DELETE CASCADE, migracja 056) — w BBS zostawali sierotami.
  const { error } = await (admin() as any).from('calendar_events').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
