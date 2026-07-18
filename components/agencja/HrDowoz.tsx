'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Loader2, UserPlus, X, MapPin, Users, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';

interface Assigned { id: string; name: string; accommodation: string | null; accommodation_address: string | null; contract: string | null }
interface Vehicle { id: string; label: string; seats: number; kierowca: string | null; projekt: string | null; assigned: Assigned[]; wolne: number }
interface FreeEmp { id: string; name: string; accommodation: string | null; contract: string | null }

export function HrDowoz() {
  const [pojazdy, setPojazdy] = useState<Vehicle[]>([]);
  const [wolni, setWolni] = useState<FreeEmp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickupFor, setPickupFor] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/hr/transport', { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setPojazdy(d.pojazdy || []); setWolni(d.nieprzypisani || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const assign = async (vehicle_id: string, employee_id: string) => {
    setBusy(true);
    try {
      const r = await fetch('/api/hr/transport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ vehicle_id, employee_id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setQ(''); await load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); } finally { setBusy(false); }
  };
  const unassign = async (employee_id: string) => {
    setBusy(true);
    try { await fetch(`/api/hr/transport?employee_id=${employee_id}`, { method: 'DELETE', credentials: 'same-origin' }); await load(); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Ładowanie planu dowozu…</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  const filteredFree = wolni.filter(e => !q.trim() || e.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans text-lg font-bold text-slate-900">Plan dowozu</h2>
          <p className="text-sm text-slate-500">Przydziel pracowników do busów Floty. Lista odbioru grupuje ludzi po adresie noclegu — dla kierowcy.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{wolni.length} nieprzypisanych</span>
      </div>

      {pojazdy.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Brak pojazdów z miejscami. Dodaj pojazdy w zakładce <b>Flota</b> i ustaw liczbę miejsc (seats).
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {pojazdy.map(v => {
          const occ = v.assigned.length;
          const full = v.seats > 0 && occ >= v.seats;
          // grupowanie do listy odbioru: po adresie noclegu
          const groups = new Map<string, Assigned[]>();
          for (const a of v.assigned) { const k = a.accommodation_address || a.accommodation || 'Bez noclegu'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(a); }
          return (
            <div key={v.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Bus size={19} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans font-bold text-slate-900">{v.label}</p>
                  <p className="text-xs text-slate-500">{v.kierowca ? `Kierowca: ${v.kierowca}` : 'Bez kierowcy'}{v.projekt ? ` · ${v.projekt}` : ''}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${full ? 'bg-red-50 text-red-700' : occ ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Users size={12} className="mr-1 inline" />{occ}{v.seats ? `/${v.seats}` : ''}
                </span>
              </div>

              {/* obłożenie — pasek */}
              {v.seats > 0 && (
                <div className="px-4 pt-3"><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${full ? 'bg-red-400' : 'bg-primary-400'}`} style={{ width: `${Math.min(100, (occ / v.seats) * 100)}%` }} /></div></div>
              )}

              <div className="space-y-1 px-4 py-3">
                {v.assigned.length === 0 && <p className="py-2 text-sm italic text-slate-300">Nikt jeszcze nie przypisany</p>}
                {v.assigned.map(a => (
                  <div key={a.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <span className="flex-1 font-medium text-slate-700">{a.name}</span>
                    {a.accommodation && <span className="flex items-center gap-0.5 text-[11px] text-slate-400"><MapPin size={10} />{a.accommodation}</span>}
                    <button onClick={() => unassign(a.id)} disabled={busy} className="rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100" title="Usuń z busa"><X size={14} /></button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2">
                <button onClick={() => { setAddFor(addFor === v.id ? null : v.id); setQ(''); }} disabled={full}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-40">
                  <UserPlus size={14} /> Dodaj pracownika
                </button>
                <button onClick={() => setPickupFor(pickupFor === v.id ? null : v.id)} disabled={!v.assigned.length}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <ClipboardList size={14} /> Lista odbioru {pickupFor === v.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>

              {/* wybór pracownika do dodania */}
              {addFor === v.id && !full && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                  <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj pracownika…" className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
                  <div className="max-h-52 space-y-0.5 overflow-y-auto">
                    {filteredFree.length === 0 && <p className="px-2 py-3 text-center text-sm italic text-slate-300">Brak nieprzypisanych osób</p>}
                    {filteredFree.slice(0, 40).map(e => (
                      <button key={e.id} onClick={() => assign(v.id, e.id)} disabled={busy} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white">
                        <UserPlus size={13} className="text-primary-400" />
                        <span className="flex-1 text-slate-700">{e.name}</span>
                        {e.accommodation && <span className="text-[11px] text-slate-400">{e.accommodation}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* lista odbioru dla kierowcy — grupowana po adresie noclegu */}
              {pickupFor === v.id && v.assigned.length > 0 && (
                <div className="border-t border-slate-100 bg-white p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lista odbioru — {v.label}</p>
                  {[...groups.entries()].map(([addr, people]) => (
                    <div key={addr} className="mb-3 last:mb-0">
                      <p className="flex items-center gap-1 text-sm font-semibold text-slate-700"><MapPin size={13} className="text-primary-500" /> {addr} <span className="text-slate-400">({people.length})</span></p>
                      <ul className="ml-5 list-disc text-sm text-slate-600">{people.map(p => <li key={p.id}>{p.name}</li>)}</ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
