// PUT /api/org/users/[id] — zmiana danych osoby w strukturze sprzedaży.
//
// Port z BBS-Unified (E7d). Adaptacje:
//  - bramka: `can(auth,'crm.org-chart')` + rola zarządzająca (jak w POST /api/org/users);
//  - dochodzi `owner` — traktowany jak superadmin (może wszystko);
//  - `admin()` z `lib/crm/visibility` zamiast lokalnego `adminClient()` z `createClient` —
//    EBS ma jednego klienta service-role i nie mnożymy jego kopii;
//  - **nie można przepiąć osoby pod samą siebie ani zdegradować własnej roli** — dwie
//    dziury z BBS: `manager_id = własne id` robi cykl, przez który org-chart wchodzi
//    w nieskończoną rekurencję, a zmiana własnej roli pozwala się zablokować.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, admin } from '@/lib/crm/visibility';

const ROLE_ZARZADZAJACE = ['superadmin', 'owner', 'dyrektor', 'menedzer'];
const PELNA_WLADZA = ['superadmin', 'owner'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthUserWithRole();

  if (!auth || !(await can(auth, 'crm.org-chart')) || !ROLE_ZARZADZAJACE.includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { full_name, role, manager_id } = body ?? {};

  const sb = admin() as any;

  const { data: targetUser, error: fetchError } = await sb
    .from('user_profiles')
    .select('id, full_name, role, manager_id')
    .eq('id', id)
    .single();

  if (fetchError || !targetUser) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
  }

  if (manager_id !== undefined && manager_id === id) {
    return NextResponse.json(
      { error: 'Osoba nie może podlegać samej sobie' },
      { status: 400 }
    );
  }
  if (role !== undefined && id === auth.id) {
    return NextResponse.json(
      { error: 'Nie można zmienić własnej roli' },
      { status: 403 }
    );
  }

  if (PELNA_WLADZA.includes(auth.role)) {
    // superadmin/owner — bez ograniczeń
  } else if (auth.role === 'dyrektor') {
    // dyrektor: zmienia nazwę i przełożonego, ale NIE rolę, i tylko w swoim poddrzewie
    if (role !== undefined) {
      return NextResponse.json({ error: 'Dyrektor nie może zmieniać ról' }, { status: 403 });
    }
    const visibleIds = await getVisibleUserIds(auth.id, auth.role);
    if (visibleIds === null || !visibleIds.includes(id)) {
      return NextResponse.json({ error: 'Ta osoba jest poza Twoją strukturą' }, { status: 403 });
    }
  } else if (auth.role === 'menedzer') {
    // menedżer: wyłącznie przepięcie przełożonego, w obrębie swojego zespołu
    if (full_name !== undefined || role !== undefined) {
      return NextResponse.json(
        { error: 'Menedżer może zmieniać tylko przełożonego' },
        { status: 403 }
      );
    }
    const visibleIds = await getVisibleUserIds(auth.id, auth.role);
    if (visibleIds === null || !visibleIds.includes(id)) {
      return NextResponse.json({ error: 'Ta osoba jest poza Twoim zespołem' }, { status: 403 });
    }
  }

  const updates: { full_name?: string; role?: string; manager_id?: string | null } = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (manager_id !== undefined) updates.manager_id = manager_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Brak pól do zmiany' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('user_profiles')
    .update(updates)
    .eq('id', id)
    .select('id, full_name, role, manager_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
