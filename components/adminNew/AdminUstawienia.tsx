'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings2, Plus, Loader2, Save, Trash2, Lock, ShieldCheck, UserCog, X, Check } from 'lucide-react';
import { PERMISSION_GROUPS, ALL_PERMISSIONS } from '@/lib/permissions/registry';
import { Hint } from '@/components/ui/Hint';

interface RoleRow { role: string; label: string; is_system: boolean; customized: boolean; permissions: string[]; users_count: number }
interface Override { user_id: string; permission: string; effect: 'grant' | 'revoke'; user_name: string; user_role?: string | null }
interface UserLite { id: string; full_name?: string; email: string; role: string }

const INPUT = 'rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const permLabel = (key: string) => {
  for (const g of PERMISSION_GROUPS) { const p = g.perms.find(x => x.key === key); if (p) return `${g.name} → ${p.label}`; }
  return key;
};

export const AdminUstawienia: React.FC = () => {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [tab] = useState<'uprawnienia'>('uprawnienia');

  const [overrides, setOverrides] = useState<Override[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [ovForm, setOvForm] = useState({ user_id: '', permission: ALL_PERMISSIONS[0], effect: 'grant' as 'grant' | 'revoke' });
  const [ovSaving, setOvSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rr, ro, ru] = await Promise.all([
        fetch('/api/permissions/roles', { credentials: 'same-origin' }),
        fetch('/api/permissions/user-overrides', { credentials: 'same-origin' }),
        fetch('/api/users', { credentials: 'same-origin' }),
      ]);
      const dr = rr.ok ? await rr.json() : { roles: [] };
      const dov = ro.ok ? await ro.json() : { overrides: [] };
      const du = ru.ok ? await ru.json() : [];
      setRoles(dr.roles || []);
      setOverrides(dov.overrides || []);
      setUsers(Array.isArray(du) ? du : []);
      if (!selected && (dr.roles || []).length) {
        const first = dr.roles.find((r: RoleRow) => r.role !== 'superadmin' && r.role !== 'owner') ?? dr.roles[0];
        setSelected(first.role);
        setDraft(new Set(first.permissions));
      }
    } catch { /* */ } finally { setLoading(false); }
  }, [selected]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (r: RoleRow) => { setSelected(r.role); setDraft(new Set(r.permissions)); setDirty(false); setMsg(null); };
  const current = roles.find(r => r.role === selected) || null;
  const locked = current?.role === 'superadmin';

  const toggle = (key: string) => {
    if (locked) return;
    setDraft(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    setDirty(true);
  };
  const toggleGroup = (keys: string[], on: boolean) => {
    if (locked) return;
    setDraft(prev => { const n = new Set(prev); for (const k of keys) on ? n.add(k) : n.delete(k); return n; });
    setDirty(true);
  };

  const saveRole = async () => {
    if (!current || locked) return;
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/permissions/roles/${current.role}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ permissions: [...draft] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd zapisu');
      setDirty(false); setMsg('Zapisano — zmiany działają od razu');
      setRoles(prev => prev.map(x => x.role === current.role ? { ...x, customized: true, permissions: [...draft] } : x));
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const createRole = async () => {
    if (newRole.trim().length < 2) return;
    setAddingRole(true);
    try {
      const r = await fetch('/api/permissions/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ label: newRole.trim() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setNewRole('');
      await load();
      setSelected(d.role); setDraft(new Set()); setDirty(false);
    } catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); } finally { setAddingRole(false); }
  };

  const deleteRole = async (r: RoleRow) => {
    if (!confirm(`Usunąć rolę „${r.label}"?`)) return;
    const res = await fetch(`/api/permissions/roles/${r.role}`, { method: 'DELETE', credentials: 'same-origin' });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Błąd'); return; }
    if (selected === r.role) setSelected(null);
    await load();
  };

  const removeOverride = async (o: Override) => {
    await fetch(`/api/permissions/user-overrides?userId=${o.user_id}&permission=${encodeURIComponent(o.permission)}`, { method: 'DELETE', credentials: 'same-origin' });
    await load();
  };

  // ── Plansza uprawnień wybranego użytkownika (rola + wyjątki = stan efektywny) ──
  const selUser = users.find(u => u.id === ovForm.user_id) || null;
  const rolePermsOf = (role: string): Set<string> =>
    role === 'superadmin' ? new Set(ALL_PERMISSIONS) : new Set(roles.find(r => r.role === role)?.permissions ?? []);
  const effectiveOf = (u: UserLite): Set<string> => {
    const base = rolePermsOf(u.role);
    if (u.role === 'superadmin') return base;
    for (const o of overrides) if (o.user_id === u.id) (o.effect === 'grant' ? base.add(o.permission) : base.delete(o.permission));
    return base;
  };
  const overrideFor = (uid: string, perm: string) => overrides.find(o => o.user_id === uid && o.permission === perm);

  const toggleUserPerm = async (u: UserLite, perm: string) => {
    if (u.role === 'superadmin' || ovSaving) return;
    const roleHas = rolePermsOf(u.role).has(perm);
    const target = !effectiveOf(u).has(perm);
    setOvSaving(true);
    try {
      const ov = overrideFor(u.id, perm);
      if (ov) await fetch(`/api/permissions/user-overrides?userId=${u.id}&permission=${encodeURIComponent(perm)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (target !== roleHas) {
        const r = await fetch('/api/permissions/user-overrides', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ user_id: u.id, permission: perm, effect: target ? 'grant' : 'revoke' }),
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Błąd zapisu'); }
      }
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); } finally { setOvSaving(false); }
  };

  if (loading && !roles.length) return <div className="flex justify-center py-20"><Loader2 size={26} className="animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><Settings2 size={18} className="text-primary-500" /> Ustawienia</h2>
        <p className="text-sm text-slate-500">Włączaj role do zakładek i funkcji. Zmiany działają natychmiast dla wszystkich użytkowników danej roli.</p>
      </div>

      {tab === 'uprawnienia' && <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lista ról */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 lg:col-span-1">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Role ({roles.length})</p>
          <div className="space-y-1">
            {roles.map(r => (
              <button key={r.role} onClick={() => pick(r)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${selected === r.role ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-slate-50'}`}>
                {r.role === 'superadmin' ? <Lock size={14} className="shrink-0 text-red-500" /> : <ShieldCheck size={14} className="shrink-0 text-slate-400" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800">{r.label}</span>
                  <span className="text-[11px] text-slate-400">{r.role} · {r.users_count} użytk. · {r.role === 'superadmin' ? 'pełny dostęp' : `${r.permissions.length} uprawnień`}</span>
                </span>
                {!r.is_system && r.users_count === 0 && (
                  <span onClick={e => { e.stopPropagation(); deleteRole(r); }} className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Nazwa nowej roli…" className={INPUT + ' min-w-0 flex-1'} />
            <button onClick={createRole} disabled={addingRole || newRole.trim().length < 2} className="flex shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {addingRole ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Dodaj
            </button>
            <Hint text="Tworzy nową rolę własną. Startuje bez uprawnień — zaznacz jej dostępy w macierzy po prawej i Zapisz. Rolę nadasz użytkownikom w zakładce Użytkownicy." className="self-center" />
          </div>
          <p className="mt-2 px-1 text-[11px] text-slate-400">Nowa rola startuje bez uprawnień — zaznacz jej dostępy po prawej i zapisz.</p>
        </div>

        {/* Macierz uprawnień wybranej roli */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
          {!current ? (
            <p className="py-10 text-center text-sm italic text-slate-300">Wybierz rolę z listy</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">Uprawnienia: <span className="text-primary-600">{current.label}</span></p>
                {locked ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"><Lock size={12} /> Superadmin ma zawsze pełny dostęp — nieedytowalne</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <button onClick={saveRole} disabled={saving || !dirty} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz zmiany
                    </button>
                    <Hint text="Zapisuje zestaw uprawnień roli — działa NATYCHMIAST dla wszystkich osób z tą rolą (zakładki i akcje w API). Zmiana loguje się w Rejestrze zdarzeń." />
                  </span>
                )}
              </div>
              {msg && <p className={`mb-3 text-xs ${msg.startsWith('Zapisano') ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</p>}

              <div className="space-y-4">
                {PERMISSION_GROUPS.map(g => {
                  const keys = g.perms.map(p => p.key);
                  const allOn = keys.every(k => draft.has(k));
                  return (
                    <div key={g.name} className="rounded-xl border border-slate-100 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-700">{g.name}</p>
                        {!locked && (
                          <button onClick={() => toggleGroup(keys, !allOn)} className="text-xs font-medium text-primary-600 hover:underline">{allOn ? 'Odznacz wszystko' : 'Zaznacz wszystko'}</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {g.perms.map(p => (
                          <label key={p.key} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${locked ? 'opacity-70' : 'cursor-pointer hover:bg-slate-50'}`}>
                            <input type="checkbox" checked={draft.has(p.key)} disabled={locked} onChange={() => toggle(p.key)} className="mt-0.5" />
                            <span className="min-w-0">
                              <span className="text-slate-700">{p.label}</span>
                              {p.kind === 'action' && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">akcja</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Wyjątki per użytkownik — plansza uprawnień wybranej osoby */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-1 flex items-center gap-2 font-semibold text-slate-800"><UserCog size={16} className="text-primary-500" /> Uprawnienia pojedynczych użytkowników</p>
        <p className="mb-3 text-sm text-slate-500">Wybierz osobę, a poniżej pojawi się jej plansza uprawnień (rola + wyjątki). Klikaj checkboxy — różnice względem roli zapisują się od razu jako wyjątki.</p>

        <div className="mb-4 min-w-[260px] max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Użytkownik</p>
          <select value={ovForm.user_id} onChange={e => setOvForm({ ...ovForm, user_id: e.target.value })} className={INPUT + ' mt-1 w-full'}>
            <option value="">— wybierz —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>)}
          </select>
        </div>

        {selUser && (
          <div className="mb-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-800">Plansza: <span className="text-primary-600">{selUser.full_name || selUser.email}</span> <span className="text-xs font-normal text-slate-400">(rola: {selUser.role})</span></p>
              {selUser.role === 'superadmin'
                ? <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"><Lock size={12} /> Superadmin ma zawsze pełny dostęp</span>
                : ovSaving && <Loader2 size={14} className="animate-spin text-slate-400" />}
            </div>
            <div className="space-y-3">
              {PERMISSION_GROUPS.map(g => {
                const eff = effectiveOf(selUser);
                return (
                  <div key={g.name} className="rounded-xl border border-slate-100 p-3">
                    <p className="mb-2 text-sm font-bold text-slate-700">{g.name}</p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {g.perms.map(p => {
                        const ov = overrideFor(selUser.id, p.key);
                        const locked2 = selUser.role === 'superadmin';
                        return (
                          <label key={p.key} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${locked2 ? 'opacity-70' : 'cursor-pointer hover:bg-slate-50'}`}>
                            <input type="checkbox" checked={eff.has(p.key)} disabled={locked2 || ovSaving} onChange={() => toggleUserPerm(selUser, p.key)} className="mt-0.5" />
                            <span className="min-w-0">
                              <span className="text-slate-700">{p.label}</span>
                              {p.kind === 'action' && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">akcja</span>}
                              {ov && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ov.effect === 'grant' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{ov.effect === 'grant' ? 'wyjątek: nadane' : 'wyjątek: odebrane'}</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Wszystkie aktywne wyjątki</p>
        {overrides.length === 0 ? (
          <p className="py-4 text-center text-sm italic text-slate-300">Brak wyjątków — wszyscy działają wg swoich ról</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {overrides.map((o, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium text-slate-700">{o.user_name}</span>
                {o.user_role && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{o.user_role}</span>}
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{permLabel(o.permission)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.effect === 'grant' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {o.effect === 'grant' ? <><Check size={10} className="mr-0.5 inline" />nadane</> : <><X size={10} className="mr-0.5 inline" />odebrane</>}
                </span>
                <button onClick={() => removeOverride(o)} className="ml-auto rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      </>}
    </div>
  );
};
