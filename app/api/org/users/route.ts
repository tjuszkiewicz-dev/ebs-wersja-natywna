// GET  /api/org/users — struktura sprzedaży przefiltrowana widocznością (org-chart).
// POST /api/org/users — dodanie osoby do struktury (konto auth + profil).
//
// Port z BBS-Unified (E7d). Adaptacje:
//  - **dwie bramki, nie jedna.** Odczyt: `can(auth,'crm.org-chart')`. Zapis: dodatkowo rola
//    z `ROLE_ZARZADZAJACE` — samo uprawnienie do zakładki NIE może dawać prawa zakładania
//    kont z hasłem (w BBS bramką była wyłącznie lista ról, więc rozdziału nie było).
//  - dochodzi `owner` (rola nieznana BBS-owi) — bez niej właściciel nie zarządzałby strukturą.
//  - dochodzi `leadowiec` do ról możliwych do utworzenia (rola EBS z E7a).
//  - brak dostępu → 403 (wzorzec EBS).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, admin } from '@/lib/crm/visibility';

const ROLE_ZARZADZAJACE = ['superadmin', 'owner', 'dyrektor', 'menedzer'];
const ROLE_DO_UTWORZENIA = ['dyrektor', 'menedzer', 'partner', 'leadowiec', 'hr', 'pracodawca'];

export async function GET(_request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.org-chart'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const visibleIds = await getVisibleUserIds(auth.id, auth.role);

  let query = (admin() as any)
    .from('user_profiles')
    .select('id, full_name, role, manager_id')
    .order('role', { ascending: true })
    .order('full_name', { ascending: true });

  if (visibleIds !== null) {
    if (visibleIds.length === 0) return NextResponse.json([]);
    query = query.in('id', visibleIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.org-chart')) || !ROLE_ZARZADZAJACE.includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { full_name, email, role, manager_id } = body ?? {};

  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    return NextResponse.json({ error: 'Imię i nazwisko wymagane' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return NextResponse.json({ error: 'Poprawny email wymagany' }, { status: 400 });
  }
  if (!role || !ROLE_DO_UTWORZENIA.includes(role)) {
    return NextResponse.json(
      { error: `Rola musi być jedną z: ${ROLE_DO_UTWORZENIA.join(', ')}` },
      { status: 400 }
    );
  }

  // Kto kogo może założyć: dyrektor nie robi dyrektorów, menedżer tylko partnerów/leadowców.
  if (auth.role === 'dyrektor' && (role === 'dyrektor' || role === 'superadmin')) {
    return NextResponse.json({ error: 'Dyrektor nie może tworzyć dyrektorów' }, { status: 403 });
  }
  if (auth.role === 'menedzer' && role !== 'partner' && role !== 'leadowiec') {
    return NextResponse.json(
      { error: 'Menedżer może dodawać tylko partnerów i leadowców' },
      { status: 403 }
    );
  }

  const supabase = admin() as any;
  const normalizedEmail = email.toLowerCase().trim();

  const tempPassword =
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    Math.random().toString(36).slice(2, 6) +
    Math.floor(10 + Math.random() * 90) +
    '!';

  let userId: string;
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = (listData?.users ?? []).find(
    (u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail
  );

  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password: tempPassword,
      email_confirm: true,
    });
  } else {
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    });
    if (authError || !newUser?.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'Nie udało się utworzyć konta auth' },
        { status: 500 }
      );
    }
    userId = newUser.user.id;
  }

  const { error: profileError } = await supabase.from('user_profiles').upsert(
    {
      id: userId,
      full_name: full_name.trim(),
      role,
      manager_id: manager_id ?? null,
      temp_password: tempPassword,
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: userId,
      full_name: full_name.trim(),
      role,
      manager_id: manager_id ?? null,
      email: normalizedEmail,
      tempPassword,
    },
    { status: 201 }
  );
}
