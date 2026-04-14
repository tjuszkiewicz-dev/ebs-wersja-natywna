// GET /api/auth/role
// Odczytuje aktywną sesję z ciasteczek (ustawionych przez createBrowserClient)
// i zwraca URL dashboardu odpowiedni dla roli zalogowanego użytkownika.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE, ROLE_DASHBOARD } from '@/lib/roleMap';
import type { DbRole, Database } from '@/types/database';

export async function GET(req: NextRequest) {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[role] ENV check — url:', !!supabaseUrl, '| anon:', !!supabaseAnon, '| service:', !!serviceKey);

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return NextResponse.json({ error: 'Brak konfiguracji serwera' }, { status: 500 });
  }

  // Zaloguj jakie ciasteczka dotarły do serwera
  const allCookies = req.cookies.getAll();
  const sbCookies  = allCookies.filter(c => c.name.startsWith('sb-'));
  console.log('[role] ciasteczka w żądaniu:', allCookies.length, '| Supabase (sb-*):', sbCookies.length);
  sbCookies.forEach(c => console.log('[role]   cookie:', c.name, '=', c.value.slice(0, 40) + '...'));

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

  console.log('[role] wywołuję supabase.auth.getUser()...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('[role] BRAK SESJI — getUser error:', userError?.message ?? 'null user');
    return NextResponse.json(
      { error: 'Brak aktywnej sesji.', detail: userError?.message ?? 'user is null' },
      { status: 401 }
    );
  }

  console.log('[role] sesja OK — user.id:', user.id, '| email:', user.email);

  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('[role] BRAK PROFILU dla:', user.id, '| error:', profileError?.message);
    return NextResponse.json(
      { error: 'Profil użytkownika nie istnieje w systemie.', detail: profileError?.message ?? 'null profile' },
      { status: 404 }
    );
  }

  console.log('[role] profil:', { role: profile.role, status: profile.status });

  if (profile.status === 'inactive') {
    return NextResponse.json({ error: 'Konto jest nieaktywne.' }, { status: 403 });
  }

  const role       = DB_TO_ROLE[profile.role as DbRole];
  const redirectUrl = role ? ROLE_DASHBOARD[role] : '/dashboard/employee';

  console.log('[role] redirectUrl:', redirectUrl);
  return NextResponse.json({ redirectUrl });
}
