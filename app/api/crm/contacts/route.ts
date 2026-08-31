// GET  /api/crm/contacts?q= — lista kontaktów przefiltrowana widocznością
// POST /api/crm/contacts — nowy kontakt
// Port z BBS-Unified (E7b). Adaptacje: `adminWorkspace(req)` → `admin()`,
// brak sesji → 403 zamiast 401 (wzorzec EBS).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, applyVisibilityFilter, admin } from '@/lib/crm/visibility';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kontakty'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('q');

  const visibleIds = await getVisibleUserIds(auth.id, auth.role);

  let query = (admin() as any)
    .from('crm_contacts')
    .select('*')
    .order('last_name');

  // Kontakty nieprzypisane (assigned_to = null) są ogólne — widzi je każdy z dostępem do CRM.
  query = applyVisibilityFilter(query, visibleIds, true);

  if (search) {
    // Escapowanie znaków, które w składni `or()` PostgREST rozdzielają warunki —
    // bez tego przecinek albo nawias w wyszukiwarce psuje całe zapytanie.
    const safe = search.replace(/[,()\\]/g, ' ').trim();
    if (safe) {
      query = (query as any).or(
        `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,company_name.ilike.%${safe}%`
      );
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kontakty'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { first_name, last_name, email, phone, position, company_name, company_id, notes, is_primary } = body;
  if (!first_name || !last_name) {
    return NextResponse.json({ error: 'first_name i last_name są wymagane' }, { status: 400 });
  }

  const { data, error } = await (admin() as any)
    .from('crm_contacts')
    .insert({
      first_name, last_name, email, phone, position,
      company_name, company_id: company_id || null,
      notes, is_primary: is_primary ?? false,
      assigned_to: auth.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
