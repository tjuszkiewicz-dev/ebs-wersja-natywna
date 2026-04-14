'use client';

// ── DashboardBootstrap ────────────────────────────────────────────────────────
// Mostuje Supabase session ↔ StrattonContext.
// Pobiera profil przez /api/auth/me (service role, omija RLS),
// wstrzykuje real User do kontekstu i wywołuje login().
//
// Renderuje spinner podczas ładowania.

import React, { useEffect, useRef, useState } from 'react';
import { StrattonProvider, useStrattonSystem } from '@/context/StrattonContext';
import { supabaseProfileToUser } from '@/lib/supabaseToUser';

interface Props {
  children: React.ReactNode;
}

// Typ odpowiedzi z /api/auth/me
interface MeResponse {
  user:    { id: string; email: string };
  profile: {
    id: string; role: string; full_name: string | null;
    company_id: string | null; department: string | null;
    position: string | null; hire_date: string | null;
    contract_type: string | null; phone_number: string | null;
    iban: string | null; status: string | null;
  };
  company: {
    id: string; name: string | null; nip: string | null;
    balance_pending: number | null; balance_active: number | null;
    address_street: string | null; address_city: string | null;
    address_zip: string | null; custom_voucher_validity_days: number | null;
    custom_payment_terms_days: number | null;
  } | null;
}

// Wewnętrzny sync — musi być wewnątrz StrattonProvider
function SupabaseSync({ children }: Props) {
  const { actions } = useStrattonSystem();
  const [ready, setReady] = useState(false);
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    (async () => {
      // Pobierz profil + firmę przez API (service role, omija RLS)
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });

      if (!res.ok) {
        console.error('[DashboardBootstrap] /api/auth/me →', res.status);
        window.location.href = '/login';
        return;
      }

      const data: MeResponse = await res.json();
      const { user: authUser, profile, company: companyRow } = data;

      const appUser = supabaseProfileToUser(
        profile,
        authUser.email,
        profile.company_id ?? undefined
      );

      // Wstrzyknij użytkownika do StrattonContext (upsert)
      actions.setUsers(prev => {
        const filtered = prev.filter(u => u.id !== appUser.id);
        return [...filtered, appUser];
      });

      // Wstrzyknij firmę jeśli dostępna
      if (companyRow) {
        actions.setCompanies(prev => {
          const exists = prev.some(c => c.id === companyRow.id);
          if (exists) return prev;
          return [...prev, {
            id:                     companyRow.id,
            name:                   companyRow.name ?? '',
            nip:                    companyRow.nip ?? '',
            balancePending:         companyRow.balance_pending ?? 0,
            balanceActive:          companyRow.balance_active ?? 0,
            voucherValidityDays:    companyRow.custom_voucher_validity_days ?? 7,
            customPaymentTermsDays: companyRow.custom_payment_terms_days ?? undefined,
            address: companyRow.address_city ? {
              street:     companyRow.address_street ?? '',
              city:       companyRow.address_city ?? '',
              postalCode: companyRow.address_zip ?? '',
              country:    'Polska',
            } : undefined,
          }];
        });
      }

      // Ustaw jako bieżący użytkownik
      actions.login(appUser.id);
      setReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Ładowanie panelu…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Owija dashboard w StrattonProvider + syncuje sesję Supabase */
export function DashboardBootstrap({ children }: Props) {
  return (
    <StrattonProvider>
      <SupabaseSync>{children}</SupabaseSync>
    </StrattonProvider>
  );
}
