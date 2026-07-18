'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Stamp, Loader2, Plus, Trash2, CalendarClock, X, Building2 } from 'lucide-react';
import { fullName } from '@/lib/hr/docPlaceholders';

interface Legal { id: string; employee_id: string; employee_name: string; contract: string | null; type: string; status: string; office: string | null; case_number: string | null; submitted_at: string | null; decision_date: string | null; deadline: string | null; note: string | null }
interface EmpOpt { id: string; name: string }

const TYPE_LABEL: Record<string, string> = { karta_pobytu: 'Karta pobytu', wiza: 'Wiza', pozwolenie_na_prace: 'Pozwolenie na pracę', oswiadczenie: 'Oświadczenie', przedluzenie: 'Przedłużenie', inne: 'Inne' };
const STATUS: { key: string; label: string; tone: string }[] = [
  { key: 'zbieranie_dokumentow', label: 'Zbieranie dokumentów', tone: 'bg-slate-100 text-slate-600' },
  { key: 'zlozony', label: 'Złożony', tone: 'bg-sky-100 text-sky-700' },
  { key: 'w_toku', label: 'W toku (urząd)', tone: 'bg-indigo-100 text-indigo-700' },
  { key: 'uzupelnienie', label: 'Uzupełnienie', tone: 'bg-amber-100 text-amber-700' },
  { key: 'decyzja_pozytywna', label: 'Decyzja pozytywna', tone: 'bg-emerald-100 text-emerald-700' },
  { key: 'decyzja_negatywna', label: 'Decyzja negatywna', tone: 'bg-red-100 text-red-700' },
];
const d = (s: string) => new Date(s).toLocaleDateString('pl-PL');
const daysLeft = (s?: string | null) => (s ? Math.ceil((new Date(s).getTime() - Date.now()) / 86400000) : null);
const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300';

export function HrLegalizacja() {
  const [items, setItems] = useState<Legal[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [empQ, setEmpQ] = useState('');
  const [form, setForm] = useState<any>({ employee_id: '', type: 'karta_pobytu', status: 'zbieranie_dokumentow', office: '', case_number: '', submitted_at: '', deadline: '', note: '' });

  const load = useCallback(async () => {
    try {
      const [rl, re] = await Promise.all([
        fetch('/api/hr/legalization', { credentials: 'same-origin' }),
        fetch('/api/hr/employees', { credentials: 'same-origin' }),
      ]);
      const [dl, de] = await Promise.all([rl.json(), re.json()]);
      if (rl.ok) { setItems(dl.items || []); setCanDelete(!!dl.can_delete); }
      if (re.ok) setEmps((de.employees || []).map((e: any) => ({ id: e.id, name: fullName(e) })));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.employee_id || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/hr/legalization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form) });
      if (!r.ok) throw new Error((await r.json()).error || 'Błąd');
      setAdding(false); setEmpQ(''); setForm({ employee_id: '', type: 'karta_pobytu', status: 'zbieranie_dokumentow', office: '', case_number: '', submitted_at: '', deadline: '', note: '' });
      await load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); } finally { setBusy(false); }
  };
  const changeStatus = async (i: Legal, status: string) => { await fetch(`/api/hr/legalization?id=${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status }) }); load(); };
  const del = async (i: Legal) => { if (!window.confirm('Usunąć wniosek?')) return; await fetch(`/api/hr/legalization?id=${i.id}`, { method: 'DELETE', credentials: 'same-origin' }); load(); };

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Ładowanie legalizacji…</div>;

  const filteredEmps = emps.filter(e => !empQ.trim() || e.name.toLowerCase().includes(empQ.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><Stamp size={19} className="text-primary-600" /> Legalizacja pobytu</h2>
          <p className="text-sm text-slate-500">Wnioski urzędowe (karty pobytu, wizy, pozwolenia) — statusy i terminy w jednym miejscu.</p>
        </div>
        <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={15} /> Nowy wniosek</button>
      </div>

      {adding && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pracownik</p>
              {form.employee_id ? (
                <p className="flex items-center gap-2 text-sm"><b>{emps.find(e => e.id === form.employee_id)?.name}</b><button onClick={() => { setForm({ ...form, employee_id: '' }); setEmpQ(''); }} className="text-slate-400 hover:text-red-500"><X size={13} /></button></p>
              ) : (<>
                <input value={empQ} onChange={e => setEmpQ(e.target.value)} placeholder="Szukaj pracownika…" className={INPUT} />
                {empQ.trim() && <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-100">{filteredEmps.slice(0, 25).map(e => <button key={e.id} onClick={() => { setForm({ ...form, employee_id: e.id }); setEmpQ(e.name); }} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50">{e.name}</button>)}</div>}
              </>)}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rodzaj</p>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={INPUT}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Urząd</p><input value={form.office} onChange={e => setForm({ ...form, office: e.target.value })} placeholder="np. Wielkopolski UW" className={INPUT} /></div>
            <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nr sprawy</p><input value={form.case_number} onChange={e => setForm({ ...form, case_number: e.target.value })} className={INPUT} /></div>
            <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Data złożenia</p><input type="date" value={form.submitted_at} onChange={e => setForm({ ...form, submitted_at: e.target.value })} className={INPUT} /></div>
            <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Termin / deadline</p><input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className={INPUT} /></div>
            <div className="md:col-span-2"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notatka</p><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={INPUT} /></div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Anuluj</button>
            <button onClick={create} disabled={!form.employee_id || busy} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Dodaj wniosek</button>
          </div>
        </div>
      )}

      {/* Kanban statusów */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {STATUS.map(col => {
          const cards = items.filter(i => i.status === col.key);
          return (
            <div key={col.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${col.tone}`}>{col.label}</span>
                <span className="text-xs text-slate-400">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.length === 0 && <p className="py-2 text-center text-[12px] italic text-slate-300">—</p>}
                {cards.map(i => {
                  const dl = daysLeft(i.deadline);
                  const dlTone = dl == null ? '' : dl < 0 ? 'bg-red-50 text-red-700' : dl <= 14 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500';
                  return (
                    <div key={i.id} className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{i.employee_name}</p>
                          <p className="text-[12px] text-slate-500">{TYPE_LABEL[i.type] || i.type}{i.contract ? ` · ${i.contract}` : ''}</p>
                        </div>
                        {canDelete && <button onClick={() => del(i)} className="rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"><Trash2 size={13} /></button>}
                      </div>
                      {(i.office || i.case_number) && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><Building2 size={10} /> {[i.office, i.case_number].filter(Boolean).join(' · ')}</p>}
                      {i.deadline && <p className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${dlTone}`}><CalendarClock size={10} /> termin {d(i.deadline)}{dl != null && dl < 0 ? ' (po terminie)' : dl != null ? ` (${dl} dni)` : ''}</p>}
                      {i.note && <p className="mt-1.5 text-[12px] text-slate-500">{i.note}</p>}
                      <select value={i.status} onChange={e => changeStatus(i, e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-[12px] focus:outline-none">
                        {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
