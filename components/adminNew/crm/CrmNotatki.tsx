'use client';

// Notatki głosowe CRM (E7e). Dyktujesz albo wklejasz zapis rozmowy — asystent
// wyciąga ustalenia, zakłada terminy w kalendarzu i zadania, a maile zostawia
// jako szkice (poczta CRM to E6d, więc stąd nic nie wychodzi na zewnątrz).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, Square, Loader2, Sparkles, RefreshCw, AlertCircle, CalendarDays,
  CheckSquare, Mail, Copy, Check, FileText,
} from 'lucide-react';

interface SzkicMaila { to?: string | null; subject: string; body: string }
interface Notatka {
  id: string;
  title: string;
  summary: string | null;
  email_drafts: SzkicMaila[];
  created_events: { id: string; title: string; starts_at: string }[];
  created_tasks: { id: string; title: string; due_date: string | null }[];
  origin: 'text' | 'glos' | 'tlumacz';
  created_at: string;
}

const CARD = 'rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm';
const BTN_PRIMARY =
  'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white ' +
  'hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const BTN_GHOST =
  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 ' +
  'ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors';

function dataPl(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export const CrmNotatki: React.FC = () => {
  const [notes, setNotes] = useState<Notatka[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // dyktowanie
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const pobierz = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/notes', { credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setNotes(d.notes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać notatek');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { pobierz(); }, [pobierz]);

  const startRec = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!blob.size) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append('file', blob, 'notatka.webm');
          const r = await fetch('/api/notes/transcribe', { method: 'POST', body: fd, credentials: 'same-origin' });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Transkrypcja nie powiodła się');
          if (d.disabled) { setError(d.error); return; }
          setText(t => (t ? `${t}\n\n${d.text}` : d.text));
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Błąd transkrypcji');
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError('Brak dostępu do mikrofonu — możesz wpisać notatkę tekstem.');
    }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const przetworz = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const r = await fetch('/api/notes/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ text, title: title.trim() || undefined, origin: 'glos' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Nie udało się przetworzyć notatki');
      if (d.disabled) { setError(d.error); return; }
      const res = d.results || {};
      const czesci = [
        res.events?.length ? `terminy: ${res.events.length}` : '',
        res.tasks?.length ? `zadania: ${res.tasks.length}` : '',
        res.emails?.length ? `szkice maili: ${res.emails.length}` : '',
      ].filter(Boolean).join(' · ');
      setInfo(`Zapisano „${d.title}"${czesci ? ` — ${czesci}` : ' — bez terminów i zadań w treści'}`);
      setText(''); setTitle('');
      await pobierz();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setBusy(false);
    }
  };

  const kopiuj = async (klucz: string, tresc: string) => {
    try {
      await navigator.clipboard.writeText(tresc);
      setCopied(klucz);
      setTimeout(() => setCopied(c => (c === klucz ? null : c)), 1500);
    } catch { /* schowek niedostępny — trudno */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles size={20} className="text-blue-600" /> Notatki głosowe
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Podyktuj albo wklej zapis rozmowy. Asystent wyciągnie ustalenia, założy terminy
          w kalendarzu i zadania, a maile przygotuje jako szkice do skopiowania.
        </p>
      </div>

      {/* ── Nowa notatka ─────────────────────────────────────────────── */}
      <div className={`${CARD} p-5 space-y-3`}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Tytuł (opcjonalnie — sam się uzupełni datą)"
          className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={7}
          placeholder="Treść notatki albo zapis rozmowy…"
          className="w-full resize-y rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          {recording ? (
            <button onClick={stopRec} className={BTN_GHOST + ' !text-red-600 !ring-red-200'}>
              <Square size={15} /> Zatrzymaj nagrywanie
            </button>
          ) : (
            <button onClick={startRec} disabled={transcribing || busy} className={BTN_GHOST}>
              {transcribing ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
              {transcribing ? 'Rozpoznaję mowę…' : 'Dyktuj'}
            </button>
          )}
          <button onClick={przetworz} disabled={!text.trim() || busy} className={BTN_PRIMARY}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? 'Analizuję…' : 'Wyciągnij ustalenia'}
          </button>
          <button onClick={pobierz} disabled={loading} className={BTN_GHOST}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Odśwież
          </button>
          {recording && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> nagrywam
            </span>
          )}
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {info && (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <Check size={15} className="mt-0.5 shrink-0" /> {info}
          </p>
        )}
      </div>

      {/* ── Lista notatek ────────────────────────────────────────────── */}
      {loading && notes.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={15} className="animate-spin" /> Wczytuję notatki…
        </div>
      ) : notes.length === 0 ? (
        <div className={`${CARD} p-8 text-center`}>
          <FileText size={28} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">Brak notatek — podyktuj pierwszą powyżej.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className={`${CARD} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-800">{n.title}</h3>
                  <p className="text-xs text-slate-400">
                    {dataPl(n.created_at)}
                    {n.origin === 'tlumacz' && ' · z tłumacza'}
                    {n.origin === 'glos' && ' · dyktowana'}
                  </p>
                </div>
              </div>

              {n.summary && <p className="mt-3 text-sm leading-relaxed text-slate-600">{n.summary}</p>}

              {(n.created_events?.length > 0 || n.created_tasks?.length > 0) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {n.created_events?.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <CalendarDays size={13} /> Terminy w kalendarzu
                      </p>
                      <ul className="space-y-1">
                        {n.created_events.map(e => (
                          <li key={e.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                            <span className="font-medium">{e.title}</span>
                            <span className="text-slate-400"> · {dataPl(e.starts_at)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {n.created_tasks?.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <CheckSquare size={13} /> Zadania
                      </p>
                      <ul className="space-y-1">
                        {n.created_tasks.map(t => (
                          <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                            <span className="font-medium">{t.title}</span>
                            {t.due_date && <span className="text-slate-400"> · do {t.due_date}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {n.email_drafts?.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Mail size={13} /> Szkice maili
                    <span className="font-normal normal-case tracking-normal text-slate-400">
                      — do skopiowania; wysyłka dojdzie z modułem poczty
                    </span>
                  </p>
                  <div className="space-y-2">
                    {n.email_drafts.map((m, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-700">{m.subject}</p>
                            {m.to && <p className="truncate text-[11px] text-slate-400">do: {m.to}</p>}
                          </div>
                          <button
                            onClick={() => kopiuj(`${n.id}-${i}`, `${m.subject}\n\n${m.body}`)}
                            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white"
                            title="Kopiuj"
                          >
                            {copied === `${n.id}-${i}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{m.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CrmNotatki;
