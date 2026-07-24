// ── Weryfikacja sesji w API Routes ────────────────────────────────────────────
// Użyj getAuthUser() na początku każdego chronionego endpointu.
// Zwraca user lub null — obsługa błędu po stronie route handlera.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export interface AuthUserWithRole {
  id: string;
  email: string;
  role: string;       // rola znormalizowana (owner → 'superadmin', dziedziczy bramki)
  dbRole?: string;     // rzeczywista rola z user_profiles (np. 'owner')
  isOwner?: boolean;
  companyId?: string;
}

/** Pobiera zalogowanego użytkownika wraz z rolą z user_profiles */
export async function getAuthUserWithRole(): Promise<AuthUserWithRole | null> {
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

  const dbRole = data?.role ?? 'pracownik';
  const isOwner = dbRole === 'owner';

  return {
    id:        user.id,
    email:     user.email ?? '',
    role:      isOwner ? 'superadmin' : dbRole,
    dbRole,
    isOwner,
    companyId: data?.company_id ?? undefined,
  };
}

export async function getAuthUser(): Promise<User | null> {
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

/** Odpowiedź 403 Forbidden */
export function forbidden() {
  return Response.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
}

/** Odpowiedź 400 Bad Request z błędami Zod */
export function badRequest(message: string) {
  return Response.json({ data: null, error: { message } }, { status: 400 });
}

/** Odpowiedź 500 Internal Server Error */
export function serverError(message: string) {
  return Response.json({ data: null, error: { message } }, { status: 500 });
}
