// ── Wymiana tokenu z maila na sesję ──────────────────────────────────────────
// Link w mailu prowadzi TUTAJ (nasza domena), a nie wprost na *.supabase.co.
// Powód: Gmail oznaczał wiadomości jako phishing, bo nadawca był z
// stratton-prime.pl, a odnośnik prowadził na losowo wyglądającą domenę
// projektu Supabase — klasyczny wzorzec podszywania się. Po tej zmianie
// domena nadawcy i domena linku są spójne.
//
// Szablon maila ma używać:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get('token_hash');
  const type      = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next') ?? '/reset-password';

  // Otwarte przekierowanie byłoby prezentem dla phishingu — przyjmujemy
  // wyłącznie ścieżki względne w obrębie naszej aplikacji.
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/reset-password';

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/reset-password?blad=brak_tokenu', origin));
  }

  const cookieStore = await cookies();
  const response    = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error('[auth/confirm] verifyOtp:', error.message);
    return NextResponse.redirect(new URL('/reset-password?blad=link_niewazny', origin));
  }

  // Sesja siedzi już w ciasteczkach ustawionych na `response`.
  return response;
}
