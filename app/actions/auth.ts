'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE, ROLE_DASHBOARD } from '@/lib/roleMap';
import type { DbRole } from '@/types/database';
import type { Database } from '@/types/database';
import type { Role } from '@/types';

export type LoginResult =
  | { ok: true;  redirectUrl: string }
  | { ok: false; message: string };

export async function loginAction(
  _prev: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const email    = (formData.get('email')    as string | null)?.trim().toLowerCase() ?? '';
  const password = (formData.get('password') as string | null) ?? '';

  if (!email || !password) {
    return { ok: false, message: 'Podaj email i hasło.' };
  }

  const cookieStore = await cookies();

  // createServerClient ustawia ciasteczka przez cookieStore (Server Action = można pisać)
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignoruj błędy z Server Components (tu jesteśmy w Server Action, więc OK)
          }
        },
      },
    }
  );

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData?.user) {
    return { ok: false, message: authError?.message ?? 'Nieprawidłowy email lub hasło.' };
  }

  // Pobierz rolę przez service role (omija RLS)
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role, status')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, message: 'Profil użytkownika nie istnieje w systemie.' };
  }

  if (profile.status === 'inactive') {
    return { ok: false, message: 'Konto jest nieaktywne. Skontaktuj się z administratorem.' };
  }

  const role   = DB_TO_ROLE[profile.role as DbRole] ?? ('EMPLOYEE' as Role);
  const target = ROLE_DASHBOARD[role] ?? '/dashboard/employee';

  // NIE wywołujemy redirect() — zwracamy URL do klienta.
  // Klient wykona window.location.href = redirectUrl (pełny reload HTTP),
  // co gwarantuje że serwer zobaczy właśnie ustawione ciasteczka sesji.
  return { ok: true, redirectUrl: target };
}
