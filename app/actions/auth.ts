'use server';

// Server Action — logowanie przez Supabase + ustawienie sesji.
// Server Actions mają GWARANTOWANY dostęp do cookies() z next/headers,
// w odróżnieniu od Route Handlers gdzie Set-Cookie może nie trafić do odpowiedzi.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE, ROLE_DASHBOARD } from '@/lib/roleMap';
import type { DbRole } from '@/types/database';
import type { Database } from '@/types/database';
import type { Role } from '@/types';

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email    = (formData.get('email')    as string | null)?.trim().toLowerCase() ?? '';
  const password = (formData.get('password') as string | null) ?? '';

  if (!email || !password) return 'Podaj email i hasło.';

  const cookieStore = await cookies();

  // createServerClient z @supabase/ssr — sesja zapisywana przez cookieStore
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return authError?.message ?? 'Nieprawidłowy email lub hasło.';
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

  if (profileError || !profile) return 'Profil użytkownika nie istnieje.';
  if (profile.status === 'inactive') return 'Konto jest nieaktywne. Skontaktuj się z administratorem.';

  const role   = DB_TO_ROLE[profile.role as DbRole] ?? ('EMPLOYEE' as Role);
  const target = ROLE_DASHBOARD[role] ?? '/dashboard/employee';

  // redirect() w Server Action — Next.js automatycznie obsługuje nawigację
  redirect(target);
}
