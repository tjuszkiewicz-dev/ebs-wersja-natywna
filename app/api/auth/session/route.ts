// GET /api/auth/session
// Zwraca rolę zalogowanego użytkownika + redirect URL.
// Używane przez stronę logowania po browser-side signInWithPassword.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE, ROLE_DASHBOARD } from '@/lib/roleMap';
import type { DbRole, Database } from '@/types/database';

export async function GET(req: NextRequest) {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return NextResponse.json({ error: 'Brak konfiguracji serwera' }, { status: 500 });
  }

  // Odczytaj sesję z ciasteczek żądania (ustawione przez createBrowserClient)
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {
        // GET endpoint — nie ustawiamy cookies
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Brak sesji' }, { status: 401 });
  }

  // Pobierz rolę przez service role (omija RLS)
  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('[session] Brak profilu:', user.id, profileError);
    return NextResponse.json({ error: 'Profil nie istnieje w systemie' }, { status: 404 });
  }

  if (profile.status === 'inactive') {
    return NextResponse.json({ error: 'Konto jest nieaktywne' }, { status: 403 });
  }

  const role   = DB_TO_ROLE[profile.role as DbRole];
  const target = role ? ROLE_DASHBOARD[role] : '/dashboard/employee';

  return NextResponse.json({ redirectUrl: target });
}
