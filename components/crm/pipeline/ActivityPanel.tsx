'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, FileText, Phone, Mail, Users, Cog, Loader2, Send, Download, ExternalLink, MessageSquare,
} from 'lucide-react';

interface LeadLite { id: string; name: string; }

type ActType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'SYSTEM';

interface Activity {
  id: string; type: ActType; body: string;
  author_name: string | null; is_system: boolean; created_at: string;
}
interface Offer {
  id: string; created_at: string; total_savings_monthly: number;
  employees_count: number | null; pdf_url: string | null;
}

const TYPE_META: Record<ActType, { label: string; icon: React.ReactNode; cls: string }> = {
  NOTE:    { label: 'Notatka',   icon: <FileText size={12} />,      cls: 'bg-amber-100 text-amber-700' },
  CALL:    { label: 'Telefon',   icon: <Phone size={12} />,         cls: 'bg-blue-100 text-blue-700' },
  EMAIL:   { label: 'Mail',      icon: <Mail size={12} />,          cls: 'bg-teal-100 text-teal-700' },
  MEETING: { label: 'Spotkanie', icon: <Users size={12} />,         cls: 'bg-violet-100 text-violet-700' },
  SYSTEM:  { label: 'System',    icon: <Cog size={12} />,           cls: 'bg-slate-200 text-slate-600' },
};
const ADD_TYPES: ActType[] = ['NOTE', 'CALL', 'EMAIL', 'MEETING'];

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const money = (n: number) => Math.round(n || 0).toLocaleString('pl-PL') + ' zł';

export default function ActivityPanel({ lead, onClose }: { lead: LeadLite; onClose: () => void }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<ActType>('NOTE');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, o] = await Promise.all([
        fetch(`/api/crm/leads/${lead.id}/activities`, { credentials: 'same-origin' }).then(r => (r.ok ? r.json() : { activities: [] })),
        fetch(`/api/crm/offers?leadId=${lead.id}`, { credentials: 'same-origin' }).then(r => (r.ok ? r.json() : { offers: [] })),
      ]);
      setActivities(a.activities || []);
      setOffers(o.offers || []);
    } finally {
      setLoading(false);
    }
  }, [lead.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ type, body: text }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Błąd zapisu'); }
      setText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-900/50 backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        className="flex w-full flex-col overflow-hidden bg-white shadow-2xl md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-primary-600 to-primary-500 px-5 py-4 text-white">
          <div className="flex items-start gap-3 min-w-0">
            <MessageSquare size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold leading-tight truncate">Aktywności klienta · {lead.name}</h3>
              <p className="text-[11px] text-white/70 leading-tight">Pełna historia: notatki, telefony, maile, spotkania · Dane bezpieczne i audytowalne</p>
            </div>
          </div>
          <button onClick={onClose} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-white/15 transition-colors">
            <X size={16} /> <span className="hidden sm:inline">Zamknij</span>
          </button>
        </div>

        {/* Body — grid responsywny: oś czasu (lewa, 2 kol) + prawy pasek (dodaj + oferty) */}
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-y-auto bg-slate-50 p-4 lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">

          {/* Dodaj aktywność — mobile: góra; desktop: prawa-góra */}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:col-start-3 lg:row-start-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Dodaj aktywność</p>
            <select
              value={type}
              onChange={e => setType(e.target.value as ActType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {ADD_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
            </select>
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, 5000))}
              rows={4}
              placeholder="Opis aktywności (treść notatki, przebieg rozmowy, podsumowanie maila…)"
              className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{text.length} / 5000</span>
              <button
                onClick={save}
                disabled={saving || !text.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Zapisz aktywność
              </button>
            </div>
          </div>

          {/* Oś czasu — mobile: środek; desktop: lewa, pełna wysokość */}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-2 lg:overflow-y-auto">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Historia ({activities.length})</p>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
            ) : activities.length === 0 ? (
              <p className="py-10 text-center text-sm italic text-slate-300">Brak aktywności — dodaj pierwszą po prawej.</p>
            ) : (
              <ol className="relative space-y-3 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-slate-100">
                {activities.map(a => {
                  const m = TYPE_META[a.type] ?? TYPE_META.SYSTEM;
                  return (
                    <li key={a.id} className="relative pl-6">
                      <span className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${a.is_system ? 'bg-slate-300' : 'bg-primary-400'}`} />
                      <div className={`rounded-xl p-3 ring-1 ${a.is_system ? 'bg-slate-50 ring-slate-100' : 'bg-white ring-slate-200'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${m.cls}`}>
                            {m.icon} {m.label}
                          </span>
                          <span className="text-[11px] text-slate-400">{fmtDateTime(a.created_at)}</span>
                        </div>
                        <p className={`mt-1.5 whitespace-pre-wrap text-sm ${a.is_system ? 'text-slate-500' : 'text-slate-800'}`}>{a.body}</p>
                        {a.author_name && <p className="mt-1 text-[11px] text-slate-400">— {a.author_name}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Oferty PDF — mobile: dół; desktop: prawa-dół */}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:col-start-3 lg:row-start-2 lg:overflow-y-auto">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Oferty PDF klienta ({offers.length})</p>
            {offers.length === 0 ? (
              <p className="py-4 text-center text-xs italic text-slate-300">Brak ofert — wygeneruj w Kalkulatorze</p>
            ) : (
              <div className="space-y-2">
                {offers.map(o => (
                  <div key={o.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">PDF</span>
                      <span className="flex-1 text-xs font-semibold text-slate-700">{fmtDateTime(o.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Oszczędność {money(o.total_savings_monthly)}/mies · {o.employees_count ?? '—'} prac.</p>
                    {o.pdf_url && (
                      <div className="mt-2 flex gap-2">
                        <a href={o.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-primary-600 ring-1 ring-slate-200 hover:bg-slate-50">
                          <ExternalLink size={12} /> Otwórz
                        </a>
                        <a href={o.pdf_url} download className="flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-primary-700">
                          <Download size={12} /> Pobierz
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
