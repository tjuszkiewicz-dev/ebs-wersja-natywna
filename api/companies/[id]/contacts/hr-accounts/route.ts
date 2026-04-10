// GET /api/companies/[id]/contacts/hr-accounts
//
// Zwraca listę id kontaktów (is_hr_operator = true), dla których
// istnieje już konto Supabase Auth (user_profiles role = 'pracodawca'),
// oraz zapisane hasła tymczasowe (hr_temp_password z company_contacts).
// Używane przez ContactsSection do trwałego wyszarzenia przycisku i wyświetlenia danych logowania.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await getAuthUserWithRole(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseServer();
  const companyId = params.id;

  // 1. Pobierz wszystkie operatorskie kontakty z e-mailem i zapisanym hasłem
  //    Fallback do SELECT bez hr_temp_password jeśli migracja 009 nie została uruchomiona
  let contacts: Array<{ id: string; email: string; hr_temp_password?: string | null }> | null = null;
  let contactsErr: any = null;

  const fullResult = await supabase
    .from('company_contacts')
    .select('id, email, hr_temp_password')
    .eq('company_id', companyId)
    .eq('is_hr_operator', true)
    .not('email', 'is', null);

  if (fullResult.error) {
    // Kolumna hr_temp_password może nie istnieć (migracja 009 nie uruchomiona) — fallback
    const fallbackResult = await supabase
      .from('company_contacts')
      .select('id, email')
      .eq('company_id', companyId)
      .eq('is_hr_operator', true)
      .not('email', 'is', null);
    contacts   = fallbackResult.data;
    contactsErr = fallbackResult.error;
  } else {
    contacts = fullResult.data;
  }

  if (contactsErr) {
    return NextResponse.json({ error: contactsErr.message }, { status: 500 });
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ existingAccounts: [], passwords: {} });
  }

  // 2. Pobierz profile użytkowników tej firmy z rolą 'pracodawca'
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'pracodawca');

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ existingAccounts: [], passwords: {} });
  }

  // 3. Dla każdego profilu pobierz e-mail i temp_password z auth.users (user_metadata)
  const existingEmails = new Set<string>();
  const emailToTempPw: Record<string, string> = {};
  await Promise.all(
    profiles.map(async (profile) => {
      const { data } = await supabase.auth.admin.getUserById(profile.id);
      if (data?.user?.email) {
        existingEmails.add(data.user.email.toLowerCase());
        const meta = data.user.user_metadata as Record<string, string> | undefined;
        if (meta?.temp_password) {
          emailToTempPw[data.user.email.toLowerCase()] = meta.temp_password;
        }
      }
    }),
  );

  if (existingEmails.size === 0) {
    return NextResponse.json({ existingAccounts: [], passwords: {} });
  }

  // 4. Dopasuj kontakty — zbierz id i hasła (priorytet: user_metadata > hr_temp_password)
  const existingAccounts: string[] = [];
  const passwords: Record<string, string> = {};

  for (const c of contacts) {
    if (c.email && existingEmails.has(c.email.toLowerCase())) {
      existingAccounts.push(c.id);
      const metaPw  = emailToTempPw[c.email.toLowerCase()];
      const dbPw    = (c as any).hr_temp_password;
      const resolved = metaPw || dbPw;
      if (resolved) {
        passwords[c.id] = resolved;
      }
    }
  }

  return NextResponse.json({ existingAccounts, passwords });
}
