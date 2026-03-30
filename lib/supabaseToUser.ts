// ── Mapowanie Supabase profile → app User type ────────────────────────────────
// Konwertuje dane z user_profiles + auth.users na wewnętrzny typ User.
// Używane w DashboardBootstrap do synchronizacji sesji z StrattonContext.

import { DB_TO_ROLE } from './roleMap';
import type { DbRole } from '../types/database';
import type { User } from '../types';

interface SupabaseProfile {
  id:           string;
  role:         DbRole;
  full_name:    string | null;
  department:   string | null;
  position:     string | null;
  hire_date:    string | null;
  contract_type: 'UOP' | 'UZ' | null;
  phone_number: string | null;
  iban:         string | null;
}

/** Buduje minimalny obiekt User z profilu Supabase */
export function supabaseProfileToUser(
  profile: SupabaseProfile,
  email: string,
  companyId?: string
): User {
  const role = DB_TO_ROLE[profile.role] ?? DB_TO_ROLE['pracownik'];

  return {
    id:             profile.id,
    role,
    companyId:      companyId ?? '',
    voucherBalance: 0,           // pobierane osobno przez getVoucherBalance()
    status:         'ACTIVE',
    name:           profile.full_name ?? email.split('@')[0],
    email,
    department:     profile.department   ?? undefined,
    position:       profile.position     ?? undefined,
    isTwoFactorEnabled: false,
    identity: {
      firstName: (profile.full_name ?? '').split(' ')[0] ?? '',
      lastName:  (profile.full_name ?? '').split(' ').slice(1).join(' ') ?? '',
    },
    organization: {
      department: profile.department ?? undefined,
      position:   profile.position   ?? undefined,
    },
    contract: profile.contract_type
      ? {
          type:      profile.contract_type,
          startDate: profile.hire_date ?? '',
        }
      : { type: 'UOP', startDate: '' },
    finance: {
      voucherBalance: 0,
      cashBalance:    0,
      totalEarned:    0,
    },
    address: {},
  } as unknown as User;
}
