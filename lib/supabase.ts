// ── Klienci Supabase ──────────────────────────────────────────────────────────
// Eksportujemy dwa osobne klienty:
//   browserClient  — po stronie przeglądarki (anon key, sesja w cookie)
//   serverClient() — po stronie serwera / API routes (service role, pełny dostęp)
//
// WAŻNE: serverClient() używa service_role — nigdy nie wysyłaj go do przeglądarki.

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import type { Database } from '../types/database';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// ---------------------------------------------------------------------------
// Klient przeglądarkowy — używaj w komponentach React (client components)
// Lazy fallback gdy env vars nie są dostępne (build-time, SSR bez env)
// ---------------------------------------------------------------------------
export const supabaseBrowser = supabaseUrl && supabaseAnon
  ? createBrowserClient<Database>(supabaseUrl, supabaseAnon)
  : createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    );

// ---------------------------------------------------------------------------
// Klient serwerowy — używaj w API Routes i Server Components
// Używa service_role — omija RLS, pełny dostęp do bazy
// ---------------------------------------------------------------------------
export function supabaseServer() {
  return createClient<Database>(supabaseUrl, supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Klient serwerowy z kontekstem żądania (dla middleware / SSR z sesją)
// Używaj gdy potrzebujesz dostępu do sesji użytkownika po stronie serwera
// ---------------------------------------------------------------------------
export function supabaseServerWithCookies(
  getCookie: (name: string) => string | undefined,
  setCookie: (name: string, value: string, options: Record<string, unknown>) => void
) {
  return createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        // Uproszczona implementacja — w Next.js użyj cookies() z next/headers
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => setCookie(name, value, options));
      },
    },
  });
}
