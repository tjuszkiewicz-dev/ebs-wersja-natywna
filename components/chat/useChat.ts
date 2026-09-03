'use client';
// Stan i akcje komunikatora (E6a) — wyjęte z BBS-owego ChatApp.tsx (1458 linii), który mieszał
// logikę z UI. Komponenty (ChatApp, ConversationList, MessageThread…) są czystym widokiem
// nad tym hookiem. Wycięte do E6b/E6c: push, rozmowy głosowe, nagrania, transkrypcja.
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import type { Conv, Msg, Person, SearchHit } from './types';

const json = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' as const, body: JSON.stringify(body) });
const get = { credentials: 'same-origin' as const };

export function useChat(meId: string) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [othersReadAt, setOthersReadAt] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);   // katalog: personel
  const [workers, setWorkers] = useState<Person[]>([]); // katalog: pracownicy tymczasowi koordynatora
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [convMenu, setConvMenu] = useState<string | null>(null);
  const [groupPanel, setGroupPanel] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const [addPeople, setAddPeople] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [typers, setTypers] = useState<Record<string, number>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // komunikat nieblokujący (np. tłumaczenie wyłączone)

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active?.id ?? null;
  const skipScrollRef = useRef(false);

  // ── ładowanie ──
  const loadConvs = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/conversations', get);
      const d = await r.json();
      if (r.ok) setConvs(d.conversations || []);
    } catch { /* */ }
  }, []);

  const loadMsgs = useCallback(async (convId: string, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages`, get);
      const d = await r.json();
      if (r.ok && activeRef.current === convId) {
        // przy odpytywaniu dokładamy tylko NOWE na koniec — nie kasujemy dociągniętej historii
        setMsgs(prev => {
          const incoming: Msg[] = d.messages || [];
          if (!prev.length) return incoming;
          const known = new Set(prev.map(m => m.id));
          const fresh = incoming.filter(m => !known.has(m.id));
          // usuń optymistyczne „tmp-", których realna wersja właśnie przyszła (nadawca + treść)
          const freshKeys = new Set(fresh.map(m => `${m.sender_id}|${m.kind}|${m.content ?? ''}`));
          const byId = new Map(incoming.map(m => [m.id, m]));
          // podmiana istniejących na wersję z serwera — inaczej edycja/usunięcie/tłumaczenie
          // u innych osób nigdy by się nie pokazały
          const cleaned = prev
            .filter(m => !(String(m.id).startsWith('tmp-') && freshKeys.has(`${m.sender_id}|${m.kind}|${m.content ?? ''}`)))
            .map(m => {
              const srv = byId.get(m.id);
              if (!srv) return m;
              const same = srv.content === m.content && !!srv.deleted === !!m.deleted && !!srv.edited === !!m.edited
                && (srv.translated?.content ?? null) === (m.translated?.content ?? null)
                && JSON.stringify(srv.reactions || []) === JSON.stringify(m.reactions || []);
              return same ? m : srv;
            });
          const changed = cleaned.length !== prev.length || cleaned.some((m, i) => m !== prev[i]);
          if (!fresh.length) return changed ? cleaned : prev;
          return [...cleaned, ...fresh];
        });
        setHasMore(!!d.has_more);
        setOthersReadAt(d.others_read_at ?? null);
      }
    } catch { /* */ } finally { if (!silent) setLoadingMsgs(false); }
  }, []);

  // historia: przewinięcie do góry dociąga starsze wiadomości bez skoku
  const loadOlder = useCallback(async () => {
    const convId = activeRef.current;
    const first = msgs[0];
    if (!convId || !first || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    skipScrollRef.current = true;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages?before=${encodeURIComponent(first.created_at)}`, get);
      const d = await r.json();
      if (r.ok && activeRef.current === convId) {
        setMsgs(prev => [...(d.messages || []), ...prev]);
        setHasMore(!!d.has_more);
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
      }
    } catch { /* */ } finally { setLoadingOlder(false); }
  }, [msgs, loadingOlder, hasMore]);

  const loadDirectory = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/directory', get);
      const d = await r.json();
      if (r.ok) { setPeople(d.people || []); setWorkers(d.workers || []); }
    } catch { /* */ }
  }, []);

  // odpytywanie jako ZAPAS (Realtime niżej daje natychmiastowość)
  useEffect(() => { loadConvs(); const t = setInterval(loadConvs, 20000); return () => clearInterval(t); }, [loadConvs]);
  useEffect(() => { loadDirectory(); const t = setInterval(loadDirectory, 10000); return () => clearInterval(t); }, [loadDirectory]);
  useEffect(() => {
    if (!active) return;
    setMsgs([]); setHasMore(false); setReplyTo(null); setEditing(null); setTypers({}); setReactFor(null);
    loadMsgs(active.id);
    const t = setInterval(() => loadMsgs(active.id, true), 15000);
    return () => clearInterval(t);
  }, [active?.id, loadMsgs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime: serwer nadaje na `user:{mojeId}` po każdej zmianie (RLS deny-all → broadcast, K1) ──
  useEffect(() => {
    if (!meId) return;
    const ch = supabaseBrowser.channel(`user:${meId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'chat' }, ({ payload }: any) => {
      if (payload?.type === 'message') { loadConvs(); loadDirectory(); }
      if (activeRef.current && payload?.conversation_id === activeRef.current) loadMsgs(activeRef.current, true);
    });
    ch.subscribe();
    return () => { supabaseBrowser.removeChannel(ch); };
  }, [meId, loadConvs, loadMsgs, loadDirectory]);

  // ── „pisze…" — sygnał klient↔klient na temat rozmowy, bez zapisu w bazie ──
  const typingChanRef = useRef<any>(null);
  const typingSentRef = useRef(0);
  useEffect(() => {
    if (!active?.id || !meId) { typingChanRef.current = null; return; }
    const members = active.members || [];
    const ch = supabaseBrowser.channel(`typing:${active.id}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
      if (!payload?.from || payload.from === meId) return;
      const who = (members.find(m => m.id === payload.from)?.full_name || 'Ktoś').split(' ')[0];
      setTypers(p => ({ ...p, [who]: Date.now() }));
    });
    ch.subscribe();
    typingChanRef.current = ch;
    const gc = setInterval(() => setTypers(p => {
      const now = Date.now();
      const n = Object.fromEntries(Object.entries(p).filter(([, t]) => now - t < 4000));
      return Object.keys(n).length === Object.keys(p).length ? p : n;
    }), 1500);
    return () => { clearInterval(gc); supabaseBrowser.removeChannel(ch); typingChanRef.current = null; };
  }, [active?.id, meId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pingTyping = useCallback(() => {
    const now = Date.now();
    if (now - typingSentRef.current < 2000) return;   // maks. 1 sygnał na 2 s
    typingSentRef.current = now;
    typingChanRef.current?.send({ type: 'broadcast', event: 'typing', payload: { from: meId } });
  }, [meId]);

  // ── obecność: „jestem tu" co 2 min, dopóki komunikator jest otwarty ──
  useEffect(() => {
    const beat = () => { fetch('/api/chat/presence', { method: 'POST', credentials: 'same-origin' }).catch(() => {}); };
    beat();
    const t = setInterval(beat, 120000);
    return () => clearInterval(t);
  }, []);

  // ── szukanie w TREŚCI wiadomości (od 2 znaków, z odroczeniem) ──
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setHits([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/chat/search?q=${encodeURIComponent(term)}`, get);
        const d = await r.json();
        setHits(r.ok ? (d.results || []) : []);
      } catch { setHits([]); } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // przewijanie na dół przy nowych wiadomościach (nie przy dociąganiu historii)
  useEffect(() => {
    if (skipScrollRef.current) { skipScrollRef.current = false; return; }
    bottomRef.current?.scrollIntoView();
  }, [msgs.length, active?.id]);

  // ── nawigacja ──
  const openConv = useCallback((c: Conv) => {
    setActive(c); setConvMenu(null); setGroupPanel(false);
    setConvs(p => p.map(x => x.id === c.id ? { ...x, unread: 0 } : x));
  }, []);

  const refreshAndOpen = useCallback(async (id: string) => {
    const r = await fetch('/api/chat/conversations', get);
    const d = await r.json();
    const list: Conv[] = d.conversations || [];
    setConvs(list);
    const c = list.find(x => x.id === id);
    if (c) openConv(c);
    return c ?? null;
  }, [openConv]);

  const openHit = useCallback(async (h: SearchHit) => {
    const c = convs.find(x => x.id === h.conversation_id);
    setSearch('');
    if (c) openConv(c); else await refreshAndOpen(h.conversation_id);
  }, [convs, openConv, refreshAndOpen]);

  // klik w osobę z katalogu → istniejąca rozmowa 1:1 albo nowa
  const openPerson = useCallback(async (p: Person) => {
    if (p.conversation_id) {
      const c = convs.find(x => x.id === p.conversation_id);
      if (c) { openConv(c); return; }
    }
    try {
      const r = await fetch('/api/chat/conversations', json({ user_ids: [p.id] }));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Błąd');
      if (!(await refreshAndOpen(d.id))) await loadDirectory();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Nie udało się otworzyć rozmowy'); }
  }, [convs, openConv, refreshAndOpen, loadDirectory]);

  // ── ustawienia rozmowy i grupy ──
  const setConvPref = useCallback(async (c: Conv, patch: Record<string, any>) => {
    setConvMenu(null);
    setConvs(p => p.map(x => x.id === c.id ? { ...x, ...patch } : x));   // optymistycznie
    try {
      const r = await fetch(`/api/chat/conversations/${c.id}`, { ...json(patch), method: 'PATCH' });
      if (!r.ok) throw new Error();
    } catch { window.alert('Nie udało się zapisać ustawienia'); }
    finally { loadConvs(); }
  }, [loadConvs]);

  const renameGroup = useCallback(async () => {
    if (!active) return;
    const name = window.prompt('Nowa nazwa grupy:', active.name)?.trim();
    if (!name || name === active.name) return;
    const r = await fetch(`/api/chat/conversations/${active.id}`, { ...json({ name }), method: 'PATCH' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); window.alert(d.error || 'Nie udało się zmienić nazwy'); return; }
    setActive(a => a ? { ...a, name } : a);
    loadConvs();
  }, [active, loadConvs]);

  // usunięcie uczestnika z grupy albo (userId === ja) opuszczenie grupy
  const removeMember = useCallback(async (userId: string, label: string) => {
    if (!active) return;
    const self = userId === meId;
    if (!window.confirm(self ? `Opuścić grupę „${active.name}"?` : `Usunąć z grupy: ${label}?`)) return;
    const r = await fetch(`/api/chat/conversations/${active.id}/participants/${userId}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); window.alert(d.error || 'Nie udało się'); return; }
    if (self) { setGroupPanel(false); setActive(null); }
    else setActive(a => a ? { ...a, members: a.members.filter(m => m.id !== userId) } : a);
    loadConvs();
  }, [active, meId, loadConvs]);

  // „+" w nagłówku: grupa — dochodzą; 1:1 — serwer tworzy nową grupę i tu na nią przechodzimy
  const addToConversation = useCallback(async (ids: string[]) => {
    if (!active) return;
    const r = await fetch(`/api/chat/conversations/${active.id}/participants`, json({ user_ids: ids }));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { window.alert(d.error || 'Nie udało się dodać osób do rozmowy'); return; }
    setAddPeople(false);
    await refreshAndOpen(d.id || active.id);
  }, [active, refreshAndOpen]);

  // ── wiadomości ──
  const sendText = useCallback(async () => {
    const content = input.trim();
    if (!content || !active || sending) return;

    // tryb edycji własnej wiadomości (zamiast wysyłania nowej)
    if (editing) {
      const target = editing;
      setInput(''); setEditing(null); setSending(true);
      setMsgs(m => m.map(x => x.id === target.id ? { ...x, content, edited: true, translated: null } : x));
      try {
        const r = await fetch(`/api/chat/conversations/${active.id}/messages/${target.id}`, { ...json({ content }), method: 'PATCH' });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Nie udało się zapisać zmiany'); }
        loadMsgs(active.id, true); loadConvs();
      } catch (e) {
        setMsgs(m => m.map(x => x.id === target.id ? target : x));
        window.alert(e instanceof Error ? e.message : 'Nie udało się zapisać zmiany');
      } finally { setSending(false); }
      return;
    }

    const quoted = replyTo;
    setInput(''); setReplyTo(null); setMentionQuery(null); setSending(true);
    const tmp: Msg = {
      id: 'tmp-' + Date.now(), sender_id: meId, sender_name: 'Ja', kind: 'text', content, created_at: new Date().toISOString(),
      reply_to: quoted ? { id: quoted.id, sender_name: quoted.sender_id === meId ? 'Ty' : quoted.sender_name, preview: (quoted.content || quoted.file_name || '').slice(0, 120) } : null,
    };
    setMsgs(m => [...m, tmp]);
    try {
      const r = await fetch(`/api/chat/conversations/${active.id}/messages`, json({ content, reply_to_id: quoted?.id }));
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Nie udało się wysłać'); }
      loadMsgs(active.id, true); loadConvs();
    } catch (e) {
      setMsgs(m => m.filter(x => x.id !== tmp.id)); setInput(content); setReplyTo(quoted);
      window.alert(e instanceof Error ? e.message : 'Nie udało się wysłać');
    } finally { setSending(false); }
  }, [input, active, sending, editing, replyTo, meId, loadMsgs, loadConvs]);

  // reakcja emoji (ta sama drugi raz = zdjęcie własnej reakcji)
  const react = useCallback(async (m: Msg, emoji: string) => {
    if (!active) return;
    setReactFor(null);
    setMsgs(list => list.map(x => {
      if (x.id !== m.id) return x;
      const rs = (x.reactions || []).map(r => ({ ...r }));
      const hit = rs.find(r => r.emoji === emoji);
      if (hit?.mine) { hit.count--; hit.mine = false; }
      else if (hit) { hit.count++; hit.mine = true; }
      else rs.push({ emoji, count: 1, mine: true });
      return { ...x, reactions: rs.filter(r => r.count > 0) };
    }));
    try {
      const r = await fetch(`/api/chat/conversations/${active.id}/messages/${m.id}/reactions`, json({ emoji }));
      if (!r.ok) throw new Error();
    } catch { /* */ } finally { loadMsgs(active.id, true); }
  }, [active, loadMsgs]);

  // usunięcie własnej wiadomości „dla wszystkich" (dymek zostaje jako „wiadomość usunięta")
  const deleteMsg = useCallback(async (m: Msg) => {
    if (!active || !window.confirm('Usunąć tę wiadomość u wszystkich?')) return;
    const before = m;
    setMsgs(list => list.map(x => x.id === m.id ? { ...x, deleted: true, content: null, url: null, translated: null } : x));
    try {
      const r = await fetch(`/api/chat/conversations/${active.id}/messages/${m.id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Nie udało się usunąć'); }
      loadConvs();
    } catch (e) {
      setMsgs(list => list.map(x => x.id === m.id ? before : x));
      window.alert(e instanceof Error ? e.message : 'Nie udało się usunąć');
    }
  }, [active, loadConvs]);

  // tłumaczenie na żądanie (D7): wynik ląduje w wiadomości; powód braku — w `notice`
  const translate = useCallback(async (m: Msg, target = 'pl') => {
    if (!active || translating) return;
    setTranslating(m.id);
    try {
      const r = await fetch(`/api/chat/conversations/${active.id}/messages/${m.id}/translate`, json({ target }));
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd tłumaczenia');
      if (d.ok) setMsgs(list => list.map(x => x.id === m.id ? { ...x, translated: { content: d.content, lang: d.lang } } : x));
      else setNotice(d.disabled ? 'Tłumaczenie jest wyłączone (brak klucza AI na serwerze).' : (d.error || 'Nie udało się przetłumaczyć'));
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Błąd tłumaczenia'); }
    finally { setTranslating(null); }
  }, [active, translating]);

  const uploadFile = useCallback(async (file: File, kind?: string, duration?: number) => {
    if (!active) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('conversation_id', active.id);
      fd.append('file', file);
      if (kind) fd.append('kind', kind);
      if (duration) fd.append('duration_sec', String(duration));
      const r = await fetch('/api/chat/upload', { method: 'POST', credentials: 'same-origin', body: fd });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Błąd wysyłania'); }
      loadMsgs(active.id, true); loadConvs();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd wysyłania pliku'); }
    finally { setSending(false); }
  }, [active, loadMsgs, loadConvs]);

  // ── głosówka (MediaRecorder) ──
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<any>(null);
  const recSecRef = useRef(0);
  const startRec = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recChunks.current = [];
      rec.ondataavailable = e => { if (e.data.size) recChunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recTimer.current);
        const blob = new Blob(recChunks.current, { type: 'audio/webm' });
        const dur = recSecRef.current;
        setRecording(false); setRecSec(0);
        if (dur >= 1) uploadFile(new File([blob], `głosówka-${Date.now()}.webm`, { type: 'audio/webm' }), 'audio', dur);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true); setRecSec(0);
      recSecRef.current = 0;
      recTimer.current = setInterval(() => { recSecRef.current += 1; setRecSec(s => s + 1); }, 1000);
    } catch { window.alert('Brak dostępu do mikrofonu'); }
  }, [uploadFile]);
  const stopRec = useCallback(() => { recRef.current?.stop(); }, []);

  // wzmianki: „@fra" w polu → podpowiedzi z uczestników rozmowy
  const mentionCandidates = mentionQuery === null ? [] :
    (active?.members || []).filter(m => m.id !== meId &&
      (!mentionQuery || m.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))).slice(0, 6);
  const applyMention = useCallback((name: string) => {
    setInput(prev => prev.replace(/@([\p{L}]*)$/u, `@${name} `));
    setMentionQuery(null);
  }, []);

  const onInputChange = useCallback((v: string) => {
    setInput(v); pingTyping();
    const mm = active?.type === 'group' ? v.match(/@([\p{L}]*)$/u) : null;
    setMentionQuery(mm ? mm[1] : null);
  }, [active?.type, pingTyping]);

  return {
    meId, convs, active, setActive, msgs, loadingMsgs, hasMore, loadingOlder, othersReadAt,
    input, setInput, onInputChange, search, setSearch, hits, searching, people, workers,
    sending, recording, recSec, replyTo, setReplyTo, editing, setEditing, reactFor, setReactFor,
    mentionCandidates, applyMention, convMenu, setConvMenu, groupPanel, setGroupPanel,
    showArchived, setShowArchived, newChat, setNewChat, addPeople, setAddPeople,
    minimized, setMinimized, typers, translating, notice, setNotice,
    listRef, bottomRef, fileRef,
    loadConvs, loadMsgs, loadOlder, loadDirectory, refreshAndOpen, openConv, openHit, openPerson,
    setConvPref, renameGroup, removeMember, addToConversation,
    sendText, react, deleteMsg, translate, uploadFile, startRec, stopRec,
  };
}

export type ChatState = ReturnType<typeof useChat>;
