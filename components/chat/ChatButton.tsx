'use client';
// Przycisk komunikatora z licznikiem nieprzeczytanych. SAM się bramkuje uprawnieniem
// `komunikator.czat` (/api/me/permissions) — renderuje nic, gdy użytkownik go nie ma, więc
// montaż w layoutach nie wymaga własnej logiki dostępu. Dwa warianty: w nagłówku panelu
// (`header`) i pływający (`floating`, dla layoutów bez nagłówka — panel sprzedaży).
// Port z BBS ChatApp.tsx:1353 bez nasłuchu połączeń przychodzących (E6c).
import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { ChatApp } from './ChatApp';
import type { Conv } from './types';

export function ChatButton({ meId, variant = 'header' }: { meId: string; variant?: 'header' | 'floating' }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/me/permissions', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setAllowed(!!d && (d.role === 'superadmin' || (d.permissions || []).includes('komunikator.czat'))))
      .catch(() => setAllowed(false));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/chat/conversations', { credentials: 'same-origin' });
        const d = await r.json();
        if (alive && r.ok) setUnread((d.conversations || []).reduce((a: number, c: Conv) => a + (c.unread || 0), 0));
      } catch { /* */ }
    };
    poll();
    const t = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [allowed, open]);

  if (!allowed) return null;

  const badge = unread > 0 && (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white">
      {unread > 99 ? '99+' : unread}
    </span>
  );

  return (
    <>
      {variant === 'header' ? (
        <button onClick={() => setOpen(true)} title="Komunikator" aria-label="Komunikator"
          className="relative rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-primary-600">
          <MessageCircle size={20} />
          {badge}
        </button>
      ) : (
        <button onClick={() => setOpen(true)} title="Komunikator" aria-label="Komunikator"
          className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-primary-300 shadow-xl ring-1 ring-white/10 transition hover:scale-105 hover:text-white">
          <MessageCircle size={24} />
          {badge}
        </button>
      )}
      {open && <ChatApp meId={meId} onClose={() => setOpen(false)} />}
    </>
  );
}
