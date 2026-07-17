// Serwerowe sprawdzanie uprawnień (macierz w DB + defaulty z registry).
// superadmin ZAWSZE ma wszystko — nie da się go ograniczyć z panelu.
// Efektywne uprawnienia = (role_permissions jeśli rola customized, inaczej DEFAULT_ROLE_PERMS)
//                        + wyjątki user_permissions (grant/revoke).
import { supabaseServer } from '@/lib/supabase';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMS, AGENCJA_TABS } from './registry';

export interface AuthLike { id: string; role: string }

// Auto-sync uprawnień agencji dla ról „customized" (np. szef_koordynatorow):
// gdy do registry dojdzie NOWA zakładka agencji, role już „agencyjna" dostają
// brakujące automatycznie. Idempotentne (dodaje tylko braki).
export async function syncAgencyPermsForCustomizedRoles(): Promise<{ role: string; added: string[] }[]> {
  const sb = supabaseServer() as any;
  const { data: roles } = await sb.from('app_roles').select('role').eq('customized', true);
  const result: { role: string; added: string[] }[] = [];
  for (const r of roles ?? []) {
    const role = (r as any).role;
    if (role === 'superadmin') continue;
    const { data: existing } = await sb.from('role_permissions').select('permission').eq('role', role);
    const have = new Set((existing ?? []).map((x: any) => x.permission));
    if (!AGENCJA_TABS.some(p => have.has(p))) continue; // rola nie jest „agencyjna" — pomijamy
    const missing = AGENCJA_TABS.filter(p => !have.has(p));
    if (!missing.length) continue;
    const { error } = await sb.from('role_permissions').insert(missing.map(p => ({ role, permission: p })));
    if (!error) result.push({ role, added: missing });
  }
  return result;
}

export async function getEffectivePermissions(userId: string | null, role: string): Promise<Set<string>> {
  if (role === 'superadmin') return new Set(ALL_PERMISSIONS);
  const sb = supabaseServer() as any;
  const [roleRow, rolePerms, userPerms] = await Promise.all([
    sb.from('app_roles').select('customized').eq('role', role).maybeSingle(),
    sb.from('role_permissions').select('permission').eq('role', role),
    userId ? sb.from('user_permissions').select('permission, effect').eq('user_id', userId) : Promise.resolve({ data: [] as any[] }),
  ]);

  const base = roleRow.data?.customized
    ? (rolePerms.data ?? []).map((r: any) => r.permission)
    : (DEFAULT_ROLE_PERMS[role] ?? []);

  const set = new Set<string>(base);
  for (const u of (userPerms.data ?? []) as { permission: string; effect: string }[]) {
    if (u.effect === 'revoke') set.delete(u.permission);
    else set.add(u.permission);
  }
  return set;
}

export async function can(auth: AuthLike, permission: string): Promise<boolean> {
  if (auth.role === 'superadmin') return true;
  const perms = await getEffectivePermissions(auth.id, auth.role);
  return perms.has(permission);
}

export async function canAny(auth: AuthLike, permissions: string[]): Promise<boolean> {
  if (auth.role === 'superadmin') return true;
  const perms = await getEffectivePermissions(auth.id, auth.role);
  return permissions.some(p => perms.has(p));
}
