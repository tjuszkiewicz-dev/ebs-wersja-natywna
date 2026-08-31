// GET  /api/crm/leads — lista leadów przefiltrowana widocznością
// POST /api/crm/leads — nowy lead (dedup po NIP)
// Port z BBS-Unified (E7a). Adaptacja: `adminWorkspace(request)` → `admin()`
// (EBS jest jednonajemcowy, nie ma warstwy workspace — spec K2).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, applyVisibilityFilter, getMyLeadowiecIds, admin } from '@/lib/crm/visibility';
import { logActivity } from '@/lib/crm/activities';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.pipeline'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const visibleIds = await getVisibleUserIds(auth.id, auth.role);

  // menedżer i dyrektor widzą też leady nieprzypisane (do podziału w zespole)
  const includeUnassigned = ['menedzer', 'dyrektor', 'superadmin'].includes(auth.role);

  const fromLeadowcy = searchParams.get('from_my_leadowcy') === '1';

  let query = (admin() as any)
    .from('leads')
    .select('*, opiekun:user_profiles!leads_assigned_to_fkey(full_name, role, hierarchical_id)')
    .order('created_at', { ascending: false });

  query = applyVisibilityFilter(query, visibleIds, includeUnassigned);
  if (status) query = (query as any).eq('status', status);
  if (fromLeadowcy) {
    const leadowiecIds = await getMyLeadowiecIds(auth.id, auth.role);
    query = (query as any).in(
      'added_by_user_id',
      leadowiecIds.length ? leadowiecIds : ['00000000-0000-0000-0000-000000000000'],
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.pipeline'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, nip, contact_person, phone, email, notes, source, assigned_to, city } = body;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  // Partner zawsze dostaje lead przypisany do siebie.
  // Menedżer/dyrektor mogą przypisać do wybranego użytkownika (lub siebie).
  let finalAssignedTo: string = auth.id;
  if (auth.role !== 'partner' && assigned_to) {
    const visibleIds = await getVisibleUserIds(auth.id, auth.role);
    if (visibleIds === null || visibleIds.includes(assigned_to)) {
      finalAssignedTo = assigned_to;
    }
  }

  // Dedup po NIP
  if (nip) {
    const { data: existing } = await (admin() as any)
      .from('leads')
      .select('id')
      .eq('nip', nip)
      .neq('status', 'LOST')
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Lead z tym NIP już istnieje', code: 'DUPLICATE_NIP' },
        { status: 409 },
      );
    }
  }

  const { data, error } = await (admin() as any)
    .from('leads')
    .insert({
      name,
      nip,
      contact_person,
      phone,
      email,
      notes,
      city,
      source: source ?? 'manual',
      assigned_to: finalAssignedTo,
      added_by_user_id: auth.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Oś czasu: utworzenie leada (+ notatka początkowa, jeśli podano)
  await logActivity({ leadId: data.id, type: 'SYSTEM', isSystem: true, authorId: auth.id, body: 'Utworzono lead' });
  if (notes && String(notes).trim()) {
    await logActivity({ leadId: data.id, type: 'NOTE', authorId: auth.id, body: String(notes).trim() });
  }

  return NextResponse.json(data, { status: 201 });
}
