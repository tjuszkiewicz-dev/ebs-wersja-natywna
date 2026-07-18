'use client';

// Portal pracownika tymczasowego: moje dane + dokumenty, zmiana nr konta
// (podwójne potwierdzenie), rozliczenia, grafik (w tym automatyczna karta pracy
// z lokalizacji — toggle zgody, ping co 2 min), tłumacz (limit 10 min/dzień).
// czat pracownik↔koordynator: E3
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, FileText, Wallet, CalendarDays, Languages, MapPin, Loader2, LogOut, Pencil, Check, X, AlertTriangle, Clock, Download, MessageSquare, Send } from 'lucide-react';
import { HrTlumacz } from '@/components/agencja/HrTlumacz';

type Tab = 'dane' | 'rozliczenia' | 'grafik' | 'tlumacz' | 'komunikator';

// ── Komunikator z koordynatorem (auto-tłumaczenie PL ↔ język pracownika) ──
// czat pracownik↔koordynator: E3 — zakres odłożony, endpoint /api/me/worker/chat
// jeszcze nie istnieje. Komponent zostawiony w kodzie, ale nieużywany (patrz
// `{false && <WorkerChat />}` niżej) — brak aktywnych fetchy w tym pliku.
function WorkerChat() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [noCoord, setNoCoord] = useState(false);
  const [showPl, setShowPl] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/me/worker/chat', { credentials: 'same-origin' });
      const j = await r.json();
      if (r.ok) { setMsgs(j.messages || []); setNoCoord(!!j.no_coordinator); }
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
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MessageSquare size={15} className="text-primary-500" /> Rozmowa z koordynatorem</p>
        <p className="text-[11px] text-slate-400">Piszesz w swoim języku — koordynator dostaje tłumaczenie po polsku, a Ty jego odpowiedzi w swoim języku.</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ backgroundColor: '#f6f7f9' }}>
        {msgs.length === 0 && <p className="py-8 text-center text-sm italic text-slate-300">Napisz pierwszą wiadomość do koordynatora</p>}
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.mine ? 'bg-primary-600 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-100'}`}>
              <p className="whitespace-pre-wrap">{m.worker || m.pl}</p>
              {m.pl && m.worker && m.pl !== m.worker && (
                <button onClick={() => setShowPl(s => ({ ...s, [m.id]: !s[m.id] }))} className={`mt-1 text-[10px] underline ${m.mine ? 'text-white/70' : 'text-slate-400'}`}>
                  {showPl[m.id] ? 'ukryj polski' : 'pokaż po polsku'}
                </button>
              )}
              {showPl[m.id] && <p className={`mt-1 border-t pt-1 text-[12px] ${m.mine ? 'border-white/20 text-white/80' : 'border-slate-100 text-slate-500'}`}>{m.pl}</p>}
              <p className={`mt-0.5 text-[10px] ${m.mine ? 'text-white/60' : 'text-slate-400'}`}>{fmtT(m.created_at)}</p>
            </div>
          </div>
        ))}
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
const PING_MS = 120_000; // pozycja co 2 minuty (decyzja usera)

const zl = (n?: number | null) => (n == null ? '—' : Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł');
const fmtD = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pl-PL') : '—');
const fmtT = (d?: string | null) => (d ? new Date(d).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—');
const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  );
}

export function TempWorkerDashboard() {
  const [tab, setTab] = useState<Tab>('dane');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  // zmiana konta bankowego — dwa potwierdzenia
  const [bankEdit, setBankEdit] = useState(false);
  const [bankVal, setBankVal] = useState('');
  const [bankStep, setBankStep] = useState(0); // 0=edycja, 1=pierwsze potwierdzenie, 2=drugie
  const [bankBusy, setBankBusy] = useState(false);
  const [bankMsg, setBankMsg] = useState<string | null>(null);

  // lokalizacja (automatyczna karta pracy)
  const [locOn, setLocOn] = useState(false);
  const [locState, setLocState] = useState<{ inside?: boolean; session_open?: boolean; started_at?: string | null; today_hours?: number; has_zone?: boolean; error?: string } | null>(null);
  const locTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (m?: string) => {
    try {
      const r = await fetch(`/api/me/worker?month=${m ?? month}`, { credentials: 'same-origin' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Błąd');
      setData(j);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setLoading(false); }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  // ── lokalizacja: ping teraz + co 2 min ──
  const sendPing = useCallback(() => {
    if (!navigator.geolocation) { setLocState({ error: 'Ta przeglądarka nie obsługuje lokalizacji' }); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const r = await fetch('/api/me/location', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && !j.throttled) setLocState(j);
      } catch { /* brak sieci — spróbujemy przy kolejnym pingu */ }
    }, () => setLocState({ error: 'Brak zgody na lokalizację w przeglądarce/telefonie' }), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }, []);

  const startLoc = useCallback(() => {
    setLocOn(true);
    localStorage.setItem('worker-loc-consent', '1');
    sendPing();
    locTimerRef.current = setInterval(sendPing, PING_MS);
  }, [sendPing]);

  const stopLoc = useCallback(() => {
    setLocOn(false);
    localStorage.removeItem('worker-loc-consent');
    if (locTimerRef.current) { clearInterval(locTimerRef.current); locTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('worker-loc-consent') === '1') startLoc();
    return () => { if (locTimerRef.current) clearInterval(locTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── zmiana konta bankowego (podwójne potwierdzenie) ──
  const saveBank = async () => {
    setBankBusy(true); setBankMsg(null);
    try {
      const r = await fetch('/api/me/worker/bank', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ bank_account: bankVal, confirm: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Błąd zapisu');
      setBankMsg('Numer konta zmieniony ✓ (koordynator został powiadomiony)');
      setBankEdit(false); setBankStep(0); setBankVal('');
      await load();
    } catch (e) { setBankMsg(e instanceof Error ? e.message : 'Błąd'); setBankStep(0); } finally { setBankBusy(false); }
  };

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {}); window.location.href = '/login'; };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400"><Loader2 size={26} className="animate-spin" /></div>;
  if (error) return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <AlertTriangle size={30} className="mx-auto mb-2 text-amber-500" />
      <p className="text-slate-700">{error}</p>
      <button onClick={logout} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm">Wyloguj</button>
    </div>
  );

  const e = data.employee;
  const name = [e.first_name, e.last_name].filter(Boolean).join(' ');
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dane', label: 'Moje dane', icon: <User size={16} /> },
    { id: 'rozliczenia', label: 'Rozliczenia', icon: <Wallet size={16} /> },
    { id: 'grafik', label: 'Grafik', icon: <CalendarDays size={16} /> },
    // czat pracownik↔koordynator: E3 — zakładka „Komunikator" ukryta do czasu wdrożenia /api/me/worker/chat
    { id: 'tlumacz', label: 'Tłumacz', icon: <Languages size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* nagłówek */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 font-bold text-white">{(e.first_name?.[0] ?? '') + (e.last_name?.[0] ?? '')}</div>
          <div className="min-w-0 flex-1">
            <p className="font-sans font-bold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{e.contract?.name ? `Projekt: ${e.contract.name}` : 'Brak przydzielonego projektu'}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"><LogOut size={14} /> Wyloguj</button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-4">
        {/* karta pracy z lokalizacji */}
        <div className={`mb-4 rounded-2xl border p-4 ${locOn ? (locState?.session_open ? 'border-emerald-200 bg-emerald-50' : 'border-sky-200 bg-sky-50') : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-wrap items-center gap-3">
            <MapPin size={20} className={locOn ? 'text-emerald-600' : 'text-slate-400'} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Automatyczna karta pracy</p>
              <p className="text-xs text-slate-500">
                {!locOn ? 'Włącz udostępnianie lokalizacji — obecność w zakładzie odbije się sama, bez odbijania karty.'
                  : locState?.error ? locState.error
                  : locState?.session_open ? `🟢 W pracy od ${fmtT(locState.started_at)} · dziś: ${locState.today_hours ?? data.work_today.hours} h`
                  : locState?.has_zone === false ? 'Lokalizacja działa, ale Twój projekt nie ma jeszcze wyznaczonej strefy — zgłoś koordynatorowi.'
                  : `Poza zakładem · dziś przepracowane: ${locState?.today_hours ?? data.work_today.hours} h`}
              </p>
            </div>
            <button onClick={locOn ? stopLoc : startLoc}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${locOn ? 'bg-slate-400 hover:bg-slate-500' : 'bg-primary-600 hover:bg-primary-700'}`}>
              {locOn ? 'Wyłącz lokalizację' : 'Włącz lokalizację'}
            </button>
          </div>
          {!locOn && <p className="mt-2 text-[11px] text-slate-400">Włączenie = zgoda na przekazywanie pozycji telefonu pracodawcy w celu ewidencji czasu pracy (możesz wyłączyć w każdej chwili). Pozycja wysyłana jest co 2 minuty, gdy aplikacja jest otwarta.</p>}
        </div>

        {/* zakładki */}
        <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'dane' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dane osobowe</p>
              <Row label="Imię i nazwisko" value={[e.first_name, e.second_name, e.last_name, e.second_last_name].filter(Boolean).join(' ')} />
              <Row label="Telefon" value={e.phone} />
              <Row label="E-mail" value={e.email} />
              <Row label="Kraj pochodzenia" value={e.country_of_origin} />
              <Row label="Zawód" value={e.profession} />
              <Row label="Rozmiar buta / ubrania" value={[e.shoe_size, e.clothing_size].filter(Boolean).join(' / ') || '—'} />
              <Row label="PESEL" value={e.pesel} />
              <Row label="Paszport" value={e.passport_number ? `${e.passport_number} (do ${fmtD(e.passport_expiry)})` : '—'} />
              {e.residence_card_number && <Row label="Karta pobytu" value={`${e.residence_card_number} (do ${fmtD(e.residence_card_expiry)})`} />}
              {e.work_permit_number && <Row label="Pozwolenie na pracę" value={`${e.work_permit_number} (do ${fmtD(e.work_permit_expiry)})`} />}
              <Row label="Projekt" value={e.contract?.name} />
              <Row label="Zakwaterowanie" value={e.accommodation ? `${e.accommodation.name}${e.accommodation.address ? ` — ${e.accommodation.address}` : ''}` : '—'} />

              {/* nr konta — edycja z podwójnym potwierdzeniem */}
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Numer konta bankowego (wypłaty)</p>
                    <p className="break-all font-mono text-sm text-slate-800">{e.bank_account || '— nie podano —'}</p>
                  </div>
                  {!bankEdit && <button onClick={() => { setBankEdit(true); setBankVal(''); setBankStep(0); setBankMsg(null); }} className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><Pencil size={12} /> Zmień</button>}
                </div>
                {bankEdit && (
                  <div className="mt-2 space-y-2">
                    {bankStep === 0 && (<>
                      <input value={bankVal} onChange={ev => setBankVal(ev.target.value)} placeholder="Nowy numer konta (26 cyfr lub IBAN)" className={INPUT + ' font-mono'} />
                      <div className="flex gap-2">
                        <button onClick={() => bankVal.trim() && setBankStep(1)} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">Dalej</button>
                        <button onClick={() => { setBankEdit(false); setBankMsg(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">Anuluj</button>
                      </div>
                    </>)}
                    {bankStep === 1 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-amber-800">Czy na pewno chcesz zmienić numer konta na:<br /><span className="font-mono font-semibold">{bankVal}</span>?</p>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => setBankStep(2)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">Tak, chcę zmienić</button>
                          <button onClick={() => setBankStep(0)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">Wróć</button>
                        </div>
                      </div>
                    )}
                    {bankStep === 2 && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm font-semibold text-red-800">OSTATNIE POTWIERDZENIE</p>
                        <p className="text-sm text-red-700">Na ten numer będą przychodzić Twoje wypłaty. Koordynator zostanie powiadomiony o zmianie. Potwierdzasz?</p>
                        <div className="mt-2 flex gap-2">
                          <button onClick={saveBank} disabled={bankBusy} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-300">
                            {bankBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Tak, zmieniam numer konta
                          </button>
                          <button onClick={() => { setBankEdit(false); setBankStep(0); }} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"><X size={12} /> Anuluj</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {bankMsg && <p className={`mt-2 text-xs ${bankMsg.includes('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{bankMsg}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><FileText size={14} /> Moje dokumenty ({data.documents.length})</p>
              {data.documents.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-slate-300">Brak dokumentów w teczce</p>
              ) : (
                <div className="space-y-1.5">
                  {data.documents.map((d: any) => (
                    <a key={d.id} href={d.url ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                      <FileText size={15} className="shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-slate-700">{d.filename}</span>
                      <span className="text-[11px] text-slate-400">{fmtD(d.created_at)}</span>
                      <Download size={13} className="text-slate-300" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'rozliczenia' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Moje rozliczenia (ostatnie 12 miesięcy)</p>
            {data.settlements.length === 0 ? (
              <p className="py-6 text-center text-sm italic text-slate-300">Brak rozliczeń — pojawią się, gdy koordynator ustawi stawkę</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2">Okres</th><th className="px-2 py-2 text-right">Stawka</th><th className="px-2 py-2 text-right">Godziny</th>
                    <th className="px-2 py-2 text-right">Brutto</th><th className="px-2 py-2 text-right">Premia</th><th className="px-2 py-2 text-right">Zaliczki −</th>
                    <th className="px-2 py-2 text-right">Wypłacono −</th><th className="px-2 py-2 text-right">Nocleg −</th><th className="px-2 py-2 text-right">Inne −</th>
                    <th className="px-2 py-2 text-right">Pozostało</th>
                  </tr></thead>
                  <tbody>
                    {data.settlements.map((s: any) => (
                      <tr key={s.period} className="border-b border-slate-50 last:border-0">
                        <td className="px-2 py-2 font-medium text-slate-700">{s.period}</td>
                        <td className="px-2 py-2 text-right">{zl(s.rate)}{s.rate_type === 'monthly' ? '/mies.' : '/h'}</td>
                        <td className="px-2 py-2 text-right">{s.hours || '—'}</td>
                        <td className="px-2 py-2 text-right">{zl(s.gross)}</td>
                        <td className="px-2 py-2 text-right">{s.bonus ? zl(s.bonus) : '—'}</td>
                        <td className="px-2 py-2 text-right text-rose-600">{s.advances ? zl(s.advances) : '—'}</td>
                        <td className="px-2 py-2 text-right text-rose-600">{s.payouts ? zl(s.payouts) : '—'}</td>
                        <td className="px-2 py-2 text-right text-rose-600">{s.rent_share ? zl(s.rent_share) : '—'}</td>
                        <td className="px-2 py-2 text-right text-rose-600">{(Number(s.housing_deduction) + Number(s.other_deduction)) ? zl(Number(s.housing_deduction) + Number(s.other_deduction)) : '—'}</td>
                        <td className={`px-2 py-2 text-right font-semibold ${s.remaining >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{zl(s.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-400">Masz pytania do rozliczenia? Skontaktuj się ze swoim koordynatorem.</p>
          </div>
        )}

        {tab === 'grafik' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grafik pracy · razem: <span className="text-slate-700">{data.schedule.total_hours} h</span></p>
              <input type="month" value={month} onChange={ev => { setMonth(ev.target.value); setLoading(true); load(ev.target.value); }} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            </div>
            {data.schedule.entries.length === 0 ? (
              <p className="py-6 text-center text-sm italic text-slate-300">Brak wpisów w tym miesiącu — godziny pojawią się z grafiku koordynatora albo z automatycznej karty pracy</p>
            ) : (
              <div className="space-y-1">
                {data.schedule.entries.map((s: any) => (
                  <div key={s.work_date} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <span className="w-24 font-medium text-slate-700">{fmtD(s.work_date)}</span>
                    <span className="flex items-center gap-1 text-slate-500"><Clock size={13} /> {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                    <span className="font-semibold text-slate-800">{s.hours} h</span>
                    {s.source === 'gps' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">📍 automatyczna karta</span>}
                    {s.shift && <span className="ml-auto text-[11px] text-slate-400">zmiana {s.shift}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* czat pracownik↔koordynator: E3 — ukryte do czasu wdrożenia /api/me/worker/chat */}
        {false && tab === 'komunikator' && <WorkerChat />}

        {tab === 'tlumacz' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <HrTlumacz />
          </div>
        )}
      </div>
    </div>
  );
}
