// POST /api/auth/login
// Autentykacja email/hasło przez Supabase — zwraca dane profilu dla Vite app.
// NIE ustawia sesji przeglądarkowej (używane przez lokalną aplikację Vite).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE } from '@/lib/roleMap';
import type { DbRole } from '@/types/database';

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

  // Klient z anon key — logowanie przez signInWithPassword nie wymaga service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Nieprawidłowy email lub hasło' }, { status: 401 });
  }

  // Pobierz profil z user_profiles (wymaga service role by ominąć RLS)
  const supabaseAdmin = createClient(
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

  return NextResponse.json({
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
}
