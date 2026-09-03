'use client';
// Wspólny wybór osób dla dwóch modali z BBS (NewChatModal:1095 i AddPeopleModal:1286 — różniły się
// tylko źródłem listy, banerem i przyciskiem). `source` = endpoint z listą; `exclude` = już w rozmowie.
import React, { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Avatar } from '../Avatar';
import type { Contact } from '../types';

export function PeoplePickerModal({ title, banner, submitLabel, submitIcon, source, exclude, groupName, onClose, onSubmit }: {
  title: (n: number) => string;
  banner?: React.ReactNode;
  submitLabel: (n: number) => string;
  submitIcon: React.ReactNode;
  source: 'users' | 'directory';
  exclude?: Set<string>;
  /** pokaż pole nazwy grupy, gdy zaznaczono > 1 osobę (nowa rozmowa) */
  groupName?: boolean;
  onClose: () => void;
  onSubmit: (ids: string[], name?: string) => Promise<void>;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(source === 'users' ? '/api/chat/users' : '/api/chat/directory', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => {
        const list: Contact[] = source === 'users'
          ? (d.users || []).map((u: any) => ({ id: u.id, name: u.name, role: u.role, role_label: u.role_label }))
          : [...(d.people || []), ...(d.workers || [])].map((p: any) => ({ id: p.id, name: p.name, role: p.role, role_label: p.role_label }));
        setContacts(list);
      })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [source]);

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const submit = async () => {
    if (!sel.size || busy) return;
    setBusy(true);
    try { await onSubmit([...sel], name.trim() || undefined); } finally { setBusy(false); }
  };

  const filtered = contacts.filter(c => !exclude?.has(c.id) && (!q.trim() || c.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80%] w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 bg-slate-900 px-4 py-3">
          <p className="flex-1 text-sm font-bold text-white">{title(sel.size)}</p>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/80 hover:bg-white/10"><X size={17} /></button>
        </div>
        {banner && <div className="bg-primary-50 px-4 py-2 text-[12px] text-primary-800">{banner}</div>}
        {groupName && sel.size > 1 && (
          <div className="border-b border-slate-100 p-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa grupy…" className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
        )}
        <div className="border-b border-slate-100 p-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj osoby…" className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-6"><Loader2 size={17} className="animate-spin text-slate-400" /></div>}
          {filtered.map(c => (
            <button key={c.id} onClick={() => toggle(c.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
              <Avatar name={c.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                <p className="text-[11px] text-slate-400">{c.role_label || c.role}</p>
              </div>
              {sel.has(c.id) && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white"><Check size={13} /></span>}
            </button>
          ))}
          {!loading && !filtered.length && <p className="px-4 py-6 text-center text-sm italic text-slate-300">{exclude?.size ? 'Wszyscy z katalogu są już w tej rozmowie' : 'Brak osób, z którymi możesz rozmawiać'}</p>}
        </div>
        <div className="border-t border-slate-100 p-3">
          <button onClick={submit} disabled={!sel.size || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
            {busy ? <Loader2 size={16} className="animate-spin" /> : submitIcon} {submitLabel(sel.size)}
          </button>
        </div>
      </div>
    </div>
  );
}
