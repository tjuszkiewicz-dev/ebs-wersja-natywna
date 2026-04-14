// GET /api/auth/me
// Zwraca profil zalogowanego użytkownika + dane firmy przez service role (omija RLS).
// Używany przez DashboardBootstrap po stronie klienta.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function GET(req: NextRequest) {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return NextResponse.json({ error: 'Brak konfiguracji serwera' }, { status: 500 });
  }

  // Sprawdź sesję z ciasteczek
  const nextRes = NextResponse.next();
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          nextRes.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Brak aktywnej sesji.' }, { status: 401 });
  }

  // Pobierz dane przez service role — omija RLS
  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, role, full_name, company_id, department, position, hire_date, contract_type, phone_number, iban, status')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('[me] brak profilu dla:', user.id, profileError?.message);
    return NextResponse.json({ error: 'Profil nie istnieje.' }, { status: 404 });
  }

  let company = null;
  if (profile.company_id) {
    const { data: companyRow } = await admin
      .from('companies')
      .select('id, name, nip, balance_pending, balance_active, address_street, address_city, address_zip, custom_voucher_validity_days, custom_payment_terms_days')
      .eq('id', profile.company_id)
      .single();
    company = companyRow ?? null;
  }

  // Pobierz aktualne saldo voucherów z ledgera
  const { data: voucherAccount } = await admin
    .from('voucher_accounts')
    .select('balance')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    user: {
      id:       user.id,
      email:    user.email ?? '',
    },
    profile: {
      ...profile,
      voucherBalance: voucherAccount?.balance ?? 0,
    },
    company,
  });
}
