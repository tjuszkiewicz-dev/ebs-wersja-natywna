import { Role } from '@/types/enums';
import type { AppId } from '@/lib/apps/registry';

/**
 * Aplikacje obsługiwane przez ISTNIEJĄCE dashboardy EBS — dokąd kierować wg roli.
 * null = brak istniejącego targetu (placeholder w /app/[appId]).
 *
 * Decyzja właściciela (2026-09-15): kafelek „Benefity" to aplikacja pracownicza
 * (portal z voucherami i sklepem benefitów) dla KAŻDEJ roli, która ją widzi —
 * superadmin/owner trafiają do portalu pracownika w trybie podglądu, a nie do
 * panelu administratora. Panel administratora ma własny kafelek „Administracja",
 * a „Agencja Pracy" otwiera ten sam panel od razu na sekcji agencji.
 */
export function existingAppTarget(appId: AppId, role: Role): string | null {
  switch (appId) {
    case 'benefity':
      if (role === Role.EMPLOYEE) return '/dashboard/employee';
      if (role === Role.HR) return '/dashboard/employer';
      if (role === Role.SUPERADMIN) return '/dashboard/employee';
      return null;
    case 'administracja':
      if (role === Role.SUPERADMIN) return '/dashboard/admin';
      return null;
    case 'agencja':
      if (role === Role.TEMP_WORKER) return '/dashboard/agencja';
      // superadmin → panel admina otwarty od razu na sekcji agencji (Administracja = ten sam panel od Pulpitu);
      // koordynator/płatnik → panel admina (ich menu i tak jest wyłącznie agencyjne)
      if (role === Role.SUPERADMIN) return '/dashboard/admin?view=hr-pracownicy';
      if (role === Role.COORDINATOR || role === Role.PAYROLL) return '/dashboard/admin';
      return null;
    default:
      return null; // przyszłe appki (E2+) dostaną własne trasy
  }
}
