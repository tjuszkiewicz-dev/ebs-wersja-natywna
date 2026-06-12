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
  { params: __paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await __paramsP;
  const auth = await getAuthUserWithRole();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseServer() as any;
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

  // 2. Pobierz wszystkich użytkowników auth (paginacja) i znajdź po emailu
  const allAuthUsers: any[] = [];
  let authPage = 1;
  while (true) {
    const { data: authListData } = await supabase.auth.admin.listUsers({ perPage: 1000, page: authPage });
    const pageUsers = authListData?.users ?? [];
    allAuthUsers.push(...pageUsers);
    if (pageUsers.length < 1000) break;
    authPage++;
  }

  // Buduj mapę: email → { id, temp_password z user_metadata }
  const authByEmail = new Map<string, { id: string; tempPw: string | null }>();
  for (const u of allAuthUsers) {
    if (u.email) {
      const meta = u.user_metadata as Record<string, string> | undefined;
      authByEmail.set(u.email.toLowerCase(), {
        id: u.id,
        tempPw: meta?.temp_password ?? null,
      });
    }
  }

  // 3. Dopasuj kontakty
  const existingAccounts: string[] = [];
  const passwords: Record<string, string> = {};

  for (const c of contacts) {
    if (!c.email) continue;
    const authEntry = authByEmail.get(c.email.toLowerCase());
    if (!authEntry) continue;

    existingAccounts.push(c.id);

    // Priorytet: user_metadata > hr_temp_password z tabeli
    const metaPw = authEntry.tempPw;
    const dbPw   = (c as any).hr_temp_password ?? null;
    const resolved = metaPw || dbPw;
    if (resolved) {
      passwords[c.id] = resolved;
    }
  }

  return NextResponse.json({ existingAccounts, passwords });
}
