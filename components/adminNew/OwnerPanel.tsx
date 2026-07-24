'use client';

// Panel wyłączny dla roli owner (Super Admin / Właściciel):
// „Widok ról" — owner ukrywa/pokazuje zakładki i moduły KAŻDEJ roli (nie tylko Administratora).
// Macierz uprawnień „kto co widzi" jest w Ustawienia → Uprawnienia (też tylko owner).
// Owner zawsze widzi wszystko.
import React, { useEffect, useState, useMemo } from 'react';
import { ShieldCheck, Loader2, Save, Eye, EyeOff, Settings2, UserCog } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

interface CatalogItem { id: string; label: string; section: string }
interface RoleItem { role: string; label: string }

export function OwnerPanel({ onGoToPermissions }: { onGoToPermissions?: () => void }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [hiddenByRole, setHiddenByRole] = useState<Record<string, string[]>>({});
  const [selRole, setSelRole] = useState<string>('superadmin');
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/view-config?manage=1', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) { setErr('Nie udało się wczytać konfiguracji'); return; }
        setCatalog(d.catalog || []); setRoles(d.roles || []); setHiddenByRole(d.hidden_by_role || {});
        setSelRole(s => (d.roles || []).some((r: RoleItem) => r.role === s) ? s : (d.roles?.[0]?.role ?? 'superadmin'));
      })
      .catch(() => setErr('Nie udało się wczytać konfiguracji'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setDraft(new Set(hiddenByRole[selRole] || [])); setDirty(false); setMsg(null); }, [selRole, hiddenByRole]);

  const bySection = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const it of catalog) { const a = m.get(it.section) || []; a.push(it); m.set(it.section, a); }
    return [...m.entries()];
  }, [catalog]);

  const toggle = (id: string) => { setDraft(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); setDirty(true); };

  const save = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const hidden = [...draft];
      const r = await fetch('/api/admin/view-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ role: selRole, hidden }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Błąd zapisu');
      setHiddenByRole(h => ({ ...h, [selRole]: hidden })); setDirty(false);
      setMsg(`Zapisano. Ukryte roli „${roleLabel(selRole)}": ${hidden.length || 0} modułów.`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  const roleLabel = (r: string) => roles.find(x => x.role === r)?.label ?? r;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><ShieldCheck size={20} className="text-primary-600" /> Super Admin — widoki ról</h2>
          <p className="text-sm text-slate-500">Funkcje wyłączne właściciela — sterujesz widokiem każdej roli w aplikacji</p>
        </div>
        {onGoToPermissions && (
          <button onClick={onGoToPermissions} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Settings2 size={15} /> Macierz uprawnień (kto co widzi)
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-sans font-bold text-slate-900">
            Widok ról
            <Hint text="Wybierz rolę i zaznacz, które zakładki/moduły są dla niej widoczne. Ukryte znikają z menu tej roli i są blokowane przy wejściu. Działa też na rolę Administrator. Ty (właściciel) zawsze widzisz wszystko." />
          </p>
          <div className="flex items-center gap-2">
            <UserCog size={15} className="text-slate-400" />
            <select value={selRole} onChange={e => setSelRole(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
              {roles.map(r => <option key={r.role} value={r.role}>{r.label}{(hiddenByRole[r.role]?.length ?? 0) ? ` · ${hiddenByRole[r.role].length} ukr.` : ''}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {bySection.map(([section, items]) => (
              <div key={section}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{section}</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {items.map(it => {
                    const hidden = draft.has(it.id);
                    return (
                      <button key={it.id} onClick={() => toggle(it.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${hidden ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-emerald-200 bg-emerald-50/50 text-slate-700'}`}>
                        {hidden ? <EyeOff size={15} className="shrink-0 text-slate-400" /> : <Eye size={15} className="shrink-0 text-emerald-600" />}
                        <span className="flex-1">{it.label}</span>
                        <span className={`text-[10px] font-semibold ${hidden ? 'text-slate-400' : 'text-emerald-600'}`}>{hidden ? 'ukryte' : 'widoczne'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button onClick={save} disabled={saving || loading || !dirty}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-slate-200">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz widok roli „{roleLabel(selRole)}"
          </button>
        </div>
      </div>
    </div>
  );
}
