'use client';

// Kalendarz CRM — wydarzenia per osoba (ręczne / ze spotkań / od AI po transkrypcji)
// + panel „Zadania do wykonania". Połączony z komunikatorem (spotkania) i całą aplikacją.
import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2, X, Trash2, Check, ClipboardList, MapPin, Users, Sparkles } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

interface Attendee { id: string; name: string }
interface Ev { id: string; title: string; description?: string | null; starts_at: string; ends_at?: string | null; all_day: boolean; location?: string | null; source: string; mine: boolean; attendees: Attendee[] }
interface Task { id: string; title: string; description?: string | null; due_date?: string | null; status: string; source: string; assigned_to: Attendee; created_by?: Attendee | null; mine: boolean }
interface Contact { id: string; name: string; role: string }

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const DOW = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SOURCE_BADGE: Record<string, [string, string]> = { meeting: ['spotkanie', 'bg-sky-100 text-sky-700'], ai: ['AI', 'bg-violet-100 text-violet-700'] };

export const CrmKalendarz: React.FC = () => {
  const today = new Date();
  const [ym, setYm] = useState<[number, number]>([today.getFullYear(), today.getMonth()]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selDay, setSelDay] = useState<string>(dayKey(today));
  const [modal, setModal] = useState<null | { ev?: Ev }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [y, m] = ym;
    const from = new Date(y, m, 1).toISOString();
    const to = new Date(y, m + 1, 1).toISOString();
    try {
      const [re, rt] = await Promise.all([
        fetch(`/api/calendar/events?from=${from}&to=${to}`, { credentials: 'same-origin' }),
        fetch('/api/tasks', { credentials: 'same-origin' }),
      ]);
      const de = re.ok ? await re.json() : { events: [] };
      const dt = rt.ok ? await rt.json() : { tasks: [] };
      setEvents(de.events || []);
      setTasks(dt.tasks || []);
    } catch { /* */ } finally { setLoading(false); }
  }, [ym]);
  useEffect(() => { load(); }, [load]);

  const [y, m] = ym;
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // pon=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1)),
  ];
  const byDay = new Map<string, Ev[]>();
  for (const e of events) {
    const k = dayKey(new Date(e.starts_at));
    byDay.set(k, [...(byDay.get(k) || []), e]);
  }
  const dayEvents = byDay.get(selDay) || [];
  const openTasks = tasks.filter(t => t.status === 'open');

  const toggleTask = async (t: Task) => {
    const next = t.status === 'done' ? 'open' : 'done';
    setTasks(p => p.map(x => x.id === t.id ? { ...x, status: next } : x));
    await fetch(`/api/tasks/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status: next }) }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><CalendarDays size={18} className="text-primary-500" /> Kalendarz</h2>
          <p className="text-sm text-slate-500">Spotkania i wydarzenia — Twoje oraz te, do których jesteś dopisany. Wpisy tworzy się ręcznie, ze spotkań w komunikatorze albo robi to AI z transkrypcji.</p>
        </div>
        <span className="flex items-center gap-1.5">
          <button onClick={() => setModal({})} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={15} /> Dodaj wydarzenie</button>
          <Hint text="Nowe wydarzenie w kalendarzu — możesz dopisać uczestników (zobaczą je w swoich kalendarzach). Wydarzenia ze spotkań i od AI mają kolorowe plakietki." />
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* ── siatka miesiąca ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setYm(([yy, mm]) => mm === 0 ? [yy - 1, 11] : [yy, mm - 1])} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><ChevronLeft size={18} /></button>
            <p className="font-display text-sm font-bold text-slate-800">{MONTHS[m]} {y}</p>
            <button onClick={() => setYm(([yy, mm]) => mm === 11 ? [yy + 1, 0] : [yy, mm + 1])} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DOW.map(d => <p key={d} className="py-1 text-center text-[11px] font-semibold uppercase text-slate-400">{d}</p>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const k = dayKey(d);
              const evs = byDay.get(k) || [];
              const isToday = k === dayKey(today);
              const isSel = k === selDay;
              return (
                <button key={i} onClick={() => setSelDay(k)}
                  className={`min-h-[64px] rounded-lg border p-1 text-left align-top transition ${isSel ? 'border-primary-400 bg-primary-50' : isToday ? 'border-primary-200 bg-white' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                  <p className={`text-[11px] font-semibold ${isToday ? 'text-primary-600' : 'text-slate-500'}`}>{d.getDate()}</p>
                  {evs.slice(0, 2).map(e => (
                    <p key={e.id} className="mt-0.5 truncate rounded bg-primary-100 px-1 text-[10px] font-medium text-primary-800">{e.all_day ? '' : new Date(e.starts_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) + ' '}{e.title}</p>
                  ))}
                  {evs.length > 2 && <p className="text-[10px] text-slate-400">+{evs.length - 2}</p>}
                </button>
              );
            })}
          </div>

          {/* wydarzenia wybranego dnia */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{new Date(selDay).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            {loading && <div className="flex justify-center py-4"><Loader2 size={17} className="animate-spin text-slate-300" /></div>}
            {!loading && !dayEvents.length && <p className="py-2 text-sm italic text-slate-300">Brak wydarzeń tego dnia</p>}
            {dayEvents.map(e => (
              <button key={e.id} onClick={() => setModal({ ev: e })} className="mb-1.5 flex w-full items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 text-left hover:border-primary-200 hover:bg-primary-50/40">
                <div className="mt-0.5 text-xs font-bold text-primary-600">{e.all_day ? 'cały dzień' : new Date(e.starts_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    {e.title}
                    {SOURCE_BADGE[e.source] && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SOURCE_BADGE[e.source][1]}`}>{SOURCE_BADGE[e.source][0]}</span>}
                  </p>
                  {e.location && <p className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={11} /> {e.location}</p>}
                  {e.attendees.length > 1 && <p className="flex items-center gap-1 text-xs text-slate-400"><Users size={11} /> {e.attendees.map(a => a.name.split(' ')[0]).join(', ')}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── zadania ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><ClipboardList size={16} className="text-primary-500" /> Zadania do wykonania <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-700">{openTasks.length}</span>
            <Hint text="Twoje zadania i te, które zleciłeś innym. Odhaczasz kliknięciem. Zadania tworzą się też automatycznie — AI wyciąga je z transkrypcji nagranych spotkań." />
          </p>
          <div className="max-h-[520px] space-y-1.5 overflow-y-auto">
            {tasks.length === 0 && !loading && <p className="py-4 text-center text-sm italic text-slate-300">Brak zadań</p>}
            {[...openTasks, ...tasks.filter(t => t.status !== 'open')].slice(0, 60).map(t => (
              <div key={t.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${t.status === 'done' ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-100'}`}>
                <button onClick={() => toggleTask(t)} title={t.status === 'done' ? 'Cofnij wykonanie' : 'Oznacz jako wykonane'}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${t.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                  {t.status === 'done' && <Check size={12} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {t.title}
                    {t.source === 'ai' && <Sparkles size={12} className="ml-1 inline text-violet-500" />}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t.mine ? (t.created_by && t.created_by.id !== t.assigned_to.id ? `od: ${t.created_by.name}` : 'moje') : `dla: ${t.assigned_to.name}`}
                    {t.due_date ? ` · termin ${new Date(t.due_date).toLocaleDateString('pl-PL')}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <NewTask onAdded={load} />
        </div>
      </div>

      {modal && <EventModal ev={modal.ev} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
};

// ── szybkie dodanie zadania ──
function NewTask({ onAdded }: { onAdded: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [title, setTitle] = useState('');
  const [who, setWho] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // EBS: źródłem osób jest /api/tasks/people (BBS brał je z komunikatora — E6a, jeszcze go nie ma).
    // Lista `people` zawiera też zalogowanego, więc odfiltrowujemy go, żeby nie dublował pozycji „Ja".
    fetch('/api/tasks/people', { credentials: 'same-origin' }).then(r => r.json()).then(d => {
      const others = (d.people || []).filter((p: any) => p.id !== d.me?.id);
      setContacts([{ id: d.me?.id, name: 'Ja', role: '' }, ...others]);
      setWho(d.me?.id || '');
    }).catch(() => {});
  }, []);

  const add = async () => {
    if (!title.trim() || !who || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ title, assigned_to: who, due_date: due || undefined }) });
      if (!r.ok) throw new Error();
      setTitle(''); setDue(''); onAdded();
    } catch { window.alert('Nie udało się dodać zadania'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
      <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Nowe zadanie…" className={INPUT} />
      <div className="flex gap-1.5">
        <select value={who} onChange={e => setWho(e.target.value)} className={INPUT}>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={due} onChange={e => setDue(e.target.value)} className={INPUT + ' w-36'} />
        <button onClick={add} disabled={!title.trim() || busy} className="shrink-0 rounded-lg bg-primary-600 px-3 text-white disabled:opacity-40">{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}</button>
      </div>
    </div>
  );
}

// ── modal wydarzenia (podgląd/edycja/nowe) ──
function EventModal({ ev, onClose, onSaved }: { ev?: Ev; onClose: () => void; onSaved: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({
    title: ev?.title || '', description: ev?.description || '', location: ev?.location || '',
    date: ev ? ev.starts_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    time: ev && !ev.all_day ? new Date(ev.starts_at).toTimeString().slice(0, 5) : '09:00',
    all_day: ev?.all_day || false,
    attendees: new Set<string>(ev?.attendees.map(a => a.id) || []),
  });
  const [busy, setBusy] = useState(false);
  const canEdit = !ev || ev.mine;

  useEffect(() => {
    // Lista uczestników do dopisania — twórcę wydarzenia serwer dokłada sam, więc go pomijamy.
    fetch('/api/tasks/people', { credentials: 'same-origin' }).then(r => r.json())
      .then(d => setContacts((d.people || []).filter((p: any) => p.id !== d.me?.id)))
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    const starts_at = new Date(`${form.date}T${form.all_day ? '00:00' : form.time}:00`).toISOString();
    const body = { title: form.title, description: form.description || undefined, location: form.location || undefined, starts_at, all_day: form.all_day, attendee_ids: [...form.attendees] };
    try {
      const r = ev
        ? await fetch(`/api/calendar/events/${ev.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
        : await fetch('/api/calendar/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Błąd'); }
      onSaved();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); setBusy(false); }
  };

  const remove = async () => {
    if (!ev || !window.confirm(`Usunąć wydarzenie „${ev.title}"?`)) return;
    await fetch(`/api/calendar/events/${ev.id}`, { method: 'DELETE', credentials: 'same-origin' });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900">{ev ? (canEdit ? 'Edytuj wydarzenie' : 'Wydarzenie') : 'Nowe wydarzenie'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        <div className="space-y-3">
          <div><p className={LABEL}>Tytuł *</p><input value={form.title} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={INPUT + ' mt-1'} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><p className={LABEL}>Data</p><input type="date" value={form.date} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={INPUT + ' mt-1'} /></div>
            {!form.all_day && <div><p className={LABEL}>Godzina</p><input type="time" value={form.time} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={INPUT + ' mt-1'} /></div>}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.all_day} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))} /> cały dzień</label>
          <div><p className={LABEL}>Miejsce</p><input value={form.location} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={INPUT + ' mt-1'} placeholder="biuro / online / adres" /></div>
          <div><p className={LABEL}>Opis / notatki</p><textarea value={form.description} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className={INPUT + ' mt-1'} /></div>
          <div>
            <p className={LABEL}>Uczestnicy</p>
            <div className="mt-1 max-h-36 space-y-0.5 overflow-y-auto rounded-lg border border-slate-100 p-1.5">
              {contacts.map(c => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" disabled={!canEdit} checked={form.attendees.has(c.id)}
                    onChange={() => setForm(f => { const n = new Set(f.attendees); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return { ...f, attendees: n }; })} />
                  <span className="text-slate-700">{c.name}</span><span className="text-[11px] text-slate-400">{c.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="mt-4 flex items-center gap-2">
            <button onClick={save} disabled={!form.title.trim() || busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Zapisz
            </button>
            {ev && <button onClick={remove} title="Usuń wydarzenie" className="rounded-xl border border-rose-200 p-2.5 text-rose-500 hover:bg-rose-50"><Trash2 size={16} /></button>}
          </div>
        )}
      </div>
    </div>
  );
}
