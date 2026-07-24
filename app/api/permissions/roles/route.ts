// GET  /api/permissions/roles — role + ich uprawnienia (custom lub defaulty) + liczba userów
// POST — nowa rola własna (startuje bez uprawnień)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMS } from '@/lib/permissions/registry';
import { syncAgencyPermsForCustomizedRoles } from '@/lib/permissions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !auth.isOwner) return NextResponse.json({ error: 'Tylko właściciel (owner) zarządza uprawnieniami' }, { status: 403 });
  // auto-uzupełnienie nowych zakładek agencji dla ról customized (idempotentne)
  await syncAgencyPermsForCustomizedRoles().catch(() => {});
  const sb = supabaseServer() as any;
  const [roles, perms, profiles] = await Promise.all([
    sb.from('app_roles').select('*').order('is_system', { ascending: false }).order('label'),
    sb.from('role_permissions').select('role, permission'),
    sb.from('user_profiles').select('role'),
  ]);
  if (roles.error) return NextResponse.json({ error: roles.error.message }, { status: 500 });

  const permMap = new Map<string, string[]>();
  for (const p of perms.data ?? []) {
    if (!permMap.has(p.role)) permMap.set(p.role, []);
    permMap.get(p.role)!.push(p.permission);
  }
  const countMap = new Map<string, number>();
  for (const p of profiles.data ?? []) countMap.set(p.role, (countMap.get(p.role) || 0) + 1);

  const out = (roles.data ?? []).map((r: any) => ({
    ...r,
    permissions: r.role === 'superadmin' ? ALL_PERMISSIONS
      : r.customized ? (permMap.get(r.role) ?? [])
      : (DEFAULT_ROLE_PERMS[r.role] ?? []),
    locked: r.role === 'superadmin',
    users_count: countMap.get(r.role) || 0,
  }));
  return NextResponse.json({ roles: out });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !auth.isOwner) return NextResponse.json({ error: 'Tylko właściciel (owner) zarządza uprawnieniami' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const label = String(b.label || '').trim();
  if (label.length < 2) return NextResponse.json({ error: 'Podaj nazwę roli (min. 2 znaki)' }, { status: 400 });

  // klucz roli: bez polskich znaków, lowercase, podkreślenia
  const key = label.toLowerCase()
    .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!key) return NextResponse.json({ error: 'Nieprawidłowa nazwa' }, { status: 400 });

  const { data, error } = await (supabaseServer() as any).from('app_roles')
    .insert({ role: key, label, is_system: false, customized: true })
    .select().single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Rola „${key}" już istnieje` }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
