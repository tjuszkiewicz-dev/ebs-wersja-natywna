// POST /api/companies/[id]/contacts/[contact_id]/reset-hr-password
//
// Generuje nowe hasło tymczasowe dla istniejącego konta HR operatora.
// Wymaga: kontakt musi być is_hr_operator z zarejestrowanym kontem Supabase Auth.
// Zwraca: { tempPassword }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

function generateTempPassword(): string {
  const chars    = 'abcdefghijkmnopqrstuvwxyz';
  const upper    = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits   = '23456789';
  const specials = '!@#$%';
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const parts = [
    rand(upper), rand(upper),
    rand(digits), rand(digits),
    rand(specials),
    ...Array.from({ length: 7 }, () => rand(chars + digits)),
  ];
  return parts.sort(() => Math.random() - 0.5).join('');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; contact_id: string } },
) {
  const auth = await getAuthUserWithRole(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { id: companyId, contact_id: contactId } = params;

  // 1. Sprawdź kontakt — pobierz e-mail i upewnij się że to operator HR
  const { data: contact, error: contactErr } = await supabase
    .from('company_contacts')
    .select('email, is_hr_operator')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .single();

  if (contactErr || !contact) {
    return NextResponse.json({ error: 'Kontakt nie istnieje' }, { status: 404 });
  }
  if (!contact.is_hr_operator) {
    return NextResponse.json({ error: 'Kontakt nie jest operatorem HR' }, { status: 400 });
  }
  if (!contact.email) {
    return NextResponse.json({ error: 'Kontakt nie posiada adresu e-mail' }, { status: 400 });
  }

  // 2. Znajdź konto Supabase Auth po e-mailu
  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const authUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === contact.email!.toLowerCase(),
  );
  if (!authUser) {
    return NextResponse.json({ error: 'Konto HR nie istnieje w systemie' }, { status: 404 });
  }

  // 3. Ustaw hasło — ręczne lub wygenerowane
  let tempPassword: string;
  try {
    const body = await req.json().catch(() => ({}));
    tempPassword = (typeof body?.password === 'string' && body.password.length >= 8)
      ? body.password
      : generateTempPassword();
  } catch {
    tempPassword = generateTempPassword();
  }
  const { error: updateErr } = await supabase.auth.admin.updateUserById(authUser.id, {
    password: tempPassword,
    user_metadata: { ...authUser.user_metadata, temp_password: tempPassword },
  });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Zapisz hasło tymczasowe w rekordzie kontaktu (persystencja dla panelu admina) — fallback jeśli migracja 009 nie uruchomiona
  await supabase
    .from('company_contacts')
    .update({ hr_temp_password: tempPassword })
    .eq('id', contactId)
    .eq('company_id', companyId)
    .then(() => null); // ignoruj błąd jeśli kolumna nie istnieje

  return NextResponse.json({ tempPassword });
}
