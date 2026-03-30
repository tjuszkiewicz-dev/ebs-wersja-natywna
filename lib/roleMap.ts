// ── Mapowanie ról między TypeScript enum a wartościami w bazie danych ─────────
// Jedyne miejsce w projekcie gdzie ta konwersja jest zdefiniowana.
// TypeScript (Role enum) używa angielskich stałych — nie zmieniamy istniejącego kodu.
// Supabase (user_profiles.role) używa polskich wartości ASCII (bez ogonków — bezpieczne dla PG CHECK).

import { Role } from '../types';

export type DbRole =
  | 'superadmin'
  | 'pracodawca'
  | 'pracownik'
  | 'partner'
  | 'menedzer'
  | 'dyrektor';

/** TypeScript Role → wartość w kolumnie user_profiles.role */
export const ROLE_TO_DB: Record<Role, DbRole> = {
  [Role.SUPERADMIN]: 'superadmin',
  [Role.HR]:         'pracodawca',
  [Role.EMPLOYEE]:   'pracownik',
  [Role.ADVISOR]:    'partner',
  [Role.MANAGER]:    'menedzer',
  [Role.DIRECTOR]:   'dyrektor',
};

/** Wartość DB → TypeScript Role enum */
export const DB_TO_ROLE: Record<DbRole, Role> = {
  superadmin: Role.SUPERADMIN,
  pracodawca: Role.HR,
  pracownik:  Role.EMPLOYEE,
  partner:    Role.ADVISOR,
  menedzer:   Role.MANAGER,
  dyrektor:   Role.DIRECTOR,
};

/** Polska nazwa wyświetlana w UI */
export const ROLE_LABEL: Record<Role, string> = {
  [Role.SUPERADMIN]: 'Administrator',
  [Role.HR]:         'Pracodawca',
  [Role.EMPLOYEE]:   'Pracownik',
  [Role.ADVISOR]:    'Doradca',
  [Role.MANAGER]:    'Manager',
  [Role.DIRECTOR]:   'Dyrektor',
};

/** Ścieżka dashboardu dla danej roli — po zalogowaniu */
export const ROLE_DASHBOARD: Record<Role, string> = {
  [Role.SUPERADMIN]: '/dashboard/admin',
  [Role.HR]:         '/dashboard/employer',
  [Role.EMPLOYEE]:   '/dashboard/employee',
  [Role.ADVISOR]:    '/dashboard/network',
  [Role.MANAGER]:    '/dashboard/network',
  [Role.DIRECTOR]:   '/dashboard/network',
};
