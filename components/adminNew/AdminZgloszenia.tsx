// Zgłoszenia BOK — kolejka zamówień i zapytań o ofertę ze sklepu benefitów (panel admina).
// Dane: GET /api/admin/bok/{orders|inquiries}, PATCH /api/admin/bok/{kind}/{id}, GET /api/admin/bok/summary.
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §11.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Inbox, Loader2, Pencil, RefreshCw, Timer } from 'lucide-react';
import {
  NOTE_MAX, QUEUE_STATUSES, STATUS_FILTERS, STATUS_LABEL, isOverdue,
  type QueueKind, type QueueStatus, type StatusFilter,
} from '@/lib/benefits/bokQueue';
import type { QueueRow, StatusCounts } from '@/lib/benefits/bokQueueServer';

const PAGE = 50;
const KIND_LABEL: Record<QueueKind, string> = { orders: 'Zamówienia', inquiries: 'Zapytania o ofertę' };

const STATUS_STYLE: Record<QueueStatus, { cls: string; icon: React.ReactNode }> = {
  new:         { cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: <Circle size={12} /> },
  in_progress: { cls: 'bg-amber-50 text-amber-700 border-amber-200',    icon: <Timer size={12} /> },
  done:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={12} /> },
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
};
const openCount = (c?: StatusCounts) => (c ? c.new + c.in_progress : 0);

type Summary = Record<QueueKind, StatusCounts>;

