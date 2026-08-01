import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, AlertCircle, Loader2, Users, ChevronDown, Lock, Shield, Trash2, X, ShieldAlert } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  role: 'superadmin' | 'pracodawca' | 'pracownik';
  full_name?: string;
  position?: string;
  company_id?: string;
  company_name?: string;
  status: 'active' | 'inactive' | 'anonymized';
  created_at: string;
  // Last login dari auth.users
  last_signed_in?: string;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'SuperAdmin',
  pracodawca: 'HR',
  pracownik: 'Pracownik',
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-red-50 text-red-700 border-red-200',
  pracodawca: 'bg-blue-50 text-blue-700 border-blue-200',
  pracownik: 'bg-green-50 text-green-700 border-green-200',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-50 text-slate-700 border-slate-200',
  anonymized: 'bg-orange-50 text-orange-700 border-orange-200',
};

// ── Usuwanie konta (Task 15 / E5) — kształt odpowiedzi wg app/api/users/[id]/purge/route.ts ──
type PurgeMode = 'purge' | 'anonymize';

interface PurgeImpactItem {
  label: string;
  key: string;
  count: number;
}

interface PurgeRetainedItem {
  table: string;
  note: string;
}

interface PurgeSummary {
  mode: PurgeMode;
  footprint: Record<string, number>;
  footprintTotal: number;
  footprintDetails: { key: string; count: number }[];
  owned: string[];
  detached: string[];
  kept: string[];
  dbHandled: string[];
  impact: PurgeImpactItem[];
  retainedPersonalData: PurgeRetainedItem[];
  confirmPhrase: string;
  profile: { full_name: string | null; role: string };
}

