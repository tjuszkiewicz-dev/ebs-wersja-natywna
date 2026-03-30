// ── Centralised authorisation helpers ────────────────────────────────────
// All role-vs-view and role-vs-item checks go here so App.tsx and
// GlobalSearch.tsx share one implementation and cannot diverge.

import { Role } from '../types';

/** Map each role to the URL-prefix it is allowed to reach. */
const VIEW_PREFIX: Record<Role, string> = {
  [Role.SUPERADMIN]: 'admin-',
  [Role.HR]:         'hr-',
  [Role.EMPLOYEE]:   'emp-',
  [Role.DIRECTOR]:   'sales-',
  [Role.MANAGER]:    'sales-',
  [Role.ADVISOR]:    'sales-',
};

/**
 * Returns true when `role` may navigate to `view`.
 * Used in App.tsx to validate currentView after a role switch.
 */
export const canAccessView = (role: Role, view: string): boolean => {
  const prefix = VIEW_PREFIX[role];
  return prefix ? view.startsWith(prefix) : false;
};

/**
 * Returns true when a user with `userRole` may see a search result
 * that belongs to `itemRole`.
 * Used in GlobalSearch.tsx to filter the result list.
 */
export const canSeeSearchItem = (userRole: Role, itemRole: Role): boolean => {
  if (userRole === Role.SUPERADMIN) return true;
  if (userRole === itemRole) return true;
  // Managers see their own advisors; directors see both
  if (userRole === Role.MANAGER  && itemRole === Role.ADVISOR)  return true;
  if (userRole === Role.DIRECTOR &&
     (itemRole === Role.ADVISOR  || itemRole === Role.MANAGER))  return true;
  return false;
};
