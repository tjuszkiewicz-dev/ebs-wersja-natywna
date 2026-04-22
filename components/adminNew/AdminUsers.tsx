import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, AlertCircle, Loader2, Users, ChevronDown, Lock, Shield, Trash2 } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  role: 'superadmin' | 'pracodawca' | 'pracownik';
  company_id?: string;
  company_name?: string;
  status: 'active' | 'inactive' | 'anonymized';
  created_at: string;
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
                          <td colSpan={7} className="px-4 py-3">
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
    </div>
  );
};
