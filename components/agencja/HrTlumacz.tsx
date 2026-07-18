'use client';

// Automatyczny tłumacz Agencji Pracy — dwa tryby:
//  • Tekst: wklej/wpisz → tłumaczenie (auto-detekcja języka źródłowego)
//  • Rozmowa na żywo — dwa silniki:
//    – Szybki (OpenAI Realtime, WebRTC): tłumacz symultaniczny mówi tłumaczenia
//      własnym głosem z opóźnieniem ułamka sekundy; klucz OpenAI zostaje na serwerze,
//      przeglądarka dostaje krótkotrwały client secret (/api/hr/translate/rt-session).
//    – Zapasowy (Whisper): nasłuch z cięciem po ciszy (VAD), tłumaczenie per wypowiedź,
//      lektor systemowy — działa wszędzie, wolniejszy (~2-4 s).
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Languages, Loader2, Copy, Check, ArrowLeftRight, Eraser, Sparkles, Mic, MicOff, Volume2, VolumeX, MessageSquareText, Radio, Zap, LifeBuoy, NotebookPen } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

const TARGETS: { code: string; label: string; flag: string; tts: string }[] = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱', tts: 'pl-PL' },
  { code: 'es', label: 'Hiszpański · Español', flag: '🇪🇸', tts: 'es-ES' },
  { code: 'ru', label: 'Rosyjski · Русский', flag: '🇷🇺', tts: 'ru-RU' },
  { code: 'uk', label: 'Ukraiński · Українська', flag: '🇺🇦', tts: 'uk-UA' },
  { code: 'en', label: 'Angielski · English', flag: '🇬🇧', tts: 'en-GB' },
  { code: 'de', label: 'Niemiecki · Deutsch', flag: '🇩🇪', tts: 'de-DE' },
  { code: 'fr', label: 'Francuski · Français', flag: '🇫🇷', tts: 'fr-FR' },
  { code: 'it', label: 'Włoski · Italiano', flag: '🇮🇹', tts: 'it-IT' },
  { code: 'nl', label: 'Niderlandzki (Holandia/Belgia)', flag: '🇳🇱', tts: 'nl-NL' },
  { code: 'cs', label: 'Czeski · Čeština', flag: '🇨🇿', tts: 'cs-CZ' },
  { code: 'ro', label: 'Rumuński · Română', flag: '🇷🇴', tts: 'ro-RO' },
  { code: 'hu', label: 'Węgierski · Magyar', flag: '🇭🇺', tts: 'hu-HU' },
  { code: 'lt', label: 'Litewski · Lietuvių', flag: '🇱🇹', tts: 'lt-LT' },
  { code: 'lv', label: 'Łotewski · Latviešu', flag: '🇱🇻', tts: 'lv-LV' },
  { code: 'et', label: 'Estoński · Eesti', flag: '🇪🇪', tts: 'et-EE' },
  { code: 'hi', label: 'Hinduski · हिन्दी', flag: '🇮🇳', tts: 'hi-IN' },
  { code: 'vi', label: 'Wietnamski · Tiếng Việt', flag: '🇻🇳', tts: 'vi-VN' },
  { code: 'tl', label: 'Filipiński · Tagalog', flag: '🇵🇭', tts: 'fil-PH' },
  { code: 'zh', label: 'Chiński mandaryński · 中文', flag: '🇨🇳', tts: 'zh-CN' },
  { code: 'yue', label: 'Chiński kantoński · 廣東話', flag: '🇭🇰', tts: 'zh-HK' },
  { code: 'ar', label: 'Arabski · العربية', flag: '🇸🇦', tts: 'ar-SA' },
  { code: 'tr', label: 'Turecki · Türkçe', flag: '🇹🇷', tts: 'tr-TR' },
  { code: 'no', label: 'Norweski · Norsk', flag: '🇳🇴', tts: 'nb-NO' },
  { code: 'fi', label: 'Fiński · Suomi', flag: '🇫🇮', tts: 'fi-FI' },
  { code: 'sv', label: 'Szwedzki · Svenska', flag: '🇸🇪', tts: 'sv-SE' },
  { code: 'af', label: 'Afrikaans (RPA)', flag: '🇿🇦', tts: 'af-ZA' },
];
const langLabel = (code: string) => TARGETS.find(t => t.code === code)?.label ?? code;
const ttsLang = (code: string) => TARGETS.find(t => t.code === code)?.tts ?? 'pl-PL';

