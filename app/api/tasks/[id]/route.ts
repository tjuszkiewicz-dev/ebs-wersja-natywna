// PATCH /api/tasks/[id] — zmiana statusu/danych (przypisany może odhaczyć; twórca/admin — wszystko)
// DELETE /api/tasks/[id] — usunięcie (twórca albo admin)
// Port z BBS-Unified (E7b). `logEvent` → trigger `trg_audit_app_tasks`; dołożona bramka `crm.kalendarz`.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['superadmin', 'dyrektor'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const { data: t } = await (admin() as any).from('app_tasks').select('*').eq('id', id).single();
  if (!t) return NextResponse.json({ error: 'Brak zadania' }, { status: 404 });

  const owner = t.created_by === auth.id || ADMIN_ROLES.includes(auth.role);
  const assignee = t.assigned_to === auth.id;
  if (!owner && !assignee) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const patch: any = {};
  if ('status' in b && ['open', 'done', 'cancelled'].includes(b.status)) {
    patch.status = b.status;
    patch.done_at = b.status === 'done' ? new Date().toISOString() : null;
  }
  if (owner) {
    for (const f of ['title', 'description', 'due_date'] as const) if (f in b) patch[f] = b[f] || null;
    if ('assigned_to' in b && b.assigned_to) patch.assigned_to = b.assigned_to;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Brak zmian' }, { status: 400 });

  const { error } = await (admin() as any).from('app_tasks').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalendarz'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const { data: t } = await (admin() as any).from('app_tasks').select('*').eq('id', id).single();
  if (!t) return NextResponse.json({ error: 'Brak zadania' }, { status: 404 });
  if (t.created_by !== auth.id && !ADMIN_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await (admin() as any).from('app_tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
