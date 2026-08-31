// GET / PATCH / DELETE /api/crm/leads/[id] — port z BBS-Unified (E7a).
// Zmiany profilu, statusu i opiekuna trafiają automatycznie na oś czasu (crm_activities).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, admin } from '@/lib/crm/visibility';
import { logActivity, statusLabel, resolveAuthorName } from '@/lib/crm/activities';

const PROFILE_FIELDS = ['name', 'nip', 'email', 'phone', 'city', 'contact_person', 'source'];

async function canAccessLead(callerId: string, callerRole: string, leadId: string): Promise<boolean> {
  if (callerRole === 'superadmin') return true;

  const { data: lead } = await (admin() as any)
    .from('leads')
    .select('assigned_to')
    .eq('id', leadId)
    .single();

  if (!lead) return false;

  // Lead nieprzypisany: menedżer, dyrektor i koordynator mogą zawsze
  if (!lead.assigned_to) {
    return ['menedzer', 'dyrektor', 'koordynator'].includes(callerRole);
  }

  const visibleIds = await getVisibleUserIds(callerId, callerRole);
  if (visibleIds === null) return true;
  return visibleIds.includes(lead.assigned_to);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.pipeline'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;

  if (!(await canAccessLead(auth.id, auth.role, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await (admin() as any).from('leads').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.pipeline'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;

  if (!(await canAccessLead(auth.id, auth.role, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();

  // Partner nie może przenosić leada do innego handlowca
  if (auth.role === 'partner') {
    delete body.assigned_to;
  }

  // Zmiana assigned_to: target musi być w widocznej grupie
  if (body.assigned_to && auth.role !== 'superadmin') {
    const visibleIds = await getVisibleUserIds(auth.id, auth.role);
    if (visibleIds !== null && !visibleIds.includes(body.assigned_to)) {
      return NextResponse.json({ error: 'Nie możesz przypisać leada poza swoją grupę' }, { status: 403 });
    }
  }

  // Stan sprzed zmiany — do osi czasu
  const { data: before } = await (admin() as any).from('leads').select('*').eq('id', id).single();

  const { data, error } = await (admin() as any)
    .from('leads')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Auto-wpisy na oś czasu ────────────────────────────────────────────────
  if (before && data) {
    if (before.status !== data.status) {
      await logActivity({
        leadId: id, type: 'SYSTEM', isSystem: true, authorId: auth.id,
        body: `Zmieniono status na: ${statusLabel(data.status)}`,
      });
    }
    if (before.assigned_to !== data.assigned_to) {
      const name = await resolveAuthorName(data.assigned_to);
      await logActivity({
        leadId: id, type: 'SYSTEM', isSystem: true, authorId: auth.id,
        body: name ? `Przypisano opiekuna: ${name}` : 'Zmieniono przypisanie opiekuna',
      });
    }
    const profileChanged =
      PROFILE_FIELDS.some((f) => (before as any)[f] !== (data as any)[f]) ||
      JSON.stringify((before as any).contacts ?? []) !== JSON.stringify((data as any).contacts ?? []);
    if (profileChanged) {
      await logActivity({
        leadId: id, type: 'SYSTEM', isSystem: true, authorId: auth.id,
        body: 'Zaktualizowano profil klienta',
      });
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;

  if (!(await canAccessLead(auth.id, auth.role, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await (admin() as any).from('leads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
