// ── Weryfikacja sesji w API Routes ────────────────────────────────────────────
// Użyj getAuthUser() na początku każdego chronionego endpointu.
// Zwraca user lub null — obsługa błędu po stronie route handlera.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();

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

  const { data: { user } } = await supabase.auth.getUser();
  return user;
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
