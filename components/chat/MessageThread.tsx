'use client';
// Prawy panel komunikatora: nagłówek rozmowy, wątek (dymki, akcje, reakcje, cytaty, tłumaczenie),
// podpowiedzi wzmianek, „pisze…", belka odpowiedzi/edycji, pasek wpisywania z głosówką.
// Port z BBS ChatApp.tsx:784–1008 (rozmowy głosowe/wideo i „Notatka AI" → E6c).
import React from 'react';
import { MessageCircle, ArrowLeft, Plus, X, Minimize2, Loader2, Paperclip, Mic, Send, Square, Check, CheckCheck, FileText, Ban, CornerUpLeft, Pencil, Trash2, Smile, Languages } from 'lucide-react';
import { Avatar } from './Avatar';
import type { ChatState } from './useChat';
import type { Msg } from './types';
import { tTime, tDay, fmtDur, hue, roleLabel } from '@/lib/chat/format';

// szybkie reakcje pod wiadomością (jak przytrzymanie dymka w WhatsAppie)
const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageThread({ chat, onClose }: { chat: ChatState; onClose: () => void }) {
  const { active, meId, msgs, loadingMsgs, hasMore, loadingOlder, typers, replyTo, editing, input, sending, recording, recSec, mentionCandidates, notice } = chat;

  if (!active) {
    return (
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-slate-50 md:flex">
        <MessageCircle size={64} className="text-slate-200" />
        <p className="text-sm text-slate-400">Wybierz rozmowę z listy albo zacznij nową</p>
      </div>
    );
  }

  const other = active.type === 'direct' ? active.members.find(m => m.id !== meId) : null;
  const subtitle = active.type === 'group'
    ? active.members.map(m => m.full_name.split(' ')[0]).join(', ')
    : (other?.role_label || roleLabel(other?.role));

  // grupowanie wiadomości po dniach
  const grouped: { day: string; items: Msg[] }[] = [];
  for (const m of msgs) {
    const day = tDay(m.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) last.items.push(m); else grouped.push({ day, items: [m] });
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* nagłówek rozmowy */}
      <div className="flex items-center gap-3 bg-slate-900 px-4 py-2.5">
        <button onClick={() => chat.setActive(null)} className="rounded-full p-1.5 text-white/80 hover:bg-white/10 md:hidden"><ArrowLeft size={19} /></button>
        <Avatar name={active.name} group={active.type === 'group'} size={38} />
        <button onClick={() => active.type === 'group' && chat.setGroupPanel(true)} disabled={active.type !== 'group'}
          title={active.type === 'group' ? 'Informacje o grupie (nazwa, uczestnicy)' : undefined}
          className="min-w-0 flex-1 text-left disabled:cursor-default">
          <p className="truncate text-[15px] font-semibold text-white">{active.name}</p>
          <p className="truncate text-[11px] text-white/60">{subtitle}</p>
        </button>
        <button onClick={() => chat.setAddPeople(true)} title="Dodaj osoby do rozmowy" className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-primary-300"><Plus size={24} strokeWidth={2.5} /></button>
        <button onClick={() => chat.setMinimized(true)} title="Zminimalizuj" className="rounded-full p-2 text-white/80 hover:bg-white/10"><Minimize2 size={18} /></button>
        <button onClick={onClose} className="hidden rounded-full p-2 text-white/80 hover:bg-white/10 md:block"><X size={19} /></button>
      </div>

      {/* wątek */}
      <div ref={chat.listRef} onScroll={e => { if ((e.target as HTMLDivElement).scrollTop < 60 && hasMore && !loadingOlder) chat.loadOlder(); }}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 px-4 py-3 md:px-10"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.05) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        {loadingOlder && <div className="flex justify-center py-2"><Loader2 size={15} className="animate-spin text-slate-400" /></div>}
        {hasMore && !loadingOlder && (
          <div className="mb-2 flex justify-center"><button onClick={chat.loadOlder} className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm hover:bg-white">↑ starsze wiadomości</button></div>
        )}
        {loadingMsgs && <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>}
        {grouped.map(g => (
          <div key={g.day}>
            <div className="my-3 flex justify-center"><span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">{g.day}</span></div>
            {g.items.map(m => <MessageBubble key={m.id} m={m} chat={chat} isGroup={active.type === 'group'} />)}
          </div>
        ))}
        <div ref={chat.bottomRef} />
      </div>

      {/* komunikat nieblokujący (np. tłumaczenie wyłączone) */}
      {notice && (
        <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
          <span className="flex-1">{notice}</span>
          <button onClick={() => chat.setNotice(null)} className="rounded-full p-1 hover:bg-amber-100"><X size={14} /></button>
        </div>
      )}

      {/* podpowiedzi wzmianek @ */}
      {mentionCandidates.length > 0 && (
        <div className="border-t border-slate-200 bg-white px-2 py-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Oznacz osobę</p>
          <div className="flex max-h-32 flex-col overflow-y-auto">
            {mentionCandidates.map(mm => (
              <button key={mm.id} onClick={() => chat.applyMention(mm.full_name)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
                <Avatar name={mm.full_name} size={26} />
                <span className="truncate text-[13px] text-slate-700">{mm.full_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* „pisze…" — znika po 4 s ciszy */}
      {Object.keys(typers).length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-1">
          <p className="text-[12px] italic text-slate-500">{Object.keys(typers).join(', ')} {Object.keys(typers).length > 1 ? 'piszą' : 'pisze'}…</p>
        </div>
      )}

      {/* belka: odpowiadam na… / edytuję wiadomość */}
      {(replyTo || editing) && (
        <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-100 px-3 py-2">
          <div className="min-w-0 flex-1 rounded-md border-l-[3px] border-primary-500 bg-white px-2 py-1">
            <p className="text-[11px] font-semibold text-primary-700">
              {editing ? 'Edytujesz wiadomość' : `Odpowiadasz — ${replyTo!.sender_id === meId ? 'Ty' : replyTo!.sender_name}`}
            </p>
            <p className="truncate text-[12px] text-slate-500">{(editing || replyTo)!.content || (editing || replyTo)!.file_name || 'załącznik'}</p>
          </div>
          <button onClick={() => { chat.setReplyTo(null); if (editing) { chat.setEditing(null); chat.setInput(''); } }}
            title="Anuluj" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200"><X size={16} /></button>
        </div>
      )}

      {/* pasek wpisywania */}
      <div className="flex items-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
        <input ref={chat.fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) chat.uploadFile(f); e.target.value = ''; }} />
        <button onClick={() => chat.fileRef.current?.click()} title="Załącz plik" className="rounded-full p-2.5 text-slate-500 hover:bg-slate-200"><Paperclip size={20} /></button>
        {recording ? (
          <div className="flex flex-1 items-center gap-3 rounded-full bg-white px-4 py-2.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-medium text-slate-700">Nagrywanie… {fmtDur(recSec)}</span>
            <span className="ml-auto text-[11px] text-slate-400">kliknij ⏹ aby wysłać</span>
          </div>
        ) : (
          <textarea value={input} rows={1}
            onChange={e => chat.onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chat.sendText(); }
              if (e.key === 'Escape') { chat.setReplyTo(null); if (editing) { chat.setEditing(null); chat.setInput(''); } }
            }}
            placeholder={editing ? 'Popraw wiadomość…' : 'Wpisz wiadomość'}
            className="max-h-28 flex-1 resize-none rounded-full border-0 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        )}
        {input.trim() ? (
          <button onClick={chat.sendText} disabled={sending} className="rounded-full bg-primary-600 p-2.5 text-white hover:bg-primary-700 disabled:opacity-50"><Send size={19} /></button>
        ) : recording ? (
          <button onClick={chat.stopRec} className="rounded-full bg-red-500 p-2.5 text-white hover:bg-red-600"><Square size={19} /></button>
        ) : (
          <button onClick={chat.startRec} title="Nagraj głosówkę" className="rounded-full bg-primary-600 p-2.5 text-white hover:bg-primary-700"><Mic size={19} /></button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ m, chat, isGroup }: { m: Msg; chat: ChatState; isGroup: boolean }) {
  const { meId, othersReadAt, reactFor, setReactFor, translating } = chat;
  const mine = m.sender_id === meId;
  const tmp = String(m.id).startsWith('tmp-');

  // wiadomość systemowa (np. „X opuścił grupę") — karta na środku
  if (m.kind === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <div className="max-w-[92%] rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 shadow-sm">
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-800">
            {(m.content || '').split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>)}
          </p>
          <p className="mt-0.5 text-right text-[10px] text-amber-500">{tTime(m.created_at)}</p>
        </div>
      </div>
    );
  }

  const bubble = mine ? 'bg-primary-100' : 'bg-white';
  const senderTag = isGroup && !mine && <p className="text-[11px] font-bold" style={{ color: `hsl(${hue(m.sender_name)},55%,40%)` }}>{m.sender_name}</p>;

  if (m.deleted) {
    return (
      <div className={`mb-1.5 flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[78%] rounded-lg px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200 ${bubble}`}>
          {senderTag}
          <p className="flex items-center gap-1.5 text-[13px] italic text-slate-400"><Ban size={13} /> Wiadomość usunięta</p>
          <p className="mt-0.5 text-right text-[10px] text-slate-400">{tTime(m.created_at)}</p>
        </div>
      </div>
    );
  }

  // ✓✓ = wszyscy pozostali przeczytali (porównanie z ich last_read_at)
  const readByAll = mine && !!othersReadAt && othersReadAt >= m.created_at && !tmp;
  const canTranslate = !mine && m.kind === 'text' && !!m.content && !tmp;

  return (
    <div className={`mb-1.5 flex ${mine ? 'justify-end' : 'justify-start'}`}>
      {/* `relative` na OPAKOWANIU dymka, nie na całym wierszu: w BBS `right-full` liczył się od
          pełnej szerokości wiersza i ikony akcji lądowały przy lewej krawędzi wątku (zaobserwowane
          na produkcji 03.09) — tu siedzą tuż obok dymka */}
      <div className="group relative max-w-[78%]">
      {/* akcje wiadomości: reakcja / przetłumacz / odpowiedz / edytuj / usuń */}
      {!tmp && (
        <div className={`absolute top-0 z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 ${mine ? 'right-full mr-1' : 'left-full ml-1'}`}>
          <div className="relative">
            <ActionBtn title="Reakcja" onClick={() => setReactFor(reactFor === m.id ? null : m.id)} hover="hover:text-amber-500"><Smile size={13} /></ActionBtn>
            {reactFor === m.id && (
              <div className="absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full bg-white px-2 py-1 shadow-xl ring-1 ring-slate-200">
                {QUICK_EMOJI.map(e => <button key={e} onClick={() => chat.react(m, e)} className="rounded-full px-1 text-[18px] leading-none transition hover:scale-125">{e}</button>)}
              </div>
            )}
          </div>
          {canTranslate && !m.translated && (
            <ActionBtn title="Przetłumacz na polski" onClick={() => chat.translate(m, 'pl')} hover="hover:text-primary-600">
              {translating === m.id ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
            </ActionBtn>
          )}
          <ActionBtn title="Odpowiedz (z cytatem)" onClick={() => { chat.setReplyTo(m); chat.setEditing(null); }} hover="hover:text-primary-600"><CornerUpLeft size={13} /></ActionBtn>
          {mine && m.kind === 'text' && (
            <ActionBtn title="Edytuj (do 60 minut od wysłania)" onClick={() => { chat.setEditing(m); chat.setReplyTo(null); chat.setInput(m.content || ''); }} hover="hover:text-primary-600"><Pencil size={13} /></ActionBtn>
          )}
          {mine && <ActionBtn title="Usuń u wszystkich" onClick={() => chat.deleteMsg(m)} hover="hover:text-red-600"><Trash2 size={13} /></ActionBtn>}
        </div>
      )}

      <div className={`rounded-lg px-2.5 py-1.5 shadow-sm ${bubble}`}>
        {senderTag}
        {m.reply_to && (
          <div className="mb-1 rounded-md border-l-[3px] border-primary-500 bg-black/5 px-2 py-1">
            <p className="text-[11px] font-semibold text-primary-700">{m.reply_to.sender_name}</p>
            <p className="truncate text-[12px] text-slate-500">{m.reply_to.preview}</p>
          </div>
        )}
        {m.kind === 'text' && <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-slate-900">{m.content}</p>}
        {m.kind === 'text' && m.translated && m.translated.content !== m.content && (
          <div className="mt-1 border-t border-black/10 pt-1">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary-700"><Languages size={11} /> tłumaczenie ({m.translated.lang})</p>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">{m.translated.content}</p>
          </div>
        )}
        {m.kind === 'audio' && m.url && (
          <div className="flex items-center gap-2 py-1">
            <audio controls src={m.url} className="h-9 max-w-[220px]" preload="none" />
            <span className="text-[11px] text-slate-500">{fmtDur(m.duration_sec)}</span>
          </div>
        )}
        {m.kind === 'image' && m.url && <a href={m.url} target="_blank" rel="noopener noreferrer"><img src={m.url} alt={m.file_name || ''} className="max-h-64 rounded-md" /></a>}
        {(m.kind === 'file' || m.kind === 'recording') && m.url && (
          <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md bg-black/5 px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-black/10">
            <FileText size={17} className="shrink-0 text-slate-500" /> <span className="truncate">{m.file_name || 'Plik'}</span>
          </a>
        )}
        {!!m.reactions?.length && (
          <div className="mt-1 flex flex-wrap gap-1">
            {m.reactions.map(r => (
              <button key={r.emoji} onClick={() => chat.react(m, r.emoji)} title={r.mine ? 'Kliknij, aby cofnąć swoją reakcję' : 'Dołącz reakcję'}
                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] ring-1 transition ${r.mine ? 'bg-primary-50 ring-primary-300' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
                <span>{r.emoji}</span>{r.count > 1 && <span className="text-[10px] font-semibold text-slate-500">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">
          {m.edited && <span className="italic">edytowano</span>}
          {tTime(m.created_at)}
          {mine && (readByAll ? <CheckCheck size={13} className="text-sky-500" /> : <Check size={13} className="text-slate-400" />)}
        </p>
      </div>
      </div>
    </div>
  );
}

const ActionBtn = ({ title, onClick, hover, children }: { title: string; onClick: () => void; hover: string; children: React.ReactNode }) => (
  <button onClick={onClick} title={title} className={`rounded-full bg-white p-1.5 text-slate-500 shadow ring-1 ring-slate-200 ${hover}`}>{children}</button>
);
