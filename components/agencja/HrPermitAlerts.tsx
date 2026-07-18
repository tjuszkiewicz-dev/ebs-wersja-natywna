'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { expiryStatus, TONE_BADGE, fmtDate, schengenDeadline, type ExpiryStatus } from './expiry';
import type { Employee } from './HrEmployeePanel';
import { fullName } from '@/lib/hr/docPlaceholders';

type Kind = 'expiry' | 'zus' | 'pesel' | 'lease';
interface Item { key: string; title: string; type: string; date?: string | null; st?: ExpiryStatus; kind: Kind; sortKey: number; onClick?: () => void }

// Jedna rozwijana lista wszystkich alertów na głównym widoku (Kontrakty):
// karta pobytu / pozwolenie / wiza (≤60 dni lub wygasłe) + brak ZUS + brak PESEL
// + kończący się najem bazy noclegowej (≤3 dni lub wygasł). 5 najpilniejszych
// widocznych, reszta po rozwinięciu. Klik: pracownik → panel; nocleg → zakładka Baza.
export function HrPermitAlerts({ onOpen, onOpenAccommodation, refreshKey }: {
  onOpen?: (e: Employee) => void; onOpenAccommodation?: () => void; refreshKey?: number;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [re, ra] = await Promise.all([
          fetch('/api/hr/employees', { credentials: 'same-origin' }),
          fetch('/api/hr/accommodations', { credentials: 'same-origin' }),
        ]);
        const de = await re.json();
        const da = ra.ok ? await ra.json() : { accommodations: [] };
        const out: Item[] = [];
        for (const e of (de.employees || []) as Employee[]) {
          if (e.status !== 'active') continue;
          const name = fullName(e);
          for (const c of [
            { type: 'Paszport', date: e.passport_expiry },
            { type: 'Karta pobytu', date: e.residence_card_expiry },
            { type: 'Pozwolenie na pracę', date: e.work_permit_expiry },
            { type: 'Wiza', date: e.visa_expiry },
          ]) {
            const st = expiryStatus(c.date);
            if (st && st.days <= 60) out.push({ key: `${e.id}-${c.type}`, title: name, type: c.type, date: c.date, st, kind: 'expiry', sortKey: st.days, onClick: () => onOpen?.(e) });
          }
          // Schengen: 90 dni od wjazdu na złożenie wniosku o kartę pobytu — alert gdy ≤30 dni do końca
          const schSt = expiryStatus(schengenDeadline(e.schengen_entry_date));
          if (schSt && schSt.days <= 30) out.push({ key: `${e.id}-schengen`, title: name, type: 'Karta pobytu — 90 dni od wjazdu Schengen', date: schengenDeadline(e.schengen_entry_date), st: schSt, kind: 'expiry', sortKey: schSt.days - 0.3, onClick: () => onOpen?.(e) });
          if (!e.zus_registration_date) out.push({ key: `${e.id}-zus`, title: name, type: 'Zgłoszenie do ZUS', kind: 'zus', sortKey: 500, onClick: () => onOpen?.(e) });
          if (!e.pesel) out.push({ key: `${e.id}-pesel`, title: name, type: 'Numer PESEL', kind: 'pesel', sortKey: 600, onClick: () => onOpen?.(e) });
        }
        for (const a of (da.accommodations || []) as any[]) {
          const st = expiryStatus(a.lease_end_date);
          if (st && st.days <= 3) out.push({ key: `${a.id}-lease`, title: a.name, type: `Koniec najmu · ${a.assigned_count} prac.`, date: a.lease_end_date, st, kind: 'lease', sortKey: st.days - 0.5, onClick: onOpenAccommodation });
        }
        out.sort((x, y) => x.sortKey - y.sortKey || x.title.localeCompare(y.title, 'pl'));
        setItems(out);
      } catch { /* */ }
    })();
  }, [refreshKey]);

  if (!items.length) return null;

  const expired = items.filter(i => i.kind === 'expiry' && i.st?.tone === 'expired').length;
  const soon = items.filter(i => i.kind === 'expiry' && i.st?.tone === 'soon').length;
  const lease = items.filter(i => i.kind === 'lease').length;
  const zus = items.filter(i => i.kind === 'zus').length;
  const pesel = items.filter(i => i.kind === 'pesel').length;
  const visible = expanded ? items : items.slice(0, 5);

  const badge = (i: Item) => {
    if (i.st) return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[i.st.tone]}`}>{i.st.label}</span>;
    return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{i.kind === 'zus' ? 'niezgłoszony' : 'brak'}</span>;
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-amber-800">
        <AlertTriangle size={18} />
        <p className="font-semibold">Dokumenty wymagające uwagi ({items.length})</p>
        {expired > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{expired} wygasłe</span>}
        {soon > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{soon} ≤30 dni</span>}
        {lease > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{lease} koniec najmu</span>}
        {zus > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{zus} bez ZUS</span>}
        {pesel > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{pesel} bez PESEL</span>}
      </div>

      <div className="space-y-1.5">
        {visible.map(i => (
          <button key={i.key} onClick={i.onClick} className="flex w-full items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-left text-sm hover:bg-white">
            <span className="font-medium text-slate-700">{i.title}</span>
            <span className="hidden text-slate-400 sm:inline">· {i.type}{i.date ? ` · do ${fmtDate(i.date)}` : ''}</span>
            <span className="text-slate-400 sm:hidden">· {i.type}</span>
            {badge(i)}
            <ChevronRight size={14} className="shrink-0 text-slate-300" />
          </button>
        ))}
      </div>

      {items.length > 5 && (
        <button onClick={() => setExpanded(v => !v)} className="mt-2 flex items-center gap-1 px-1 text-xs font-semibold text-amber-800 hover:underline">
          <ChevronDown size={14} className={`transition ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Zwiń' : `Pokaż wszystkie (${items.length})`}
        </button>
      )}
    </div>
  );
}
