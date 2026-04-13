// POST /api/auth/login-v2
// Autentykacja z gwarancją ustawienia ciasteczek sesji przez Set-Cookie w HTTP response.
// Cookies ustawiane w nagłówkach HTTP (nie przez document.cookie) — czytane przez middleware.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE, ROLE_DASHBOARD } from '@/lib/roleMap';
import type { DbRole, Database } from '@/types/database';

export async function POST(req: NextRequest) {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return NextResponse.json({ error: 'Brak konfiguracji serwera' }, { status: 500 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Podaj email i hasło' }, { status: 400 });
  }

  // Zbierz ciasteczka które Supabase chce ustawić
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        // Przy logowaniu nie ma jeszcze ciasteczek sesji
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Zbieramy — ustawimy je ręcznie w NextResponse poniżej
        cookiesToSet.forEach(c => pendingCookies.push(c as typeof pendingCookies[number]));
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (authError || !authData?.user) {
    const msg = authError?.message ?? '';
    console.error('[login-v2] signInWithPassword failed:', msg);
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      return NextResponse.json({ error: 'Nieprawidłowy email lub hasło.' }, { status: 401 });
    }
    if (msg.includes('Email not confirmed')) {
      return NextResponse.json({ error: 'Adres email nie został potwierdzony. Sprawdź skrzynkę pocztową.' }, { status: 401 });
    }
    return NextResponse.json({ error: msg || 'Błąd logowania' }, { status: 401 });
  }

  console.log('[login-v2] auth OK, user:', authData.user.id, '| cookies to set:', pendingCookies.length);

  // Pobierz rolę przez service role (omija RLS)
  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role, status')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    console.error('[login-v2] Brak profilu dla:', authData.user.id, profileError);
    return NextResponse.json({ error: 'Profil użytkownika nie istnieje w systemie.' }, { status: 404 });
  }

  if (profile.status === 'inactive') {
    return NextResponse.json({ error: 'Konto jest nieaktywne.' }, { status: 403 });
  }

  const role   = DB_TO_ROLE[profile.role as DbRole];
  const target = role ? ROLE_DASHBOARD[role] : '/dashboard/employee';

  // Zbuduj odpowiedź i USTAW ciasteczka w nagłówkach Set-Cookie
  const response = NextResponse.json({ redirectUrl: target });

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, {
      ...(options as Parameters<typeof response.cookies.set>[2]),
      path: '/',        // Upewnij się że ciasteczko jest dla całej domeny
      sameSite: 'lax',  // Lax = wysyłane przy nawigacji top-level
      secure: true,     // HTTPS na Vercel
      httpOnly: false,  // Supabase wymaga dostępu z JS do refresh token
    });
  }

  console.log('[login-v2] returning redirectUrl:', target);
  return response;
}
