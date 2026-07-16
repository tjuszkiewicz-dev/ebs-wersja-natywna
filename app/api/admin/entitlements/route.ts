import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { DB_TO_ROLE } from '@/lib/roleMap';
import { isAppId, type AppId } from '@/lib/apps/registry';
import { appsForUser } from '@/lib/apps/access';
import { resolveEntitlementWrite } from '@/lib/apps/setEntitlement';
import { Role } from '@/types/enums';
import type { Database } from '@/types/database';
import type { DbRole } from '@/lib/roleMap';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Auth guard: validates session, checks SUPERADMIN role.
// Returns { userId, service } on success or a NextResponse error on failure.
// ---------------------------------------------------------------------------
async function validateSuperadmin(
  req: NextRequest,
): Promise<{ ok: true; userId: string; service: SupabaseClient } | NextResponse> {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return NextResponse.json({ error: 'Brak konfiguracji serwera' }, { status: 500 });
  }

  const nextRes = NextResponse.next();

  // SSR anon client — validates session from cookies
  const anon = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          nextRes.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: { user }, error: userError } = await anon.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Brak aktywnej sesji.' }, { status: 401 });
  }

  // Service-role client — bypasses RLS
  const service: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await service
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profil nie istnieje.' }, { status: 404 });
  }

  const callerRole = DB_TO_ROLE[profile.role as DbRole];
  if (callerRole !== Role.SUPERADMIN) {
    return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  }

  return { ok: true, userId: user.id, service };
}

// ---------------------------------------------------------------------------
// GET /api/admin/entitlements
// Returns all users with their computed app access and raw entitlements.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = await validateSuperadmin(req);
  if (auth instanceof NextResponse) return auth;

  const { service } = auth;

  const [profilesResult, entsResult] = await Promise.all([
    service.from('user_profiles').select('id, full_name, role'),
    service.from('user_app_entitlements').select('user_id, app_id, effect'),
  ]);

  if (profilesResult.error || !profilesResult.data) {
    return NextResponse.json({ error: 'Błąd pobierania profili.' }, { status: 500 });
  }
  if (entsResult.error) {
    return NextResponse.json({ error: 'Błąd pobierania uprawnień.' }, { status: 500 });
  }

  // Group entitlements by user
  const entsByUser = new Map<string, { app_id: AppId; effect: 'grant' | 'revoke' }[]>();
  for (const e of entsResult.data ?? []) {
    if (!isAppId(e.app_id)) continue;
    const arr = entsByUser.get(e.user_id) ?? [];
    arr.push({ app_id: e.app_id as AppId, effect: e.effect as 'grant' | 'revoke' });
    entsByUser.set(e.user_id, arr);
  }

  const users = profilesResult.data.map((p: { id: string; full_name: string | null; role: string }) => {
    const role = DB_TO_ROLE[p.role as DbRole];
    const entitlements = entsByUser.get(p.id) ?? [];
    const apps = role ? appsForUser(role, entitlements) : [];
    return { id: p.id, full_name: p.full_name, role: p.role, apps, entitlements };
  });

  return NextResponse.json({ users });
}

// ---------------------------------------------------------------------------
// POST /api/admin/entitlements
// Body: { user_id: string, app_id: string, desiredVisible: boolean }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await validateSuperadmin(req);
  if (auth instanceof NextResponse) return auth;

  const { userId: callerId, service } = auth;

  let body: { user_id?: unknown; app_id?: unknown; desiredVisible?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe ciało żądania.' }, { status: 400 });
  }

  const { user_id, app_id, desiredVisible } = body;

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'Brak user_id.' }, { status: 400 });
  }
  if (!app_id || typeof app_id !== 'string' || !isAppId(app_id)) {
    return NextResponse.json({ error: 'Nieprawidłowe app_id.' }, { status: 400 });
  }
  if (typeof desiredVisible !== 'boolean') {
    return NextResponse.json({ error: 'Brak desiredVisible.' }, { status: 400 });
  }

  // Load target user's role and current entitlements
  const [targetResult, currentResult] = await Promise.all([
    service.from('user_profiles').select('role').eq('id', user_id).single(),
    service.from('user_app_entitlements').select('app_id, effect').eq('user_id', user_id),
  ]);

  if (targetResult.error || !targetResult.data) {
    return NextResponse.json({ error: 'Cel nie istnieje.' }, { status: 404 });
  }
  if (currentResult.error) {
    return NextResponse.json({ error: 'Błąd pobierania uprawnień.' }, { status: 500 });
  }

  const targetRole = DB_TO_ROLE[targetResult.data.role as DbRole];
  if (!targetRole) {
    return NextResponse.json({ error: 'Nieznana rola użytkownika.' }, { status: 400 });
  }

  const current = (currentResult.data ?? [])
    .filter((e: { app_id: string; effect: string }) => isAppId(e.app_id))
    .map((e: { app_id: string; effect: string }) => ({
      app_id: e.app_id as AppId,
      effect: e.effect as 'grant' | 'revoke',
    }));

  const op = resolveEntitlementWrite(targetRole, current, app_id as AppId, desiredVisible);

  if (op.op === 'delete') {
    const { error: delError } = await service
      .from('user_app_entitlements')
      .delete()
      .eq('user_id', user_id)
      .eq('app_id', app_id);

    if (delError) {
      return NextResponse.json({ error: 'Błąd usuwania wpisu.' }, { status: 500 });
    }
  } else {
    const { error: upsertError } = await service
      .from('user_app_entitlements')
      .upsert(
        { user_id, app_id, effect: op.effect, granted_by: callerId },
        { onConflict: 'user_id,app_id' },
      );

    if (upsertError) {
      return NextResponse.json({ error: 'Błąd zapisu uprawnienia.' }, { status: 500 });
    }
  }

  // Recompute entitlements after the change
  const { data: newEnts } = await service
    .from('user_app_entitlements')
    .select('app_id, effect')
    .eq('user_id', user_id);

  const newEntitlements = (newEnts ?? [])
    .filter((e: { app_id: string; effect: string }) => isAppId(e.app_id))
    .map((e: { app_id: string; effect: string }) => ({
      app_id: e.app_id as AppId,
      effect: e.effect as 'grant' | 'revoke',
    }));

  const apps = appsForUser(targetRole, newEntitlements);

  return NextResponse.json({ ok: true, apps });
}
