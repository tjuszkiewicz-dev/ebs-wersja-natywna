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

  // Sprawdź env vars — brak = fail fast z czytelnym komunikatem
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    console.error('[loginAction] Brak NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return { ok: false, message: 'Błąd konfiguracji serwera (Supabase URL). Skontaktuj się z administratorem.' };
  }
  if (!serviceKey) {
    console.error('[loginAction] Brak SUPABASE_SERVICE_ROLE_KEY');
    return { ok: false, message: 'Błąd konfiguracji serwera (service key). Skontaktuj się z administratorem.' };
  }

  const cookieStore = await cookies();

  // createServerClient ustawia ciasteczka sesji przez cookieStore
  // W Server Action cookieStore jest mutowalny — try/catch usunięty celowo,
  // żeby błąd ustawiania cookies nie był ukryty.
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnon,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch (err) {
              console.error('[loginAction] Nie można ustawić ciasteczka:', name, err);
            }
          });
        },
      },
    }
  );

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData?.user) {
    // Mapuj angielskie błędy Supabase na polskie komunikaty
    const msg = authError?.message ?? '';
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      return { ok: false, message: 'Nieprawidłowy email lub hasło.' };
    }
    if (msg.includes('Email not confirmed')) {
      return { ok: false, message: 'Adres email nie został potwierdzony. Sprawdź skrzynkę pocztową.' };
    }
    if (msg.includes('Too many requests')) {
      return { ok: false, message: 'Zbyt wiele prób logowania. Poczekaj chwilę i spróbuj ponownie.' };
    }
    console.error('[loginAction] signInWithPassword error:', authError);
    return { ok: false, message: msg || 'Błąd logowania. Spróbuj ponownie.' };
  }

  // Pobierz rolę przez service role (omija RLS)
  const admin = createClient<Database>(
    supabaseUrl,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role, status')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    console.error('[loginAction] Brak profilu dla user.id:', authData.user.id, profileError);
    return { ok: false, message: 'Profil użytkownika nie istnieje w systemie. Skontaktuj się z administratorem.' };
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
