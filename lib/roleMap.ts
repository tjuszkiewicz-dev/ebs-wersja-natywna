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
  | 'dyrektor'
  // E2a (agencja):
  | 'hr'
  | 'koordynator'
  | 'szef_koordynatorow'
  | 'platnik'
  | 'pracownik_tymczasowy'
  | 'owner';

/** TypeScript Role → wartość w kolumnie user_profiles.role */
export const ROLE_TO_DB: Record<Role, DbRole> = {
  [Role.SUPERADMIN]: 'superadmin',
  [Role.HR]:         'pracodawca',
  [Role.EMPLOYEE]:   'pracownik',
  [Role.ADVISOR]:    'partner',
  [Role.MANAGER]:    'menedzer',
  [Role.DIRECTOR]:   'dyrektor',
  [Role.HR_PANEL]:    'hr',
  [Role.COORDINATOR]: 'koordynator',
  [Role.PAYROLL]:     'platnik',
  [Role.TEMP_WORKER]: 'pracownik_tymczasowy',
};

/** Wartość DB → TypeScript Role enum */
export const DB_TO_ROLE: Record<DbRole, Role> = {
  superadmin: Role.SUPERADMIN,
  pracodawca: Role.HR,
  pracownik:  Role.EMPLOYEE,
  partner:    Role.ADVISOR,
  menedzer:   Role.MANAGER,
  dyrektor:   Role.DIRECTOR,
  hr:                   Role.HR_PANEL,
  koordynator:          Role.COORDINATOR,
  szef_koordynatorow:   Role.COORDINATOR, // rola własna — zachowuje się jak koordynator
  platnik:              Role.PAYROLL,
  pracownik_tymczasowy: Role.TEMP_WORKER,
  owner:                Role.SUPERADMIN,
};

/** Polska nazwa wyświetlana w UI */
export const ROLE_LABEL: Record<Role, string> = {
  [Role.SUPERADMIN]: 'Administrator',
  [Role.HR]:         'Pracodawca',
  [Role.EMPLOYEE]:   'Pracownik',
  [Role.ADVISOR]:    'Doradca',
  [Role.MANAGER]:    'Manager',
  [Role.DIRECTOR]:   'Dyrektor',
  [Role.HR_PANEL]:    'Panel HR',
  [Role.COORDINATOR]: 'Koordynator',
  [Role.PAYROLL]:     'Płatnik',
  [Role.TEMP_WORKER]: 'Pracownik Tymczasowy',
};

/** Ścieżka dashboardu dla danej roli — po zalogowaniu */
export const ROLE_DASHBOARD: Record<Role, string> = {
  [Role.SUPERADMIN]: '/dashboard/admin',
  [Role.HR]:         '/dashboard/employer',
  [Role.EMPLOYEE]:   '/dashboard/employee',
  [Role.ADVISOR]:    '/dashboard/network',
  [Role.MANAGER]:    '/dashboard/network',
  [Role.DIRECTOR]:   '/dashboard/network',
  [Role.HR_PANEL]:    '/dashboard/employer',
  [Role.COORDINATOR]: '/dashboard/admin',
  [Role.PAYROLL]:     '/dashboard/admin',
  [Role.TEMP_WORKER]: '/dashboard/agencja',
};
