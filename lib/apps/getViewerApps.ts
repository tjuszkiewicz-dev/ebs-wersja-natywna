// ── getViewerApps ─────────────────────────────────────────────────────────────
// Wspólny helper serwerowy dla stron shell: sesja + rola + dostęp do appek.
// Używany przez (shell)/layout.tsx ORAZ strony shell — bez duplikacji.

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/database';
import { DB_TO_ROLE, type DbRole } from '@/lib/roleMap';
import { Role } from '@/types/enums';
import { appsForUser } from '@/lib/apps/access';
import { getEntitlements } from '@/lib/apps/getEntitlements';
import type { AppId } from '@/lib/apps/registry';

export interface ViewerApps {
  userId: string;
  role: Role;
  apps: AppId[];
}

export async function getViewerApps(): Promise<ViewerApps> {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const cookieStore = await cookies();

  // Klient SSR — walidacja sesji z ciasteczek
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component nie może zapisywać ciasteczek podczas renderu —
          // odświeżenie tokenu i tak robi middleware (oficjalny wzorzec @supabase/ssr).
        }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Service role — odczyt user_profiles i entitlements z pominięciem RLS
  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const dbRole = profile?.role as DbRole | undefined;
  const role   = (dbRole ? DB_TO_ROLE[dbRole] : undefined) ?? Role.EMPLOYEE; // nieznana rola → najbezpieczniej jak pracownik

  const entitlements = await getEntitlements(admin, user.id);
  const apps = appsForUser(role, entitlements);

  return { userId: user.id, role, apps };
}