export default function AdminZgloszenia() {
  const [kind, setKind] = useState<QueueKind>('orders');
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const feedbackTimer = useRef<number | null>(null);

  const showFeedback = useCallback((f: { kind: 'ok' | 'error'; text: string }) => {
    setFeedback(f);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (f.kind === 'ok') feedbackTimer.current = window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bok/summary');
      if (res.ok) setSummary(await res.json());
    } catch { /* liczniki są pomocnicze — brak nie blokuje kolejki */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams({ status: filter, limit: String(PAGE), offset: String(offset) });
    try {
      const res = await fetch(`/api/admin/bok/${kind}?${qs.toString()}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `Błąd ${res.status}`);
      setRows(Array.isArray(d.rows) ? d.rows : []);
      setTotal(d.total ?? 0);
      if (d.counts) setSummary(prev => ({ ...(prev ?? { orders: null, inquiries: null } as any), [kind]: d.counts }));
    } catch (e: any) {
      setRows([]); setTotal(0);
      setLoadError(e?.message || 'Nie udało się pobrać zgłoszeń.');
    } finally {
      setLoading(false);
    }
  }, [kind, filter, offset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => () => { if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current); }, []);

  const switchKind = (k: QueueKind) => { if (k !== kind) { setKind(k); setOffset(0); setEditing(null); } };
  const switchFilter = (f: StatusFilter) => { if (f !== filter) { setFilter(f); setOffset(0); setEditing(null); } };

  const matchesFilter = (status: QueueStatus) =>
    filter === 'all' || (filter === 'open' ? status !== 'done' : status === filter);

  const patch = async (row: QueueRow, body: { status?: QueueStatus; note?: string | null }, okText: string) => {
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/admin/bok/${row.kind}/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.row) throw new Error(d?.error || `Błąd ${res.status}`);
      const updated: QueueRow = d.row;
      if (matchesFilter(updated.status)) {
        setRows(prev => prev.map(r => (r.id === row.id ? updated : r)));
      } else {
        // Zgłoszenie wypadło z bieżącego filtra (np. zamknięte w widoku „Otwarte") — znika z listy.
        setRows(prev => prev.filter(r => r.id !== row.id));
        setTotal(t => Math.max(0, t - 1));
      }
      showFeedback({ kind: 'ok', text: okText });
      loadSummary();
      return true;
    } catch (e: any) {
      showFeedback({ kind: 'error', text: e?.message || 'Nie udało się zapisać zmiany.' });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const changeStatus = (row: QueueRow, status: QueueStatus) => {
    if (status === row.status) return;
    void patch(row, { status }, `Status zmieniony na „${STATUS_LABEL[status]}".`);
  };

  const saveNote = async (row: QueueRow) => {
    if (!editing || editing.id !== row.id) return;
    const ok = await patch(row, { note: editing.draft }, editing.draft.trim() ? 'Notatka zapisana.' : 'Notatka usunięta.');
    if (ok) setEditing(null);
  };

  const counts = summary?.[kind];
  const colSpan = 6;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-800 font-bold"><Inbox size={18} /> Zgłoszenia BOK</div>
          <p className="text-sm text-slate-500 mt-1">
            Zamówienia i zapytania o ofertę ze sklepu benefitów. Te same zgłoszenia przychodzą e-mailem do BOK —
            tu widać, które są jeszcze do zrobienia i kto się nimi zajął.
          </p>
        </div>
        <button onClick={() => { load(); loadSummary(); }}
          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
          <RefreshCw size={13} /> Odśwież
        </button>
      </div>

      {/* Rodzaj kolejki */}
      <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Rodzaj zgłoszeń">
        {(['orders', 'inquiries'] as QueueKind[]).map(k => {
          const open = openCount(summary?.[k]);
          const active = k === kind;
          return (
            <button key={k} role="tab" aria-selected={active} onClick={() => switchKind(k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {KIND_LABEL[k]}
              {summary?.[k] && (
                <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                  open > 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                  aria-label={`${open} otwartych`}>
                  {open}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtr statusu + licznik */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(f => {
          const active = f.id === filter;
          const n = counts ? (f.id === 'open' ? openCount(counts) : f.id === 'all' ? counts.new + counts.in_progress + counts.done : counts[f.id]) : null;
          return (
            <button key={f.id} onClick={() => switchFilter(f.id)} aria-pressed={active}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                active ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {f.label}{n !== null && <span className="ml-1 text-xs opacity-70 tabular-nums">({n})</span>}
            </button>
          );
        })}
        <span className="text-xs text-slate-400 ml-auto">Łącznie: {total}</span>
      </div>

      {/* Komunikat po zapisie / błędzie */}
      <div aria-live="polite" className="min-h-[1.25rem] text-sm">
        {feedback && (
          <span className={feedback.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}>
            {feedback.kind === 'ok' ? '✓ ' : ''}{feedback.text}
          </span>
        )}
      </div>

      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2 whitespace-nowrap">Data</th>
              <th className="text-left px-4 py-2">Pracownik</th>
              <th className="text-left px-4 py-2">Produkt</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Obsługa</th>
              <th className="text-left px-4 py-2">Notatka</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={16} />Ładowanie…</td></tr>
            ) : loadError ? (
              <tr><td colSpan={colSpan} className="px-4 py-8 text-center">
                <div className="text-red-600 mb-2">{loadError}</div>
                <button onClick={load} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Spróbuj ponownie</button>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-slate-400">
                <Inbox size={22} className="inline-block mb-2 text-slate-300" />
                <div className="text-slate-600 font-medium">Brak zgłoszeń w tym widoku.</div>
                <div className="text-xs mt-1">Zmień filtr statusu albo zajrzyj do drugiej kolejki.</div>
              </td></tr>
            ) : rows.map(r => {
              const overdue = isOverdue(r.created_at, r.status);
              const saving = savingId === r.id;
              const isEditing = editing?.id === r.id;
              const st = STATUS_STYLE[r.status];
              return (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      <div>{fmtDate(r.created_at)}</div>
                      {overdue && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <AlertTriangle size={12} /> po terminie
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.employee.name}</div>
                      {r.employee.company && <div className="text-xs text-slate-500">{r.employee.company}</div>}
                      {r.employee.email && <a href={`mailto:${r.employee.email}`} className="block text-xs text-blue-700 hover:underline break-all">{r.employee.email}</a>}
                      {r.employee.phone && <a href={`tel:${r.employee.phone}`} className="block text-xs text-blue-700 hover:underline">{r.employee.phone}</a>}
                    </td>
                    <td className="px-4 py-3">
                      {r.partner && <div className="text-xs text-slate-500">{r.partner}</div>}
                      <div className="font-medium text-slate-800">{r.service_name}</div>
                      {r.kind === 'orders' ? (
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="tabular-nums" title={r.transaction_id ? `Transakcja ${r.transaction_id}` : undefined}>{r.amount} pkt</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            r.fulfillment === 'auto' ? 'bg-slate-100 text-slate-700' : 'bg-violet-50 text-violet-700'}`}>
                            {r.fulfillment === 'auto' ? 'automatyczna' : 'realizuje BOK'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 mt-0.5">Zapytanie o ofertę</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${st.cls}`}>
                          {st.icon}{STATUS_LABEL[r.status]}
                        </span>
                        {saving && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Zapisywanie" />}
                      </div>
                      <select value={r.status} disabled={saving} aria-label={`Zmień status: ${r.service_name}`}
                        onChange={e => changeStatus(r, e.target.value as QueueStatus)}
                        className="mt-1.5 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white disabled:opacity-50">
                        {QUEUE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {r.handled_by_name ? (
                        <>
                          <div>{r.handled_by_name}</div>
                          {r.handled_at && <div className="text-xs text-slate-400">{fmtDate(r.handled_at)}</div>}
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      {r.note ? <div className="text-slate-700 whitespace-pre-wrap break-words">{r.note}</div> : <span className="text-slate-300">—</span>}
                      {!isEditing && (
                        <button onClick={() => setEditing({ id: r.id, draft: r.note ?? '' })} disabled={saving}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline disabled:opacity-50">
                          <Pencil size={11} /> {r.note ? 'Edytuj' : 'Dodaj notatkę'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={colSpan} className="px-4 py-3">
                        <label htmlFor={`note-${r.id}`} className="block text-xs font-medium text-slate-600 mb-1">
                          Notatka BOK — {r.service_name} ({r.employee.name})
                        </label>
                        <textarea id={`note-${r.id}`} value={editing.draft} maxLength={NOTE_MAX} rows={3} autoFocus
                          onChange={e => setEditing({ id: r.id, draft: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }}
                          placeholder="Np. wysłano kod na e-mail 18.09; oddzwonić w sprawie oferty…"
                          className="w-full max-w-2xl px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        <div className="mt-2 flex items-center gap-2">
                          <button onClick={() => saveNote(r)} disabled={saving}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                            {saving ? 'Zapisywanie…' : 'Zapisz notatkę'}
                          </button>
                          <button onClick={() => setEditing(null)} disabled={saving}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-white disabled:opacity-50">Anuluj</button>
                          <span className="ml-auto text-xs text-slate-400 tabular-nums">{editing.draft.length}/{NOTE_MAX}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE))}
          className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Poprzednie</button>
        <span className="text-slate-400 tabular-nums">{total === 0 ? '0 z 0' : `${offset + 1}–${Math.min(offset + PAGE, total)} z ${total}`}</span>
        <button disabled={offset + PAGE >= total || loading} onClick={() => setOffset(offset + PAGE)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Następne</button>
      </div>
    </div>
  );
}
