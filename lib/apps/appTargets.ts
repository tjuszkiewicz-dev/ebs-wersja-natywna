import { Role } from '@/types/enums';
import type { AppId } from '@/lib/apps/registry';

/**
 * Aplikacje obsługiwane przez ISTNIEJĄCE dashboardy EBS — dokąd kierować wg roli.
 * null = brak istniejącego targetu (placeholder w /app/[appId]).
 */
export function existingAppTarget(appId: AppId, role: Role): string | null {
  switch (appId) {
    case 'benefity':
      if (role === Role.EMPLOYEE) return '/dashboard/employee';
      if (role === Role.HR) return '/dashboard/employer';
      if (role === Role.SUPERADMIN) return '/dashboard/admin';
      return null;
    default:
      return null; // przyszłe appki (E2+) dostaną własne trasy
  }
}
