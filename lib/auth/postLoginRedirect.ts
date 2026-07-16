import { APPS, type AppId } from '@/lib/apps/registry';
import { Role } from '@/types/enums';
import { existingAppTarget } from '@/lib/apps/appTargets';

export function postLoginRedirect(apps: AppId[]): string {
  if (apps.length === 1) {
    const app = APPS.find(a => a.id === apps[0]);
    return app ? app.route : '/launcher';
  }
  return '/launcher';
}

/**
 * Finalny URL po zalogowaniu: jedna appka → od razu jej konkretny cel per rola
 * (bez pośredniego hopu przez /app/[appId]); wiele/zero → /launcher.
 */
export function resolvePostLogin(role: Role, apps: AppId[]): string {
  if (apps.length !== 1) return '/launcher';
  return existingAppTarget(apps[0], role) ?? postLoginRedirect(apps);
}