interface PurgeResult {
  ok: true;
  mode: PurgeMode;
  footprint: Record<string, number>;
  warnings: string[];
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Usuwanie konta (wyłącznie właściciel) ──────────────────────────────────
  const [isOwner, setIsOwner] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<AdminUser | null>(null);
  const [purgeSummary, setPurgeSummary] = useState<PurgeSummary | null>(null);
  const [purgeSummaryLoading, setPurgeSummaryLoading] = useState(false);
  const [purgeSummaryError, setPurgeSummaryError] = useState<string | null>(null);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');
  const [purgeSubmitting, setPurgeSubmitting] = useState(false);
  const [purgeSubmitError, setPurgeSubmitError] = useState<string | null>(null);
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);

  useEffect(() => {
    fetch('/api/me/permissions', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { is_owner: false }))
      .then((d) => setIsOwner(!!d.is_owner))
      .catch(() => setIsOwner(false));
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania użytkowników');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch = u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleResetPassword = useCallback(
    async (userId: string, email: string) => {
      if (!resetPasswordValue) {
        alert('Wpisz hasło');
        return;
      }
      setResetPasswordLoading(true);
      try {
        const res = await fetch(`/api/users/${userId}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: resetPasswordValue }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        alert(`✅ Hasło zmienione na "${resetPasswordValue}" dla ${email}`);
        setResetPasswordUserId(null);
        setResetPasswordValue('');
      } catch (e: any) {
        alert(`❌ Błąd: ${e.message}`);
      } finally {
        setResetPasswordLoading(false);
      }
    },
    [resetPasswordValue]
  );

  const handleAction = useCallback(
    async (userId: string, action: 'activate' | 'deactivate' | 'anonymize') => {
      if (action === 'anonymize' && !confirm('Na pewno anonimizować tego użytkownika? (GDPR)')) return;

      setActionLoading(userId);
      try {
        const endpoint = action === 'anonymize'
          ? '/api/users/{id}/anonymize'.replace('{id}', userId)
          : `/api/users/${userId}/${action}`;

        const method = action === 'anonymize' ? 'POST' : 'PATCH';
        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        // Refresh list
        await fetchUsers();
        setExpandedUserId(null);
      } catch (e: any) {
        alert(`❌ Błąd: ${e.message}`);
      } finally {
        setActionLoading(null);
      }
    },
    [fetchUsers]
  );

  const openPurgeModal = useCallback(async (user: AdminUser) => {
    setPurgeTarget(user);
    setPurgeSummary(null);
    setPurgeSummaryError(null);
    setPurgeConfirmInput('');
    setPurgeSubmitError(null);
    setPurgeResult(null);
    setPurgeSummaryLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/purge`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPurgeSummary(data as PurgeSummary);
    } catch (e: any) {
      setPurgeSummaryError(e.message ?? 'Błąd pobierania podsumowania');
    } finally {
      setPurgeSummaryLoading(false);
    }
  }, []);

  const closePurgeModal = useCallback(() => {
    if (purgeSubmitting) return; // nie zamykaj w trakcie wysyłki
    setPurgeTarget(null);
    setPurgeSummary(null);
    setPurgeSummaryError(null);
    setPurgeConfirmInput('');
    setPurgeSubmitError(null);
    setPurgeResult(null);
  }, [purgeSubmitting]);

  const confirmReady =
    !!purgeSummary && purgeConfirmInput.trim() === purgeSummary.confirmPhrase;

  const handlePurgeConfirm = useCallback(async () => {
    if (!purgeTarget || !purgeSummary || purgeSubmitting) return;
    if (purgeConfirmInput.trim() !== purgeSummary.confirmPhrase) return;

    setPurgeSubmitting(true);
    setPurgeSubmitError(null);
    try {
      const res = await fetch(`/api/users/${purgeTarget.id}/purge`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: purgeConfirmInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPurgeResult(data as PurgeResult);
      setExpandedUserId(null);
      await fetchUsers();
    } catch (e: any) {
      setPurgeSubmitError(e.message ?? 'Błąd usuwania konta');
    } finally {
      setPurgeSubmitting(false);
    }
  }, [purgeTarget, purgeSummary, purgeConfirmInput, purgeSubmitting, fetchUsers]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        {/* Search & Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj po emailu..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Odśwież
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Rola:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Wszystkie</option>
              <option value="superadmin">SuperAdmin</option>
              <option value="pracodawca">HR</option>
              <option value="pracownik">Pracownik</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Wszystkie</option>
              <option value="active">Aktywny</option>
              <option value="inactive">Nieaktywny</option>
              <option value="anonymized">Anonimizowany</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex justify-center">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      )}

      {/* Users Table */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm">
                {search || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Brak wyników'
                  : 'Brak użytkowników'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Rola</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Imię i Nazwisko</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Stanowisko</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Firma</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Utworzony</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ostatnie logowanie</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((user) => (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-sm text-slate-700 font-medium">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded border text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{user.full_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{user.position || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{user.company_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded border text-xs font-medium ${STATUS_COLORS[user.status]}`}>
                            {user.status === 'active' ? 'Aktywny' : user.status === 'inactive' ? 'Nieaktywny' : 'Anonimizowany'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {new Date(user.created_at).toLocaleDateString('pl-PL')}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {user.last_signed_in
                            ? new Date(user.last_signed_in).toLocaleDateString('pl-PL')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              setExpandedUserId(expandedUserId === user.id ? null : user.id)
                            }
                            className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 transition"
                          >
                            <span>Akcje</span>
                            <ChevronDown
                              size={12}
                              className={`transition ${expandedUserId === user.id ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Actions Row */}
                      {expandedUserId === user.id && (
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="space-y-3">
                              {/* Reset Password */}
                              {resetPasswordUserId === user.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={resetPasswordValue}
                                    onChange={(e) => setResetPasswordValue(e.target.value)}
                                    placeholder="Wpisz nowe hasło..."
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                  />
                                  <button
                                    onClick={() => handleResetPassword(user.id, user.email)}
                                    disabled={resetPasswordLoading || !resetPasswordValue}
                                    className="px-3 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-50"
                                  >
                                    {resetPasswordLoading ? '...' : 'Resetuj'}
                                  </button>
                                  <button
                                    onClick={() => setResetPasswordUserId(null)}
                                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs hover:bg-slate-100"
                                  >
                                    Anuluj
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setResetPasswordUserId(user.id)}
                                  className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-100 transition"
                                >
                                  <Lock size={12} />
                                  Resetuj hasło
                                </button>
                              )}

                              {/* Status Actions */}
                              <div className="flex flex-wrap gap-2">
                                {user.status !== 'active' && (
                                  <button
                                    onClick={() => handleAction(user.id, 'activate')}
                                    disabled={actionLoading === user.id}
                                    className="px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition"
                                  >
                                    {actionLoading === user.id ? '...' : 'Aktywuj'}
                                  </button>
                                )}
                                {user.status === 'active' && (
                                  <button
                                    onClick={() => handleAction(user.id, 'deactivate')}
                                    disabled={actionLoading === user.id}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 disabled:opacity-50 transition"
                                  >
                                    {actionLoading === user.id ? '...' : 'Dezaktywuj'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleAction(user.id, 'anonymize')}
                                  disabled={actionLoading === user.id}
                                  className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition"
                                >
                                  {actionLoading === user.id ? '...' : <><Trash2 size={12} className="inline mr-1" /> Anonimizuj</>}
                                </button>
                                {isOwner && (
                                  <button
                                    onClick={() => openPurgeModal(user)}
                                    className="px-3 py-2 bg-red-600 border border-red-700 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition flex items-center gap-1"
                                  >
                                    <ShieldAlert size={12} />
                                    Usuń trwale
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal usuwania konta (wyłącznie właściciel) — operacja NIEODWRACALNA */}
      {purgeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closePurgeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nagłówek */}
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                  <ShieldAlert size={18} />
                  Trwałe usunięcie konta
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {purgeTarget.full_name || purgeTarget.email} · {purgeTarget.email}
                </p>
              </div>
              <button
                onClick={closePurgeModal}
                disabled={purgeSubmitting}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Ładowanie / błąd podsumowania */}
              {purgeSummaryLoading && (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                  <Loader2 size={18} className="animate-spin" />
                  Wczytywanie podsumowania...
                </div>
              )}
              {purgeSummaryError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {purgeSummaryError}
                </div>
              )}

              {/* Wynik operacji (po wykonaniu) */}
              {purgeResult && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                    Konto zostało {purgeResult.mode === 'purge' ? 'usunięte całkowicie' : 'zanonimizowane'}.
                  </div>
                  {purgeResult.warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm space-y-1">
                      <p className="font-semibold">Ostrzeżenia:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {purgeResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={closePurgeModal}
                    className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
                  >
                    Zamknij
                  </button>
                </div>
              )}

              {/* Podsumowanie + potwierdzenie (przed wykonaniem) */}
              {purgeSummary && !purgeResult && (
                <>
                  {/* Tryb — po ludzku, zanim cokolwiek potwierdzi */}
                  {purgeSummary.mode === 'purge' ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                      <span className="font-semibold">Tryb: usunięcie całkowite.</span>{' '}
                      Konto zostanie usunięte całkowicie — profil i konto logowania znikną z bazy.
                    </div>
                  ) : (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                      <span className="font-semibold">Tryb: anonimizacja.</span>{' '}
                      Konto ma historię finansową (vouchery, transakcje, prowizje lub podobne) —
                      nie można go usunąć fizycznie. Dane osobowe zostaną wymazane, logowanie
                      zablokowane na stałe, a dokumenty księgowe i ślad w księdze pozostaną
                      nienaruszone (wymóg retencji).
                    </div>
                  )}

                  {/* Dane osobowe, które ZOSTAJĄ — najważniejsza informacja w oknie */}
                  {purgeSummary.retainedPersonalData.length > 0 && (
                    <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg">
                      <p className="text-sm font-bold text-red-800 flex items-center gap-1.5">
                        <AlertCircle size={15} />
                        Dane osobowe, które ZOSTANĄ mimo usunięcia konta
                      </p>
                      <ul className="mt-2 space-y-2">
                        {purgeSummary.retainedPersonalData.map((r) => (
                          <li key={r.table} className="text-sm text-red-800">
                            <span className="font-semibold">{r.table}</span> — {r.note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Skutki uboczne */}
                  {purgeSummary.impact.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-semibold text-amber-800">Skutki uboczne</p>
                      <ul className="mt-1.5 space-y-1">
                        {purgeSummary.impact.map((it) => (
                          <li key={it.key} className="text-sm text-amber-800">
                            {it.count}× {it.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Co znika / co zostaje */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Zniknie</p>
                      <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                        {purgeSummary.owned.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    {(purgeSummary.detached.length > 0 || purgeSummary.kept.length > 0) && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Odpięcie / bez zmian
                        </p>
                        <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                          {purgeSummary.detached.map((t) => (
                            <li key={t}>{t} — odpięcie</li>
                          ))}
                          {purgeSummary.kept.map((t) => (
                            <li key={t} className="text-emerald-700">{t} — zostaje nietknięte</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Pole potwierdzenia */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-sm text-slate-700">
                      Aby potwierdzić, przepisz dokładnie pełną nazwę konta:{' '}
                      <span className="font-mono font-semibold bg-slate-100 px-1.5 py-0.5 rounded select-all">
                        {purgeSummary.confirmPhrase}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={purgeConfirmInput}
                      onChange={(e) => setPurgeConfirmInput(e.target.value)}
                      disabled={purgeSubmitting}
                      placeholder="Przepisz nazwę konta..."
                      className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    />
                  </div>

                  {purgeSubmitError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      {purgeSubmitError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={closePurgeModal}
                      disabled={purgeSubmitting}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handlePurgeConfirm}
                      disabled={!confirmReady || purgeSubmitting}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {purgeSubmitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Usuwanie...
                        </>
                      ) : purgeSummary.mode === 'purge' ? (
                        'Usuń konto trwale'
                      ) : (
                        'Zanonimizuj konto'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
