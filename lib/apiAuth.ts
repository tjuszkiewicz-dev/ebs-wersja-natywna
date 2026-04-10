// ── Weryfikacja sesji w API Routes ────────────────────────────────────────────
// Użyj getAuthUser() na początku każdego chronionego endpointu.
// Zwraca user lub null — obsługa błędu po stronie route handlera.

import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export interface AuthUserWithRole {
  id: string;
  email: string;
  role: string;       // DB role: superadmin, pracodawca, pracownik, ...
  companyId?: string;
}

/** Sprawdza czy żądanie pochodzi od Vite dev proxy (x-internal-key) */
async function isInternalRequest(): Promise<boolean> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) return false;
  const reqHeaders = await headers();
  return reqHeaders.get('x-internal-key') === internalKey;
}

/** Pobiera zalogowanego użytkownika wraz z rolą z user_profiles */
export async function getAuthUserWithRole(): Promise<AuthUserWithRole | null> {
  // Żądania z Vite dev proxy — traktuj jako superadmin (dev mode)
  if (await isInternalRequest()) {
    return { id: 'dev-vite', email: 'dev@ebs.local', role: 'superadmin' };
  }

  const user = await getAuthUser();
  if (!user) return null;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data } = await supabase
    .from('user_profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  return {
    id:        user.id,
    email:     user.email ?? '',
    role:      data?.role ?? 'pracownik',
    companyId: data?.company_id ?? undefined,
  };
}

export async function getAuthUser(): Promise<User | null> {
  if (await isInternalRequest()) {
    return { id: 'dev-vite', email: 'dev@ebs.local', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } as unknown as User;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) return null;

  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnon,
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

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/** Odpowiedź 401 Unauthorized */
export function unauthorized() {
  return Response.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
}

/** Odpowiedź 400 Bad Request z błędami Zod */
export function badRequest(message: string) {
  return Response.json({ data: null, error: { message } }, { status: 400 });
}

/** Odpowiedź 500 Internal Server Error */
export function serverError(message: string) {
  return Response.json({ data: null, error: { message } }, { status: 500 });
}
