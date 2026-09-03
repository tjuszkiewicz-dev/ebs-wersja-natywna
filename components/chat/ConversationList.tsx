'use client';
// Lewy panel komunikatora: nagłówek, szukajka, grupy, wyniki szukania w treści, archiwum,
// katalog personelu i (dla koordynatorów) pracowników tymczasowych. Port z BBS ChatApp.tsx:666–781, 1231.
import React from 'react';
import { Search, Plus, Users, X, Minimize2, Archive, Pin, BellOff, MoreVertical, MessageCircle, Languages } from 'lucide-react';
import { Avatar } from './Avatar';
import type { ChatState } from './useChat';
import type { Conv, Person } from './types';
import { tTime, previewOf } from '@/lib/chat/format';

const Unread = ({ n }: { n: number }) => n > 0
  ? <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white">{n}</span>
  : null;

export function ConversationList({ chat, onClose }: { chat: ChatState; onClose: () => void }) {
  const { convs, active, search, setSearch, hits, searching, people, workers, showArchived, setShowArchived, convMenu, setConvMenu } = chat;
  const q = search.trim().toLowerCase();
  const groupConvs = convs.filter(c => c.type === 'group' && !c.archived && (!q || c.name.toLowerCase().includes(q)));
  const archivedConvs = convs.filter(c => c.archived);
  const byQuery = (p: Person) => !q || p.name.toLowerCase().includes(q) || (p.role_label || '').toLowerCase().includes(q);
  const dirPeople = people.filter(byQuery);
  const dirWorkers = workers.filter(byQuery);

  return (
    <div className={`flex w-full flex-col border-r border-slate-200 bg-white md:w-[360px] ${active ? 'hidden md:flex' : 'flex'}`}>
      <div className="flex items-center gap-1 bg-slate-900 px-4 py-3">
        <p className="flex-1 text-base font-bold text-white">Komunikator</p>
        <button onClick={() => chat.setNewChat(true)} title="Nowa rozmowa / grupa" className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-primary-300"><Plus size={19} /></button>
        <button onClick={() => chat.setMinimized(true)} title="Zminimalizuj" className="rounded-full p-2 text-white/80 hover:bg-white/10"><Minimize2 size={18} /></button>
        <button onClick={onClose} title="Zamknij" className="rounded-full p-2 text-white/80 hover:bg-white/10"><X size={19} /></button>
      </div>
      <div className="border-b border-slate-100 p-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj osoby, grupy lub w treści…"
            className="w-full rounded-lg bg-slate-100 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {groupConvs.length > 0 && <SectionLabel>Grupy</SectionLabel>}
        {groupConvs.map(c => (
          <ConvRow key={c.id} c={c} activeId={active?.id} onOpen={chat.openConv}
            menuOpen={convMenu === c.id} onMenu={() => setConvMenu(convMenu === c.id ? null : c.id)} onPref={chat.setConvPref} />
        ))}

        {q.length >= 2 && (
          <>
            <SectionLabel>Wiadomości {searching ? '…' : `(${hits.length})`}</SectionLabel>
            {!searching && hits.length === 0 && <p className="px-4 py-2 text-[13px] italic text-slate-300">Brak wiadomości z tą frazą</p>}
            {hits.map(h => (
              <button key={h.message_id} onClick={() => chat.openHit(h)} className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-slate-50">
                <Search size={15} className="mt-1 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-slate-700">{h.conversation_name}</p>
                    <span className="shrink-0 text-[11px] text-slate-400">{tTime(h.created_at)}</span>
                  </div>
                  <p className="truncate text-[12px] text-slate-500"><span className="text-slate-400">{h.sender_name.split(' ')[0]}: </span>{h.content}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {archivedConvs.length > 0 && (
          <>
            <button onClick={() => setShowArchived(v => !v)}
              className="mt-3 flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] font-semibold text-slate-500 hover:bg-slate-50">
              <Archive size={14} /> Zarchiwizowane ({archivedConvs.length}) {showArchived ? '▾' : '▸'}
            </button>
            {showArchived && archivedConvs.map(c => (
              <ConvRow key={c.id} c={c} activeId={active?.id} onOpen={chat.openConv}
                menuOpen={convMenu === c.id} onMenu={() => setConvMenu(convMenu === c.id ? null : c.id)} onPref={chat.setConvPref} />
            ))}
          </>
        )}

        <SectionLabel>Zespół ({dirPeople.length})</SectionLabel>
        {dirPeople.length === 0 && (
          <div className="px-6 py-8 text-center">
            <Users size={32} className="mx-auto text-slate-200" />
            <p className="mt-2 text-sm text-slate-400">{people.length === 0 ? 'Ładowanie listy…' : 'Brak osób pasujących do wyszukiwania'}</p>
          </div>
        )}
        {dirPeople.map(p => <PersonRow key={p.id} p={p} active={active} onOpen={chat.openPerson} />)}

        {dirWorkers.length > 0 && (
          <>
            <SectionLabel>Pracownicy tymczasowi ({dirWorkers.length})</SectionLabel>
            {dirWorkers.map(p => <PersonRow key={p.id} p={p} active={active} onOpen={chat.openPerson} worker />)}
          </>
        )}
      </div>
    </div>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) =>
  <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</p>;

function PersonRow({ p, active, onOpen, worker }: { p: Person; active: Conv | null; onOpen: (p: Person) => void; worker?: boolean }) {
  const isActive = !!active && active.type === 'direct' && (active.id === p.conversation_id || active.members.some(m => m.id === p.id));
  return (
    <button onClick={() => onOpen(p)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 ${isActive ? 'bg-slate-100' : ''}`}>
      <Avatar name={p.name} online={p.online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-medium text-slate-900">{p.name}</p>
          {p.last_message && <span className={`shrink-0 text-[11px] ${p.unread ? 'font-bold text-primary-600' : 'text-slate-400'}`}>{tTime(p.last_message.created_at)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] text-slate-500">
            {p.last_message ? previewOf(p.last_message) : (
              <span className="flex items-center gap-1 text-slate-400">
                {p.role_label}{worker && p.language && <><Languages size={11} /> {p.language}</>}
              </span>
            )}
          </p>
          <Unread n={p.unread} />
        </div>
      </div>
    </button>
  );
}

// Komponent na poziomie modułu — inaczej menu gubiłoby stan przy każdym odświeżeniu listy.
function ConvRow({ c, activeId, onOpen, menuOpen, onMenu, onPref }: {
  c: Conv; activeId?: string; onOpen: (c: Conv) => void;
  menuOpen: boolean; onMenu: () => void; onPref: (c: Conv, patch: Record<string, any>) => void;
}) {
  const lastTxt = previewOf(c.last_message);
  return (
    <div className={`group relative flex w-full items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 ${activeId === c.id ? 'bg-slate-100' : ''}`}>
      <button onClick={() => onOpen(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar name={c.name} group={c.type === 'group'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1 truncate text-[15px] font-medium text-slate-900">
              {c.pinned && <Pin size={12} className="shrink-0 text-slate-400" />}
              {c.muted && <BellOff size={12} className="shrink-0 text-slate-400" />}
              <span className="truncate">{c.name}</span>
            </p>
            {c.last_message && <span className={`shrink-0 text-[11px] ${c.unread ? 'font-bold text-primary-600' : 'text-slate-400'}`}>{tTime(c.last_message.created_at)}</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] text-slate-500">{lastTxt ?? <span className="italic text-slate-300">brak wiadomości</span>}</p>
            <Unread n={c.unread} />
          </div>
        </div>
      </button>
      <button onClick={onMenu} title="Więcej" className={`shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 ${menuOpen ? 'bg-slate-200' : 'opacity-0 group-hover:opacity-100'}`}>
        <MoreVertical size={16} />
      </button>
      {menuOpen && (
        <div className="absolute right-2 top-12 z-20 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-200">
          <MenuItem icon={<Pin size={14} />} onClick={() => onPref(c, { pinned: !c.pinned })}>{c.pinned ? 'Odepnij' : 'Przypnij na górze'}</MenuItem>
          <MenuItem icon={<BellOff size={14} />} onClick={() => onPref(c, { muted: !c.muted })}>{c.muted ? 'Włącz powiadomienia' : 'Wycisz powiadomienia'}</MenuItem>
          <MenuItem icon={<Archive size={14} />} onClick={() => onPref(c, { archived: !c.archived })}>{c.archived ? 'Przywróć z archiwum' : 'Archiwizuj'}</MenuItem>
          <MenuItem icon={<MessageCircle size={14} />} onClick={() => onPref(c, { mark_unread: true })}>Oznacz jako nieprzeczytane</MenuItem>
        </div>
      )}
    </div>
  );
}

const MenuItem = ({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
    <span className="text-slate-400">{icon}</span> {children}
  </button>
);
