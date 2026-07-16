// Serwerowe sprawdzanie uprawnień (macierz w DB + defaulty z registry).
// superadmin ZAWSZE ma wszystko — nie da się go ograniczyć z panelu.
// Efektywne uprawnienia = (role_permissions jeśli rola customized, inaczej DEFAULT_ROLE_PERMS)
//                        + wyjątki user_permissions (grant/revoke).
import { supabaseServer } from '@/lib/supabase';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMS } from './registry';

export interface AuthLike { id: string; role: string }

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
