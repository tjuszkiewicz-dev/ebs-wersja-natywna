'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Trash2, Clock } from 'lucide-react';

interface Entry { id: string; work_date: string; shift?: string | null; start_time?: string | null; end_time?: string | null; hours: number }

// Predefiniowane zmiany (edytowalne — można wpisać własne godziny dla dnia)
const SHIFTS: Record<string, [string, string]> = { I: ['06:00', '14:00'], II: ['14:00', '22:00'], III: ['22:00', '06:00'] };
const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const pad = (n: number) => String(n).padStart(2, '0');
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

export function HrSchedule({ employeeId }: { employeeId: string }) {
  const [month, setMonth] = useState(thisMonth());
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [custom, setCustom] = useState({ start: '06:00', end: '14:00' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/schedule?employeeId=${employeeId}&month=${month}`, { credentials: 'same-origin' });
      const d = await r.json();
      const map: Record<string, Entry> = {};
      for (const e of d.entries || []) map[e.work_date] = e;
      setEntries(map); setTotal(d.total_hours || 0);
    } catch { /* */ } finally { setLoading(false); }
  }, [employeeId, month]);
  useEffect(() => { load(); }, [load]);

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7; // poniedziałek = 0
  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${pad(d)}`);

  const post = async (date: string, shift: string | null, start: string, end: string) => {
    setSaving(true);
    try {
      await fetch('/api/hr/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ employee_id: employeeId, work_date: date, shift, start_time: start, end_time: end }) });
      setEditDay(null); await load();
    } catch { /* */ } finally { setSaving(false); }
  };
  const clearDay = async (date: string) => {
    setSaving(true);
    try { await fetch(`/api/hr/schedule?employeeId=${employeeId}&date=${date}`, { method: 'DELETE', credentials: 'same-origin' }); setEditDay(null); await load(); }
    catch { /* */ } finally { setSaving(false); }
  };
  const shiftMonth = (delta: number) => { const nd = new Date(y, m - 1 + delta, 1); setMonth(`${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`); setEditDay(null); };
  const openDay = (date: string) => {
    const e = entries[date];
    setCustom({ start: hhmm(e?.start_time) || '06:00', end: hhmm(e?.end_time) || '14:00' });
    setEditDay(d => (d === date ? null : date));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><ChevronLeft size={16} /></button>
        <p className="text-sm font-semibold capitalize text-slate-700">{MONTHS[m - 1]} {y}</p>
        <button onClick={() => shiftMonth(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WD.map(d => <div key={d} className="py-1 text-[10px] font-bold uppercase text-slate-400">{d}</div>)}
        {loading ? (
          <div className="col-span-7 flex justify-center py-6 text-slate-300"><Loader2 size={18} className="animate-spin" /></div>
        ) : cells.map((date, i) => {
          if (!date) return <div key={`b${i}`} />;
          const e = entries[date];
          const day = Number(date.slice(-2));
          const sel = editDay === date;
          return (
            <button key={date} onClick={() => openDay(date)}
              className={`flex h-12 flex-col items-center justify-center rounded-lg border text-xs transition ${sel ? 'border-primary-400 ring-1 ring-primary-300' : 'border-transparent'} ${e ? 'bg-primary-50 text-primary-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              <span className="text-[11px] font-semibold">{day}</span>
              {e && <span className="text-[10px] leading-tight">{e.shift ? `zm. ${e.shift}` : `${e.hours}h`}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs text-slate-500"><Clock size={13} /> Suma miesiąca</span>
        <span className="text-sm font-bold text-slate-800">{total} h</span>
      </div>

      {editDay && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Dzień {Number(editDay.slice(-2))} {MONTHS[m - 1]} — wybierz zmianę lub wpisz godziny</p>
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {(['I', 'II', 'III'] as const).map(s => (
              <button key={s} disabled={saving} onClick={() => post(editDay, s, SHIFTS[s][0], SHIFTS[s][1])}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs hover:bg-primary-50 hover:border-primary-200 disabled:opacity-50">
                <span className="font-bold">Zmiana {s}</span><br /><span className="text-[10px] text-slate-400">{SHIFTS[s][0]}–{SHIFTS[s][1]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div><p className="text-[10px] font-semibold uppercase text-slate-400">Od</p><input type="time" value={custom.start} onChange={e => setCustom({ ...custom, start: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" /></div>
            <div><p className="text-[10px] font-semibold uppercase text-slate-400">Do</p><input type="time" value={custom.end} onChange={e => setCustom({ ...custom, end: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" /></div>
            <button disabled={saving} onClick={() => post(editDay, null, custom.start, custom.end)} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Zapisz godziny</button>
          </div>
          <div className="mt-2 flex justify-between">
            {entries[editDay] ? <button disabled={saving} onClick={() => clearDay(editDay)} className="flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 size={12} /> Wyczyść dzień</button> : <span />}
            <button onClick={() => setEditDay(null)} className="text-xs text-slate-400 hover:text-slate-600">Zamknij</button>
          </div>
        </div>
      )}
    </div>
  );
}
