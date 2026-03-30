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
const PUBLIC_PATHS = ['/login', '/api/auth'];

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

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  // Odśwież sesję (wymaga await — mutuje cookies w response)
  const { data: { user } } = await supabase.auth.getUser();

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
