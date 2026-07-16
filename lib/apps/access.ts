import { APPS, type AppId } from '@/lib/apps/registry';
import { Role } from '@/types/enums';
import type { Entitlement } from '@/types/entitlement';

export function appsForUser(role: Role, entitlements: Entitlement[]): AppId[] {
  if (role === Role.SUPERADMIN) return APPS.map(a => a.id);
  const set = new Set<AppId>(
    APPS.filter(a => a.defaultRoles.includes(role)).map(a => a.id),
  );
  for (const e of entitlements) {
    if (e.effect === 'revoke') set.delete(e.app_id);
    else if (e.effect === 'grant') set.add(e.app_id);
  }
  return [...set];
}

export function canAccessApp(
  role: Role,
  entitlements: Entitlement[],
  appId: AppId,
): boolean {
  return appsForUser(role, entitlements).includes(appId);
}
