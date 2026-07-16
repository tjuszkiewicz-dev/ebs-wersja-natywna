import { APPS, type AppId } from '@/lib/apps/registry';
import type { Role } from '@/types/enums';

export function resolveEntitlementWrite(
  role: Role,
  _current: { app_id: AppId; effect: 'grant' | 'revoke' }[],
  appId: AppId,
  desiredVisible: boolean,
): { op: 'delete' } | { op: 'upsert'; effect: 'grant' | 'revoke' } {
  const isDefault = APPS.find(a => a.id === appId)?.defaultRoles.includes(role) ?? false;
  if (desiredVisible === isDefault) return { op: 'delete' };
  return { op: 'upsert', effect: desiredVisible ? 'grant' : 'revoke' };
}