interface HistItem { id: number; source: string; translation: string; detected: string; target: string }
interface LiveItem { id: number; direction: 'me' | 'other'; transcript: string; translation: string; detected: string; target: string }

// ── głośność z analizatora (odchylenie od ciszy 0-128) — silnik zapasowy ──
function rms(analyser: AnalyserNode, buf: Uint8Array): number {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) { const d = buf[i] - 128; sum += d * d; }
  return Math.sqrt(sum / buf.length);
}

// zgrubne rozpoznanie polskiego (tylko do ustawienia strony dymka w trybie Realtime)
const looksPolish = (t: string) =>
  /[ąćęłńśźż]/i.test(t) || /\b(nie|tak|jest|się|proszę|dzień|jutro|dzisiaj|praca|pracy|godzin|złot)\w*/i.test(t);

const MUTED_MSG = 'Mikrofon jest WYCISZONY na poziomie sprzętu lub systemu (dociera cisza) — sprawdź przycisk/dotyk mute na mikrofonie (często świeci wtedy na czerwono) oraz poziom w Windows: Ustawienia → System → Dźwięk → Mikrofon.';

// mikrofon bywa „live", ale wyciszony sprzętowo (przycisk mute) — wykryj i ostrzeż,
// zamiast pozwolić tłumaczowi nasłuchiwać ciszy w nieskończoność
function watchMicMuted(stream: MediaStream, onMuted: (msg: string | null) => void) {
  const tr = stream.getAudioTracks()[0];
  if (!tr) return;
  if (tr.muted) onMuted(MUTED_MSG);
  tr.onmute = () => onMuted(MUTED_MSG);
  tr.onunmute = () => onMuted(null);
}

