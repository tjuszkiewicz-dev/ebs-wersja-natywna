'use client';
// Panel „Komunikator" portalu pracownika tymczasowego: jedna rozmowa — z koordynatorem.
// Wyjęty ze stubu w TempWorkerDashboard.tsx (E2e), uruchomiony w E6a na /api/me/worker/chat
// (spec E6 §4.7). Pracownik pisze w swoim języku; koordynator dostaje tłumaczenie po polsku,
// a jego odpowiedzi wracają w języku pracownika (auto-tłumaczenie K14, gdy kartoteka ma `language`).
// Odpytywanie co 8 s — bez subskrypcji Realtime (jeden rozmówca, decyzja ze specu).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Loader2, Languages } from 'lucide-react';
import { tTime } from '@/lib/chat/format';

interface WorkerMsg { id: string; mine: boolean; kind: string; worker: string | null; pl: string | null; created_at: string; deleted?: boolean }

export function WorkerChat() {
  const [msgs, setMsgs] = useState<WorkerMsg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [noCoord, setNoCoord] = useState(false);
  const [coordinator, setCoordinator] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [showPl, setShowPl] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/me/worker/chat', { credentials: 'same-origin' });
      const j = await r.json();
      if (r.ok) { setMsgs(j.messages || []); setNoCoord(!!j.no_coordinator); setCoordinator(j.coordinator?.name ?? null); setLang(j.lang ?? null); }
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setText('');
    try {
      const r = await fetch('/api/me/worker/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ content: t }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); window.alert(j.error || 'Błąd wysyłki'); setText(t); }
      await load();
    } catch { setText(t); } finally { setSending(false); }
  };

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> …</div>;
  if (noCoord) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Nie masz jeszcze przypisanego koordynatora. Zgłoś się do biura, aby móc pisać.</div>;

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MessageSquare size={15} className="text-primary-500" /> Rozmowa z koordynatorem{coordinator ? ` — ${coordinator}` : ''}</p>
        <p className="flex items-center gap-1 text-[11px] text-slate-400">
          <Languages size={11} />
          {lang
            ? 'Piszesz w swoim języku — koordynator dostaje tłumaczenie po polsku, a Ty jego odpowiedzi w swoim języku.'
            : 'Twoja kartoteka nie ma ustawionego języka — wiadomości nie są tłumaczone automatycznie. Poproś koordynatora o uzupełnienie.'}
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ backgroundColor: '#f6f7f9' }}>
        {msgs.length === 0 && <p className="py-8 text-center text-sm italic text-slate-300">Napisz pierwszą wiadomość do koordynatora</p>}
        {msgs.map(m => {
          const main = m.deleted ? 'wiadomość usunięta' : (m.worker || m.pl || '');
          const hasPl = !m.deleted && !!m.pl && !!m.worker && m.pl !== m.worker;
          return (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.mine ? 'bg-primary-600 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-100'}`}>
                <p className={`whitespace-pre-wrap ${m.deleted ? 'italic opacity-60' : ''}`}>{main}</p>
                {hasPl && (
                  <button onClick={() => setShowPl(s => ({ ...s, [m.id]: !s[m.id] }))} className={`mt-1 text-[10px] underline ${m.mine ? 'text-white/70' : 'text-slate-400'}`}>
                    {showPl[m.id] ? 'ukryj polski' : 'pokaż po polsku'}
                  </button>
                )}
                {hasPl && showPl[m.id] && <p className={`mt-1 border-t pt-1 text-[12px] ${m.mine ? 'border-white/20 text-white/80' : 'border-slate-100 text-slate-500'}`}>{m.pl}</p>}
                <p className={`mt-0.5 text-[10px] ${m.mine ? 'text-white/60' : 'text-slate-400'}`}>{tTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Napisz wiadomość…" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        <button onClick={send} disabled={!text.trim() || sending} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white disabled:opacity-40">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
