// GET / PUT / DELETE /api/crm/contacts/[id] — port z BBS-Unified (E7b).
// Brak sesji → 403 (wzorzec EBS, nie 401).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, admin } from '@/lib/crm/visibility';

async function canAccessContact(callerId: string, callerRole: string, contactId: string): Promise<boolean> {
  if (callerRole === 'superadmin') return true;

  const { data: contact } = await (admin() as any)
    .from('crm_contacts')
    .select('assigned_to')
    .eq('id', contactId)
    .single();

  if (!contact) return false;
  if (!contact.assigned_to) return true; // nieprzypisany — kontakt ogólny

  const visibleIds = await getVisibleUserIds(callerId, callerRole);
  if (visibleIds === null) return true;
  return visibleIds.includes(contact.assigned_to);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kontakty'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;

  if (!(await canAccessContact(auth.id, auth.role, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await (admin() as any).from('crm_contacts').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kontakty'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;

  if (!(await canAccessContact(auth.id, auth.role, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { first_name, last_name, email, phone, position, company_name, company_id, notes, is_primary } = body;

  const { data, error } = await (admin() as any)
    .from('crm_contacts')
    .update({
      first_name, last_name, email, phone, position,
      company_name, company_id: company_id || null,
      notes, is_primary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;

  if (!(await canAccessContact(auth.id, auth.role, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await (admin() as any).from('crm_contacts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