export function HrTlumacz() {
  const [mode, setMode] = useState<'text' | 'live'>('text');

  // ── tryb tekstowy ──
  const [text, setText] = useState('');
  const [target, setTarget] = useState('es');
  const [result, setResult] = useState<{ translation: string; detected: string; target: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | 'main' | null>(null);
  const [history, setHistory] = useState<HistItem[]>([]);
  const idRef = useRef(1);

  // dzienny limit płatnego tłumacza (pracownicy tymczasowi — 10 min/dzień)
  const [limitInfo, setLimitInfo] = useState<{ limited: boolean; remaining: number } | null>(null);
  const hbRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshLimit = useCallback(async () => {
    try {
      const r = await fetch('/api/hr/translate/usage', { credentials: 'same-origin' });
      if (r.ok) { const j = await r.json(); setLimitInfo({ limited: !!j.limited, remaining: Number(j.remaining ?? 0) }); }
    } catch { /* */ }
  }, []);
  useEffect(() => { refreshLimit(); }, [refreshLimit]);

  // ── rozmowa na żywo (wspólne) ──
  const [engine, setEngine] = useState<'rt' | 'legacy'>('rt');
  const [liveOn, setLiveOn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [otherLang, setOtherLang] = useState('es');
  const [ttsOn, setTtsOn] = useState(true);
  const [liveStatus, setLiveStatus] = useState<'off' | 'listening' | 'recording' | 'speaking'>('off');
  const [pending, setPending] = useState(0);
  const [liveItems, setLiveItems] = useState<LiveItem[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  // przetworzenie zapisu rozmowy asystentem notatek (zadania/kalendarz/maile)
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteResult, setNoteResult] = useState<string | null>(null);
  const otherLangRef = useRef(otherLang);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  otherLangRef.current = otherLang;

  // silnik Realtime (WebRTC)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const rtStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // silnik zapasowy (VAD + Whisper)
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceStartRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const speakingRef = useRef(false);
  const ttsOnRef = useRef(ttsOn);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  ttsOnRef.current = ttsOn;

  useEffect(() => { listEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [liveItems.length]);
  useEffect(() => () => stopLive(), []); // sprzątanie przy wyjściu z widoku

  // ════════ SILNIK SZYBKI: OpenAI Realtime przez WebRTC ════════
  const startRealtime = async () => {
    setConnecting(true);
    try {
      const sess = await fetch('/api/hr/translate/rt-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ other: otherLangRef.current }),
      });
      const sj = await sess.json().catch(() => ({}));
      if (!sess.ok || !sj.client_secret) throw new Error(sj.error || 'Nie udało się utworzyć sesji tłumacza');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      rtStreamRef.current = stream;
      watchMicMuted(stream, setLiveError);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = e => { if (audioElRef.current) { audioElRef.current.srcObject = e.streams[0]; audioElRef.current.play().catch(() => {}); } };
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = ev => {
        let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
        const type = String(msg.type || '');
        if (type === 'input_audio_buffer.speech_started') setLiveStatus('recording');
        else if (type === 'input_audio_buffer.speech_stopped') setLiveStatus('listening');
        else if (type === 'response.created') setLiveStatus('speaking');
        else if (type === 'response.done' || type === 'output_audio_buffer.stopped') setLiveStatus('listening');
        else if (type === 'conversation.item.input_audio_transcription.completed') {
          const t = String(msg.transcript || '').trim();
          if (!t) return;
          const pl = looksPolish(t);
          setLiveItems(items => [...items, {
            id: idRef.current++, direction: pl ? 'me' : 'other',
            transcript: t, translation: '',
            detected: pl ? 'pl' : otherLangRef.current, target: pl ? otherLangRef.current : 'pl',
          }]);
        } else if (type === 'response.output_audio_transcript.done' || type === 'response.audio_transcript.done') {
          const t = String(msg.transcript || '').trim();
          if (!t) return;
          setLiveItems(items => {
            const idx = items.findIndex(i => !i.translation);
            if (idx === -1) {
              const pl = looksPolish(t); // tłumaczenie po polsku = mówił rozmówca
              return [...items, { id: idRef.current++, direction: pl ? 'other' : 'me', transcript: '…', translation: t, detected: pl ? otherLangRef.current : 'pl', target: pl ? 'pl' : otherLangRef.current }];
            }
            return items.map((i, j) => (j === idx ? { ...i, translation: t } : i));
          });
        } else if (type === 'error') {
          setLiveError(String(msg.error?.message || 'Błąd sesji tłumacza'));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const r = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(sj.model)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sj.client_secret}`, 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      });
      if (!r.ok) throw new Error(`Połączenie z tłumaczem odrzucone (${r.status})`);
      await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });

      setLiveOn(true);
      setLiveStatus('listening');
      setLiveError(null);

      // pracownik z limitem: heartbeat co 30 s zużywa minuty rozmowy; 429 kończy sesję
      if (limitInfo?.limited) {
        hbRef.current = setInterval(async () => {
          try {
            const hb = await fetch('/api/hr/translate/usage', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
              body: JSON.stringify({ seconds: 30 }),
            });
            const j = await hb.json().catch(() => ({}));
            if (j.limited != null) setLimitInfo({ limited: !!j.limited, remaining: Number(j.remaining ?? 0) });
            if (!hb.ok || j.remaining <= 0) { stopLive(); setLiveError('Dzienny limit tłumacza wyczerpany — spróbuj jutra.'); }
          } catch { /* */ }
        }, 30_000);
      }
    } catch (e) {
      stopRealtime();
      setLiveError(e instanceof Error ? e.message : 'Nie udało się połączyć z tłumaczem');
    } finally {
      setConnecting(false);
    }
  };

  const stopRealtime = () => {
    try { dcRef.current?.close(); } catch { /* */ }
    dcRef.current = null;
    try { pcRef.current?.close(); } catch { /* */ }
    pcRef.current = null;
    rtStreamRef.current?.getTracks().forEach(t => t.stop());
    rtStreamRef.current = null;
    if (audioElRef.current) audioElRef.current.srcObject = null;
  };

  // ════════ SILNIK ZAPASOWY: VAD + Whisper + lektor ════════
  // Czy urządzenie ma systemowy głos TTS dla języka? Bez zainstalowanego pakietu
  // (np. ru/de na wielu telefonach) speechSynthesis milczy — wtedy lektor serwerowy.
  const hasSystemVoice = (lang: string) => {
    try {
      const voices = window.speechSynthesis?.getVoices?.() ?? [];
      if (!voices.length) return false; // brak listy = nie ryzykuj ciszy, użyj serwera
      const prefix = ttsLang(lang).split('-')[0].toLowerCase();
      return voices.some(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(prefix));
    } catch { return false; }
  };

  const speakSystem = (t: string, lang: string) => new Promise<void>(resolve => {
    try {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = ttsLang(lang);
      u.rate = 1.05;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch { resolve(); }
  });

  const speakServer = async (t: string, lang: string) => {
    const r = await fetch('/api/hr/translate/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ text: t, lang }),
    });
    if (!r.ok) throw new Error('TTS');
    const url = URL.createObjectURL(await r.blob());
    await new Promise<void>(resolve => {
      const a = new Audio(url);
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });
    URL.revokeObjectURL(url);
  };

  const speak = async (t: string, lang: string) => {
    if (hasSystemVoice(lang)) { await speakSystem(t, lang); return; }
    try { await speakServer(t, lang); } catch { await speakSystem(t, lang); }
  };

  const sendUtterance = (blob: Blob) => {
    setPending(p => p + 1);
    queueRef.current = queueRef.current.then(async () => {
      try {
        const fd = new FormData();
        fd.append('file', blob, 'wypowiedz.webm');
        fd.append('other', otherLangRef.current);
        const r = await fetch('/api/hr/translate/voice', { method: 'POST', body: fd, credentials: 'same-origin' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Błąd tłumaczenia głosu');
        if (j.disabled || j.ok === false) throw new Error(j.error || 'Funkcja AI wyłączona — skonfiguruj klucz API');
        if (j.skip) return;
        setLiveError(null);
        if (limitInfo?.limited) refreshLimit();
        setLiveItems(items => [...items, { id: idRef.current++, direction: j.direction, transcript: j.transcript, translation: j.translation, detected: j.detected, target: j.target }]);
        if (ttsOnRef.current) {
          speakingRef.current = true;
          setLiveStatus(s => (s === 'off' ? s : 'speaking'));
          await speak(j.translation, j.target);
          await new Promise(res => setTimeout(res, 350)); // końcówka lektora poza mikrofonem
          speakingRef.current = false;
          setLiveStatus(s => (s === 'off' ? s : 'listening'));
        }
      } catch (e) {
        setLiveError(e instanceof Error ? e.message : 'Błąd');
      } finally {
        setPending(p => Math.max(0, p - 1));
      }
    });
  };

  const startRecorder = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const dur = Date.now() - voiceStartRef.current;
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      if (dur >= 500 && blob.size > 2000) sendUtterance(blob); // odsiew stuknięć
    };
    rec.start();
    recRef.current = rec;
    voiceStartRef.current = Date.now();
  };

  const startLegacy = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      watchMicMuted(stream, setLiveError);
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.fftSize);
      const THRESHOLD = 6;
      const SILENCE_MS = 900;
      const MAX_UTTER_MS = 20000;
      lastVoiceRef.current = 0;

      tickRef.current = setInterval(() => {
        const a = analyserRef.current;
        if (!a) return;
        const level = rms(a, buf);
        const now = Date.now();
        const rec = recRef.current;
        const recording = !!rec && rec.state === 'recording';

        if (speakingRef.current) {
          if (recording) { recRef.current = null; rec!.stop(); }
          return;
        }
        if (level > THRESHOLD) {
          lastVoiceRef.current = now;
          if (!recording) { startRecorder(); setLiveStatus('recording'); }
          else if (now - voiceStartRef.current > MAX_UTTER_MS) { recRef.current = null; rec!.stop(); setLiveStatus('listening'); }
        } else if (recording && now - lastVoiceRef.current > SILENCE_MS) {
          recRef.current = null; rec!.stop();
          setLiveStatus('listening');
        }
      }, 60);

      setLiveOn(true);
      setLiveStatus('listening');
      setLiveError(null);
    } catch {
      setLiveError('Brak dostępu do mikrofonu — zezwól w przeglądarce i spróbuj ponownie');
    }
  };

  const stopLegacy = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state === 'recording') { rec.ondataavailable = null; rec.onstop = null; try { rec.stop(); } catch { /* */ } }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    try { window.speechSynthesis.cancel(); } catch { /* */ }
    speakingRef.current = false;
  };

  const startLive = () => (engine === 'rt' ? startRealtime() : startLegacy());
  const stopLive = useCallback(() => {
    if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null; }
    stopRealtime();
    stopLegacy();
    setLiveOn(false);
    setLiveStatus('off');
  }, []);

  // ── tryb tekstowy: akcje ──
  const translate = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/hr/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ text: text.trim(), target }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Błąd tłumaczenia');
      if (j.disabled || j.ok === false) throw new Error(j.error || 'Funkcja AI wyłączona — skonfiguruj klucz API');
      if (j.remaining_s != null) setLimitInfo({ limited: true, remaining: Number(j.remaining_s) });
      setResult({ translation: j.translation, detected: j.detected, target: j.target });
      setHistory(h => [{ id: idRef.current++, source: text.trim(), translation: j.translation, detected: j.detected, target: j.target }, ...h].slice(0, 30));
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setBusy(false); }
  };

  const swap = () => {
    if (!result) return;
    setText(result.translation);
    if (TARGETS.some(t => t.code === result.detected)) setTarget(result.detected);
    setResult(null);
  };

  const copy = async (val: string, key: number | 'main') => {
    try { await navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(c => (c === key ? null : c)), 1500); } catch { /* */ }
  };

  // zapis rozmowy → asystent notatek: notatka + kalendarz + zadania + szkice maili
  const processConversation = async () => {
    if (noteBusy || !liveItems.length) return;
    setNoteBusy(true); setNoteResult(null); setLiveError(null);
    try {
      const text = liveItems.map(it =>
        `${it.direction === 'me' ? 'Ja' : 'Rozmówca'} (${langLabel(it.detected)}): ${it.transcript}${it.translation ? `\n→ tłumaczenie: ${it.translation}` : ''}`
      ).join('\n\n');
      const r = await fetch('/api/notes/from-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ text, title: `Rozmowa z tłumacza — ${new Date().toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Błąd przetwarzania rozmowy');
      const res = j.results || {};
      const parts = [
        res.events?.length ? `📅 kalendarz: ${res.events.length}` : '',
        res.tasks?.length ? `✅ zadania: ${res.tasks.length}` : '',
        res.emails?.length ? `✉️ szkice maili: ${res.emails.length} (wyślesz w Notatkach głosowych)` : '',
      ].filter(Boolean).join(' · ');
      setNoteResult(`Notatka „${j.title}" zapisana w Notatkach głosowych${parts ? ` · ${parts}` : ' — bez zadań/terminów w rozmowie'}`);
    } catch (e) { setLiveError(e instanceof Error ? e.message : 'Błąd przetwarzania rozmowy'); } finally { setNoteBusy(false); }
  };

  const statusLabel =
    connecting ? 'Łączę z tłumaczem…'
    : liveStatus === 'recording' ? 'Słyszę wypowiedź…'
    : liveStatus === 'speaking' ? 'Tłumacz mówi…'
    : pending > 0 ? 'Tłumaczę…'
    : liveStatus === 'listening' ? 'Nasłuchuję — mów śmiało'
    : 'Mikrofon wyłączony';

  return (
    <div>
      {/* dźwięk tłumacza (Realtime) */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioElRef} autoPlay className="hidden" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><Languages size={20} className="text-primary-600" /> Tłumacz</h2>
          <p className="text-sm text-slate-500">Komunikacja z pracownikami — tekst albo rozmowa na żywo przez mikrofon</p>
          {limitInfo?.limited && (
            <p className={`mt-1 text-xs font-medium ${limitInfo.remaining <= 60 ? 'text-red-600' : 'text-amber-600'}`}>
              Dzienny limit tłumacza: pozostało {Math.floor(limitInfo.remaining / 60)}:{String(limitInfo.remaining % 60).padStart(2, '0')} min
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            <button onClick={() => setMode('text')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === 'text' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}><MessageSquareText size={15} /> Tekst</button>
            <button onClick={() => setMode('live')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === 'live' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}><Radio size={15} /> Rozmowa na żywo</button>
          </div>
          <Hint text="Tekst: wklej wiadomość i wybierz język docelowy. Rozmowa na żywo: włącz mikrofon i rozmawiajcie — kierunek tłumaczenia rozpoznaje się z języka wypowiedzi. Silnik Szybki (Realtime) mówi tłumaczenia własnym głosem niemal natychmiast; Zapasowy (Whisper) działa wolniej, ale wszędzie — użyj go, gdy Szybki nie może się połączyć." />
        </div>
      </div>

      {mode === 'text' && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* źródło */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tekst źródłowy <span className="normal-case">(język wykrywany automatycznie)</span></p>
                {text && <button onClick={() => { setText(''); setResult(null); setError(null); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"><Eraser size={13} /> Wyczyść</button>}
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); translate(); } }}
                placeholder="Np. Jutro o 7:00 zbiórka przed magazynem — proszę zabrać buty robocze i kartę pobytu…"
                rows={8}
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <div className="mt-3 flex items-center gap-2">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Na język:</span>
                <select value={target} onChange={e => setTarget(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
                  {TARGETS.map(t => <option key={t.code} value={t.code}>{t.flag} {t.label}</option>)}
                </select>
              </div>
              <button onClick={translate} disabled={busy || !text.trim()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {busy ? 'Tłumaczę…' : `Przetłumacz na ${langLabel(target)}`}
              </button>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            {/* wynik */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Tłumaczenie{result && <span className="ml-1 normal-case text-slate-500">· wykryto: {langLabel(result.detected)} → {langLabel(result.target)}</span>}
                </p>
                {result && (
                  <span className="flex items-center gap-1">
                    <button onClick={swap} title="Odwróć kierunek — wynik staje się tekstem źródłowym" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"><ArrowLeftRight size={13} /> Odwróć</button>
                    <button onClick={() => copy(result.translation, 'main')} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${copied === 'main' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      {copied === 'main' ? <><Check size={13} /> Skopiowano</> : <><Copy size={13} /> Kopiuj</>}
                    </button>
                  </span>
                )}
              </div>
              <div className="min-h-[10rem] flex-1 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                {result ? result.translation : <span className="italic text-slate-300">Tu pojawi się tłumaczenie…</span>}
              </div>
            </div>
          </div>

          {/* historia sesji */}
          {history.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ostatnie tłumaczenia (ta sesja)</p>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm">
                    <div className="mb-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      {langLabel(h.detected)} → {langLabel(h.target)}
                      <button onClick={() => copy(h.translation, h.id)} className={`ml-auto flex items-center gap-1 ${copied === h.id ? 'text-emerald-600' : 'hover:text-slate-600'}`}>
                        {copied === h.id ? <><Check size={12} /> Skopiowano</> : <><Copy size={12} /> Kopiuj</>}
                      </button>
                    </div>
                    <p className="truncate text-slate-400" title={h.source}>{h.source}</p>
                    <p className="whitespace-pre-wrap text-slate-800">{h.translation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'live' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {/* pasek sterowania */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
            <button onClick={liveOn ? stopLive : startLive} disabled={connecting}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${liveOn ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'} disabled:bg-slate-300`}>
              {connecting ? <Loader2 size={17} className="animate-spin" /> : liveOn ? <MicOff size={17} /> : <Mic size={17} />}
              {connecting ? 'Łączenie…' : liveOn ? 'Zakończ rozmowę' : 'Włącz mikrofon'}
            </button>
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${liveStatus === 'recording' ? 'animate-pulse bg-red-500' : liveStatus === 'speaking' ? 'bg-sky-500' : pending > 0 ? 'animate-pulse bg-amber-500' : liveOn ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {statusLabel}{pending > 0 && liveStatus !== 'off' ? ` (w kolejce: ${pending})` : ''}
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {/* silnik — zmiana tylko przy wyłączonym mikrofonie */}
              {!liveOn && (
                <span className="mr-2 flex rounded-xl border border-slate-200 bg-white p-0.5">
                  <button onClick={() => setEngine('rt')} title="OpenAI Realtime — tłumaczenia głosem niemal natychmiast"
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${engine === 'rt' ? 'bg-primary-600 text-white' : 'text-slate-500'}`}><Zap size={12} /> Szybki</button>
                  <button onClick={() => setEngine('legacy')} title="Whisper + lektor systemowy — wolniejszy, ale działa wszędzie"
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${engine === 'legacy' ? 'bg-primary-600 text-white' : 'text-slate-500'}`}><LifeBuoy size={12} /> Zapasowy</button>
                </span>
              )}
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rozmówca mówi po:</span>
              <select value={otherLang} onChange={e => setOtherLang(e.target.value)} disabled={liveOn}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50">
                {TARGETS.filter(t => t.code !== 'pl').map(t => <option key={t.code} value={t.code}>{t.flag} {t.label}</option>)}
              </select>
              {engine === 'legacy' && (
                <button onClick={() => setTtsOn(v => !v)} title="Lektor czyta tłumaczenia na głos"
                  className={`ml-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${ttsOn ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
                  {ttsOn ? <Volume2 size={13} /> : <VolumeX size={13} />} Lektor
                </button>
              )}
            </span>
          </div>
          {liveError && <p className="mt-2 text-sm text-red-600">{liveError}{engine === 'rt' && !liveOn ? ' — możesz też przełączyć na silnik Zapasowy.' : ''}</p>}

          {/* rozmowa */}
          <div className="mt-3 max-h-[55vh] min-h-[16rem] space-y-2 overflow-y-auto pr-1">
            {liveItems.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-300">
                <Radio size={28} />
                <p className="max-w-md text-center text-sm italic">
                  Włącz mikrofon i po prostu rozmawiajcie — kierunek tłumaczenia rozpoznaje się z języka wypowiedzi.
                  {engine === 'rt' ? ' Tłumacz mówi na głos niemal natychmiast po każdej wypowiedzi.' : ''}
                </p>
              </div>
            ) : liveItems.map(it => (
              <div key={it.id} className={`flex ${it.direction === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${it.direction === 'me' ? 'bg-primary-50' : 'bg-slate-100'}`}>
                  <p className="mb-0.5 text-[11px] font-semibold text-slate-400">
                    {it.direction === 'me' ? `Ty (${langLabel(it.detected)})` : `Rozmówca (${langLabel(it.detected)})`} → {langLabel(it.target)}
                  </p>
                  <p className="text-slate-500">{it.transcript}</p>
                  <p className="mt-1 flex items-start gap-2 font-medium text-slate-900">
                    <span className="flex-1 whitespace-pre-wrap">{it.translation || <Loader2 size={13} className="animate-spin text-slate-300" />}</span>
                    {it.translation && (
                      <button onClick={() => copy(it.translation, it.id)} className={`mt-0.5 shrink-0 ${copied === it.id ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-500'}`}>
                        {copied === it.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    )}
                  </p>
                </div>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>
          {liveItems.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={processConversation} disabled={noteBusy}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:bg-slate-300">
                {noteBusy ? <Loader2 size={13} className="animate-spin" /> : <NotebookPen size={13} />}
                {noteBusy ? 'Przetwarzam rozmowę…' : 'Przetwórz rozmowę (zadania · kalendarz · maile)'}
              </button>
              <Hint text="Zapis rozmowy trafia do asystenta jak notatka głosowa: powstaje uporządkowana notatka w zakładce Notatki głosowe, umówione terminy idą do Kalendarza, polecenia na listę Zadań, a prośby o wiadomość zamieniają się w szkice maili do wysłania jednym kliknięciem." />
              <button onClick={() => { setLiveItems([]); setNoteResult(null); }} className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"><Eraser size={13} /> Wyczyść rozmowę</button>
            </div>
          )}
          {noteResult && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{noteResult}</p>}
        </div>
      )}
    </div>
  );
}
