// POST /api/auth/login
// Autentykacja email/hasło przez Supabase.
// Używa createServerClient z @supabase/ssr — ustawia ciasteczka sesji w nagłówkach Set-Cookie.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE } from '@/lib/roleMap';
import type { DbRole } from '@/types/database';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
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

  // Zbieramy ciasteczka które Supabase chce ustawić, żeby potem przypiąć je do odpowiedzi
  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  // createServerClient – potrafi zapisywać sesję przez nagłówki Set-Cookie
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => cookiesToSet.push(...cookies),
      },
    }
  );

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Nieprawidłowy email lub hasło' }, { status: 401 });
  }

  // Pobierz profil z user_profiles przez service role (omija RLS)
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, role, full_name, company_id, department, position, status, pesel, phone_number')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profil użytkownika nie istnieje' }, { status: 404 });
  }

  if (profile.status === 'inactive') {
    return NextResponse.json({ error: 'Konto jest nieaktywne. Skontaktuj się z administratorem.' }, { status: 403 });
  }

  const dbRole = profile.role as DbRole;
  const role = DB_TO_ROLE[dbRole] ?? DB_TO_ROLE['pracownik'];
  const displayName = profile.full_name || email.split('@')[0];

  const res = NextResponse.json({
    id:           authData.user.id,
    email:        authData.user.email ?? email,
    role,
    companyId:    profile.company_id ?? '',
    voucherBalance: 0,
    status:       profile.status === 'anonymized' ? 'ANONYMIZED' : 'ACTIVE',
    name:         displayName,
    pesel:        profile.pesel ?? undefined,
    department:   profile.department ?? undefined,
    position:     profile.position ?? undefined,
    isTwoFactorEnabled: false,
    identity: {
      firstName: displayName.split(' ')[0] ?? '',
      lastName:  displayName.split(' ').slice(1).join(' ') ?? '',
    },
    organization: {
      department: profile.department ?? undefined,
      position:   profile.position   ?? undefined,
    },
    contract: { type: 'UOP', startDate: '' },
    finance:  { voucherBalance: 0, cashBalance: 0, totalEarned: 0 },
    address:  {},
  });

  // Przypin sesji do odpowiedzi — przeglądarka otrzyma Set-Cookie i zapisze sesję
  cookiesToSet.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
  });

  return res;
}
