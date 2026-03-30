'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { ROLE_DASHBOARD } from '@/lib/roleMap';
import { Role } from '@/types';
import type { DbRole } from '@/types/database';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError(authError?.message ?? 'Błąd logowania');
      setLoading(false);
      return;
    }

    // Pobierz rolę użytkownika z profilu
    const { data: profile } = await supabaseBrowser
      .from('user_profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role    = (profile?.role ?? 'pracownik') as DbRole;
    const roleMap: Record<DbRole, string> = {
      superadmin: ROLE_DASHBOARD[Role.SUPERADMIN],
      pracodawca: ROLE_DASHBOARD[Role.HR],
      pracownik:  ROLE_DASHBOARD[Role.EMPLOYEE],
      partner:    ROLE_DASHBOARD[Role.ADVISOR],
      menedzer:   ROLE_DASHBOARD[Role.MANAGER],
      dyrektor:   ROLE_DASHBOARD[Role.DIRECTOR],
    };

    router.push(roleMap[role] ?? '/dashboard/employee');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Eliton Benefits
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Hasło</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition"
          >
            {loading ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </main>
  );
}
