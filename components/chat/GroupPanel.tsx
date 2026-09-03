'use client';
// Panel grupy: nazwa, uczestnicy (usuwanie), wyjście z grupy. Port z BBS ChatApp.tsx:1015–1052.
import React from 'react';
import { Users, X, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from './Avatar';
import type { ChatState } from './useChat';
import { roleLabel } from '@/lib/chat/format';

export function GroupPanel({ chat }: { chat: ChatState }) {
  const { active, meId } = chat;
  if (!active || active.type !== 'group') return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => chat.setGroupPanel(false)}>
      <div className="flex max-h-[80%] w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 bg-slate-900 px-4 py-3">
          <Users size={17} className="text-primary-300" />
          <p className="flex-1 truncate text-sm font-bold text-white">{active.name}</p>
          <button onClick={() => chat.setGroupPanel(false)} className="rounded-full p-1.5 text-white/80 hover:bg-white/10"><X size={17} /></button>
        </div>
        <div className="border-b border-slate-100 p-3">
          <button onClick={chat.renameGroup} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
            <Pencil size={14} className="text-slate-400" /> Zmień nazwę grupy
          </button>
        </div>
        <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Uczestnicy ({active.members.length})</p>
        <div className="flex-1 overflow-y-auto">
          {active.members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <Avatar name={m.full_name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-slate-800">{m.full_name}{m.id === meId && <span className="text-slate-400"> (Ty)</span>}</p>
                <p className="text-[11px] text-slate-400">{m.role_label || roleLabel(m.role)}</p>
              </div>
              {m.id !== meId && (
                <button onClick={() => chat.removeMember(m.id, m.full_name)} title="Usuń z grupy" className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 p-3">
          <button onClick={() => chat.removeMember(meId, 'Ty')} className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-[13px] font-semibold text-red-700 hover:bg-red-100">
            Opuść grupę
          </button>
        </div>
      </div>
    </div>
  );
}
