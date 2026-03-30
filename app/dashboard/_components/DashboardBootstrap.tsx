'use client';

// ── DashboardBootstrap ────────────────────────────────────────────────────────
// Mostuje Supabase session ↔ StrattonContext.
// Pobiera profil Supabase po stronie klienta, wstrzykuje real User do kontekstu
// i wywołuje login(). Istniejące dashboard komponenty działają bez zmian.
//
// Renderuje spinner podczas ładowania.

import React, { useEffect, useRef, useState } from 'react';
import { StrattonProvider, useStrattonSystem } from '@/context/StrattonContext';
import { supabaseBrowser } from '@/lib/supabase';
import { supabaseProfileToUser } from '@/lib/supabaseToUser';

interface Props {
  children: React.ReactNode;
}

// Wewnętrzny sync — musi być wewnątrz StrattonProvider
function SupabaseSync({ children }: Props) {
  const { state, actions } = useStrattonSystem();
  const [ready, setReady] = useState(false);
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    (async () => {
      const { data: { user: authUser } } = await supabaseBrowser.auth.getUser();
      if (!authUser) {
        window.location.href = '/login';
        return;
      }

      // Pobierz profil z user_profiles (company_id dodane w migracji 004)
      const { data: profile } = await supabaseBrowser
        .from('user_profiles')
        .select('id, role, full_name, company_id, department, position, hire_date, contract_type, phone_number, iban')
        .eq('id', authUser.id)
        .single();

      if (!profile) {
        window.location.href = '/login';
        return;
      }

      const appUser = supabaseProfileToUser(
        profile,
        authUser.email ?? '',
        profile.company_id ?? undefined
      );

      // Wstrzyknij użytkownika do StrattonContext (upsert)
      actions.setUsers(prev => {
        const filtered = prev.filter(u => u.id !== appUser.id);
        return [...filtered, appUser];
      });

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
