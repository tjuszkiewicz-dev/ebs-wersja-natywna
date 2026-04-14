// ── Auth middleware Next.js ───────────────────────────────────────────────────
// Sprawdza sesję Supabase przy każdym żądaniu do chronionych ścieżek.
// Używa @supabase/ssr (zamiennik deprecated auth-helpers-nextjs).
//
// Logika:
//   • /login, /_next, /api/auth — publiczne, bez sprawdzania sesji
//   • Brak sesji → redirect na /login
//   • Sesja aktywna → odśwież token i przepuść

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './types/database';

// Ścieżki publiczne — nie wymagają logowania
const PUBLIC_PATHS = ['/login', '/api/auth', '/api'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
    || pathname.startsWith('/_next')
    || pathname.startsWith('/favicon');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Przepuść zasoby statyczne i publiczne ścieżki
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ── Diagnostyka ─────────────────────────────────────────────────
  const allCookies = request.cookies.getAll();
  const sbCookies  = allCookies.filter(c => c.name.startsWith('sb-'));
  console.log(`[MW] ${pathname} | cookies total=${allCookies.length} sb-*=${sbCookies.length} | url_set=${!!supabaseUrl}`);
  sbCookies.forEach(c => console.log(`[MW]   cookie: ${c.name} = ${c.value.slice(0, 60)}...`));
  // ────────────────────────────────────────────────────────────────

  if (!supabaseUrl || !supabaseAnon) {
    console.error('[MW] BRAK ENV: NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Odśwież sesję (wymaga await — mutuje cookies w response)
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log(`[MW] getUser result: user=${user?.id ?? 'null'} | error=${userError?.message ?? 'none'}`);

  if (!user) {
    // Brak sesji → redirect na login z zachowaniem docelowego URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Dopasuj wszystkie ścieżki z wyjątkiem:
     *   - _next/static (pliki statyczne)
     *   - _next/image (optymalizacja obrazów)
     *   - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
