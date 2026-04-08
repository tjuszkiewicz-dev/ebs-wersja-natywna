// POST /api/companies/[id]/contacts/[contact_id]/create-hr-account
//
// Tworzy konto Supabase Auth + profil użytkownika (rola: pracodawca) dla
// osoby kontaktowej oznaczonej jako Operator HR.
// Wymaga: contact.email i contact.is_hr_operator === true.
// Zwraca: { userId, email, tempPassword }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

/** Generuje losowe bezpieczne hasło tymczasowe (min. 12 znaków) */
function generateTempPassword(): string {
  const chars  = 'abcdefghijkmnopqrstuvwxyz';
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const specials = '!@#$%';
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const parts = [
    rand(upper), rand(upper),
    rand(chars), rand(chars), rand(chars), rand(chars),
    rand(digits), rand(digits),
    rand(specials),
  ];
  // Dopełnij do 12 znaków i przetasuj
  while (parts.length < 12) parts.push(rand(chars + digits));
  return parts.sort(() => Math.random() - 0.5).join('');
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; contact_id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  // ── Pobierz kontakt ────────────────────────────────────────────────────────
  const { data: contact, error: contactErr } = await supabase
    .from('company_contacts')
    .select('*')
    .eq('id', params.contact_id)
    .eq('company_id', params.id)
    .single();

  if (contactErr || !contact) {
    return NextResponse.json({ error: 'Kontakt nie istnieje' }, { status: 404 });
  }

  if (!contact.is_hr_operator) {
    return NextResponse.json(
      { error: 'Kontakt nie jest oznaczony jako Operator HR' },
      { status: 400 },
    );
  }

  if (!contact.email) {
    return NextResponse.json(
      { error: 'Brak adresu e-mail — wymagany do założenia konta HR' },
      { status: 400 },
    );
  }

  // ── Sprawdź czy firma istnieje ─────────────────────────────────────────────
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (!company) {
    return NextResponse.json({ error: 'Firma nie istnieje' }, { status: 404 });
  }

  // ── Sprawdź czy konto już istnieje ────────────────────────────────────────
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = listData?.users?.find(
    (u) => u.email?.toLowerCase() === contact.email!.toLowerCase(),
  );

  if (existingUser) {
    // Konto już istnieje — upewnij się że profil ma rolę pracodawca i właściwą firmę
    await supabase
      .from('user_profiles')
      .upsert({
        id:         existingUser.id,
        company_id: params.id,
        role:       'pracodawca',
        full_name:  `${contact.first_name} ${contact.last_name}`,
      }, { onConflict: 'id' });

    return NextResponse.json(
      { error: 'Konto dla tego e-maila już istnieje w systemie. Profil został zaktualizowany.' },
      { status: 409 },
    );
  }

  // ── Utwórz konto auth ─────────────────────────────────────────────────────
  const tempPassword = generateTempPassword();

  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email:         contact.email,
    password:      tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name: `${contact.first_name} ${contact.last_name}`,
      company_id:   params.id,
      role:         'pracodawca',
      temp_password: tempPassword,
    },
  });

  if (createErr || !newUser.user) {
    return NextResponse.json(
      { error: createErr?.message ?? 'Błąd tworzenia konta' },
      { status: 500 },
    );
  }

  // ── Utwórz profil użytkownika ─────────────────────────────────────────────
  const { error: profileErr } = await supabase.from('user_profiles').insert({
    id:           newUser.user.id,
    company_id:   params.id,
    company_name: company.name,
    role:         'pracodawca',
    full_name:    `${contact.first_name} ${contact.last_name}`,
    phone_number: contact.phone ?? null,
  });

  if (profileErr) {
    // Rollback auth user
    await supabase.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Zapisz hasło tymczasowe w rekordzie kontaktu (persystencja dla panelu admina) — fallback jeśli migracja 009 nie uruchomiona
  await supabase
    .from('company_contacts')
    .update({ hr_temp_password: tempPassword })
    .eq('id', params.contact_id)
    .then(() => null) // ignoruj błąd jeśli kolumna nie istnieje

  return NextResponse.json({
    userId:       newUser.user.id,
    email:        contact.email,
    tempPassword,
  }, { status: 201 });
}
