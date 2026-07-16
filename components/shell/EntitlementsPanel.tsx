'use client';

import { useEffect, useState, useCallback } from 'react';
import { APPS } from '@/lib/apps/registry';
import type { AppId } from '@/lib/apps/registry';

// ── Types matching GET /api/admin/entitlements ────────────────────────────────
interface EntitlementRow {
  app_id: AppId;
  effect: 'grant' | 'revoke';
}

interface UserRow {
  id: string;
  full_name: string | null;
  role: string;
  apps: AppId[];
  entitlements: EntitlementRow[];
}

interface ApiGetResponse {
  users: UserRow[];
  error?: string;
}

// ── Etykiety ról (wartości z user_profiles.role w EBS) ───────────────────────
const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Administrator',
  pracodawca: 'Pracodawca',
  pracownik:  'Pracownik',
  partner:    'Doradca',
  menedzer:   'Manager',
  dyrektor:   'Dyrektor',
};

const ROLE_COLOR: Record<string, string> = {
  superadmin: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  pracodawca: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  pracownik: 'bg-white/10 text-white/70 border border-white/10',
  partner: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  menedzer: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  dyrektor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
};

function RoleBadge({ rawRole }: { rawRole: string }) {
  const key = rawRole.toLowerCase();
  const label = ROLE_LABEL[key] ?? rawRole;
  const color = ROLE_COLOR[key] ?? 'bg-white/10 text-white/60 border border-white/10';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// ── Role filter options ───────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: '', label: 'Wszystkie role' },
  ...Object.entries(ROLE_LABEL).map(([v, l]) => ({ value: v, label: l })),
];

// ── Main component ────────────────────────────────────────────────────────────
export function EntitlementsPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Per-cell in-flight tracker: key = `${userId}:${appId}`
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  // Per-cell error message
  const [cellErrors, setCellErrors] = useState<Map<string, string>>(new Map());

  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // ── Fetch all users on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch('/api/admin/entitlements')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ApiGetResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setUsers(data.users ?? []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Błąd pobierania danych.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ── Toggle handler ──────────────────────────────────────────────────────
  const handleToggle = useCallback(
    async (userId: string, appId: AppId, checked: boolean) => {
      const cellKey = `${userId}:${appId}`;

      setInFlight((prev) => new Set(prev).add(cellKey));
      setCellErrors((prev) => {
        const next = new Map(prev);
        next.delete(cellKey);
        return next;
      });

      // Optimistic update
      const prevUsers = users;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                apps: checked
                  ? [...u.apps, appId]
                  : u.apps.filter((a) => a !== appId),
              }
            : u,
        ),
      );

      try {
        const res = await fetch('/api/admin/entitlements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, app_id: appId, desiredVisible: checked }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { ok: boolean; apps: AppId[] };

        // Replace with server truth
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, apps: data.apps } : u)),
        );
      } catch (err) {
        // Revert on error
        setUsers(prevUsers);
        setCellErrors((prev) => {
          const next = new Map(prev);
          next.set(cellKey, err instanceof Error ? err.message : 'Błąd zapisu.');
          return next;
        });
      } finally {
        setInFlight((prev) => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
      }
    },
    [users],
  );

  // ── Filtered users ──────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const name = (u.full_name ?? '').toLowerCase();
    const roleKey = u.role.toLowerCase();
    const matchesSearch =
      search.trim() === '' || name.includes(search.trim().toLowerCase());
    const matchesRole =
      roleFilter === '' || roleKey === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  // ── Render states ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-white/50 text-sm py-12 text-center">
        Ładowanie danych…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-red-400 text-sm py-8 text-center">
        Błąd: {fetchError}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Szukaj po nazwie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-white/30
                     focus:outline-none focus:ring-1 focus:ring-[#4A95A9] focus:border-[#4A95A9]
                     transition w-56"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-lg border border-white/15 bg-[#0B1622] px-3 text-sm text-white
                     focus:outline-none focus:ring-1 focus:ring-[#4A95A9] focus:border-[#4A95A9]
                     transition cursor-pointer"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="ml-auto self-center text-xs text-white/40">
          {filtered.length} / {users.length} użytkowników
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#0B1622' }}>
              <th className="text-left px-4 py-3 text-white/70 font-medium border-b border-white/10 min-w-[180px]">
                Użytkownik
              </th>
              <th className="px-4 py-3 text-white/70 font-medium border-b border-white/10 text-left min-w-[110px]">
                Rola
              </th>
              {APPS.map((app) => (
                <th
                  key={app.id}
                  className="px-4 py-3 text-center text-white/70 font-medium border-b border-white/10 whitespace-nowrap"
                  style={{ color: '#4A95A9' }}
                >
                  {app.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={2 + APPS.length}
                  className="text-center text-white/30 py-10 text-sm"
                >
                  Brak wyników
                </td>
              </tr>
            )}
            {filtered.map((user, rowIdx) => (
              <tr
                key={user.id}
                className={`
                  border-b border-white/5 transition-colors
                  ${rowIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}
                  hover:bg-white/[0.05]
                `}
              >
                {/* Name */}
                <td className="px-4 py-3 text-white font-medium">
                  {user.full_name ?? <span className="text-white/30 italic">—</span>}
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  <RoleBadge rawRole={user.role} />
                </td>

                {/* App checkboxes */}
                {APPS.map((app) => {
                  const cellKey = `${user.id}:${app.id}`;
                  const isChecked = user.apps.includes(app.id);
                  const isDisabled = inFlight.has(cellKey);
                  const cellError = cellErrors.get(cellKey);

                  return (
                    <td
                      key={app.id}
                      className={`
                        px-4 py-3 text-center
                        ${cellError ? 'bg-red-500/10' : ''}
                        ${isChecked && !cellError ? 'bg-[#4A95A9]/5' : ''}
                        transition-colors
                      `}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <label className="relative inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={(e) =>
                              handleToggle(user.id, app.id, e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          {/* Custom checkbox */}
                          <span
                            className={`
                              w-5 h-5 rounded flex items-center justify-center border transition-all
                              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                              ${
                                isChecked
                                  ? 'border-[#F0A500] bg-[#F0A500]/20'
                                  : 'border-white/20 bg-transparent hover:border-[#4A95A9]'
                              }
                            `}
                          >
                            {isChecked && (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="#F0A500"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                            {isDisabled && (
                              <span className="w-2 h-2 rounded-full bg-[#4A95A9] animate-pulse" />
                            )}
                          </span>
                        </label>

                        {cellError && (
                          <span
                            className="text-red-400 text-[10px] leading-tight max-w-[80px] text-center"
                            title={cellError}
                          >
                            {cellError.length > 28
                              ? cellError.slice(0, 26) + '…'
                              : cellError}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
