// GET  /api/tasks — moje zadania (przypisane do mnie) + zlecone przeze mnie innym
// POST /api/tasks — nowe zadanie: { title, description?, assigned_to, due_date?, event_id? }
// Port z BBS-Unified (E7b). Adaptacje EBS: `admin()` zamiast `adminWorkspace`,
// `profilesMap` z `lib/crm/profiles`, `logEvent` → trigger `trg_audit_app_tasks`,
// dołożona bramka `crm.kalendarz` (w BBS wystarczyło samo zalogowanie).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';
import { profilesMap } from '@/lib/crm/profiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await (admin() as any).from('app_tasks')
    .select('*')
    .or(`assigned_to.eq.${auth.id},created_by.eq.${auth.id}`)
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profiles = await profilesMap((data || []).flatMap((t: any) => [t.assigned_to, t.created_by]));
  const tasks = (data || []).map((t: any) => ({
    id: t.id, title: t.title, description: t.description, due_date: t.due_date, status: t.status, source: t.source,
    event_id: t.event_id, created_at: t.created_at,
    assigned_to: { id: t.assigned_to, name: profiles.get(t.assigned_to)?.full_name || '—' },
    created_by: t.created_by ? { id: t.created_by, name: profiles.get(t.created_by)?.full_name || '—' } : null,
    mine: t.assigned_to === auth.id,
  }));
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const b = await request.json().catch(() => null);
  if (!b?.title?.trim() || !b?.assigned_to) {
    return NextResponse.json({ error: 'Wymagany tytuł i osoba' }, { status: 400 });
  }

  const { data, error } = await (admin() as any).from('app_tasks').insert({
    title: String(b.title).trim().slice(0, 200),
    description: b.description?.trim() || null,
    assigned_to: b.assigned_to,
    due_date: b.due_date || null,
    source: ['manual', 'meeting', 'ai'].includes(b.source) ? b.source : 'manual',
    event_id: b.event_id || null,
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
