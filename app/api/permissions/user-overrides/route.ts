// GET    /api/permissions/user-overrides — lista wyjątków per użytkownik (z nazwiskami)
// POST   {user_id, permission, effect: grant|revoke} — dodaj/zmień wyjątek
// DELETE ?userId=&permission= — usuń wyjątek
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { ALL_PERMISSIONS } from '@/lib/permissions/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const sb = supabaseServer() as any;
  const [ov, profiles] = await Promise.all([
    sb.from('user_permissions').select('*').order('created_at', { ascending: false }),
    sb.from('user_profiles').select('id, full_name, role'),
  ]);
  if (ov.error) return NextResponse.json({ error: ov.error.message }, { status: 500 });
  const pMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
  const overrides = (ov.data ?? []).map((o: any) => ({
    ...o,
    user_name: (pMap.get(o.user_id) as any)?.full_name ?? o.user_id,
    user_role: (pMap.get(o.user_id) as any)?.role ?? null,
  }));
  return NextResponse.json({ overrides });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !ALL_PERMISSIONS.includes(b.permission)) return NextResponse.json({ error: 'Brak użytkownika lub nieprawidłowe uprawnienie' }, { status: 400 });
  const effect = b.effect === 'revoke' ? 'revoke' : 'grant';
  const { error } = await (supabaseServer() as any).from('user_permissions')
    .upsert({ user_id: b.user_id, permission: b.permission, effect }, { onConflict: 'user_id,permission' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const permission = searchParams.get('permission');
  if (!userId || !permission) return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
  const { error } = await (supabaseServer() as any).from('user_permissions').delete().eq('user_id', userId).eq('permission', permission);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
