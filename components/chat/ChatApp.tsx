'use client';
// Komunikator firmowy EBS (E6a) — powłoka: dwa panele (desktop) / jeden (mobile), modale,
// minimalizacja do przesuwalnego okienka. Cała logika w `useChat`; widoki w ConversationList,
// MessageThread, GroupPanel, PeoplePickerModal. Port z BBS ChatApp.tsx (1458 linii) po rozbiciu
// wg spec E6 §4.4; rozmowy głosowe/wideo, nagrania i push wracają w E6b/E6c.
import React, { useState } from 'react';
import { MessageCircle, Maximize2, X, Users, Plus } from 'lucide-react';
import { useChat } from './useChat';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { GroupPanel } from './GroupPanel';
import { PeoplePickerModal } from './modals/PeoplePickerModal';

export function ChatApp({ meId, onClose }: { meId: string; onClose: () => void }) {
  const chat = useChat(meId);
  const { active, minimized, newChat, addPeople, groupPanel } = chat;

  // przeciąganie mini-okienka, z trzymaniem w obrębie ekranu
  const [miniPos, setMiniPos] = useState(() => ({ x: 20, y: typeof window !== 'undefined' ? Math.max(20, window.innerHeight - 150) : 500 }));
  const startMiniDrag = (e: React.PointerEvent) => {
    const startX = e.clientX, startY = e.clientY;
    const orig = { ...miniPos };
    const move = (ev: PointerEvent) => {
      setMiniPos({
        x: Math.max(6, Math.min(window.innerWidth - 70, orig.x + (ev.clientX - startX))),
        y: Math.max(6, Math.min(window.innerHeight - 60, orig.y + (ev.clientY - startY))),
      });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <>
      {/* panel: przy minimalizacji SCHOWANY (display:none), nie odmontowany — stan rozmowy i subskrypcje żyją dalej.
          Klik w przyciemnione tło obok okna = minimalizacja */}
      <div className={minimized ? 'hidden' : 'fixed inset-0 z-[80] flex bg-slate-900/40'}
        onClick={e => { if (e.target === e.currentTarget) chat.setMinimized(true); }}>
        <div className="relative m-auto flex h-full w-full overflow-hidden bg-white shadow-2xl md:h-[92%] md:w-[94%] md:max-w-6xl md:rounded-2xl">
          <ConversationList chat={chat} onClose={onClose} />
          <MessageThread chat={chat} onClose={onClose} />

          {newChat && (
            <PeoplePickerModal
              title={n => `Nowa rozmowa${n > 1 ? ` — grupa (${n})` : ''}`}
              submitLabel={n => n > 1 ? 'Utwórz grupę' : 'Rozpocznij rozmowę'}
              submitIcon={<MessageCircle size={16} />}
              source="users" groupName
              onClose={() => chat.setNewChat(false)}
              onSubmit={async (ids, name) => {
                const r = await fetch('/api/chat/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ user_ids: ids, name }) });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) { window.alert(d.error || 'Nie udało się utworzyć rozmowy'); return; }
                chat.setNewChat(false);
                await chat.refreshAndOpen(d.id);
              }}
            />
          )}
          {addPeople && active && (
            <PeoplePickerModal
              title={n => `Dodaj do rozmowy${n ? ` (${n})` : ''}`}
              banner={active.type === 'group'
                ? <>Wybrane osoby dołączą do grupy <b>{active.name}</b>.</>
                : <>To rozmowa prywatna — po dodaniu osób powstanie z niej <b>nowa grupa</b> (dotychczasowa rozmowa zostaje bez zmian).</>}
              submitLabel={n => `Dodaj do rozmowy (${n})`}
              submitIcon={<Plus size={16} strokeWidth={2.5} />}
              source="directory"
              exclude={new Set(active.members.map(m => m.id))}
              onClose={() => chat.setAddPeople(false)}
              onSubmit={ids => chat.addToConversation(ids)}
            />
          )}
          {groupPanel && <GroupPanel chat={chat} />}
        </div>
      </div>

      {/* mini-okienko: przesuwalne, reszta aplikacji dostępna */}
      {minimized && (
        <div style={{ left: miniPos.x, top: miniPos.y }} className="fixed z-[95] w-64 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
          <div onPointerDown={startMiniDrag} className="flex cursor-grab touch-none items-center gap-2 bg-slate-900 px-3 py-2 text-white active:cursor-grabbing">
            {active?.type === 'group' ? <Users size={18} className="shrink-0 text-primary-300" /> : <MessageCircle size={18} className="shrink-0 text-primary-300" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{active?.name || 'Komunikator'}</p>
              <p className="text-[11px] text-white/60">zminimalizowany</p>
            </div>
            <button onPointerDown={e => e.stopPropagation()} onClick={() => chat.setMinimized(false)} title="Rozwiń" className="rounded-full p-1.5 hover:bg-white/15"><Maximize2 size={16} /></button>
            <button onPointerDown={e => e.stopPropagation()} onClick={() => { chat.setMinimized(false); onClose(); }} title="Zamknij" className="rounded-full p-1.5 hover:bg-white/15"><X size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
