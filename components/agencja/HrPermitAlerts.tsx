'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ChevronRight, ChevronDown, Filter, Download } from 'lucide-react';
import { fmtDate } from './expiry';
import type { Employee } from './HrEmployeePanel';
import { buildAlerts, filterAlerts, groupOf, ALERT_GROUPS, type AlertItem } from '@/lib/hr/alerts';

// Kolory badge per grupa (ALERT_GROUPS id → klasy Tailwind). `expired`/`soon`/`warn`
// pokrywają się kolorystycznie z dawnym TONE_BADGE (czerwień/róż/bursztyn), reszta
// grup (rodzaj alarmu, nie pilność) ma spójny bursztynowy odcień jak wcześniej.
const GROUP_BADGE: Record<string, string> = {
  expired: 'bg-red-100 text-red-700',
  soon: 'bg-rose-50 text-rose-700',
  warn: 'bg-amber-50 text-amber-700',
  medical: 'bg-amber-50 text-amber-800',
  fleet: 'bg-sky-50 text-sky-700',
  lease: 'bg-red-100 text-red-700',
  zus: 'bg-amber-100 text-amber-800',
  pesel: 'bg-amber-100 text-amber-800',
};

const ALL_GROUP_IDS = ALERT_GROUPS.map((g) => g.id);

// Jedna rozwijana lista wszystkich alarmów agencji (dokumenty legalizacyjne,
// TLC, badania lekarskie, flota, koniec najmu, brak ZUS/PESEL) — liczona przez
// wspólny moduł `lib/hr/alerts` (dokładnie ta sama logika co raport PDF).
// Pasek filtrów: grupy (ALERT_GROUPS), kontrakt, szukanie, termin ≤ N dni.
// Klik na pozycję: pracownik → panel kartoteki; nocleg → zakładka Baza;
// FLOTA nie otwiera kartoteki pracownika (pojazdy mają własną zakładkę) —
// pozycje floty są nieklikalne.
export function HrPermitAlerts({ onOpen, onOpenAccommodation, refreshKey }: {
  onOpen?: (e: Employee) => void; onOpenAccommodation?: () => void; refreshKey?: number;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [groups, setGroups] = useState<string[]>(ALL_GROUP_IDS);
  const [contract, setContract] = useState('');
  const [search, setSearch] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [re, ra, rv] = await Promise.all([
          fetch('/api/hr/employees', { credentials: 'same-origin' }),
          fetch('/api/hr/accommodations', { credentials: 'same-origin' }),
          fetch('/api/hr/vehicles', { credentials: 'same-origin' }),
        ]);
        const de = await re.json();
        const da = ra.ok ? await ra.json() : { accommodations: [] };
        const dv = rv.ok ? await rv.json() : [];
        const emps = (de.employees || []) as Employee[];
        setEmployees(emps);
        setAlerts(buildAlerts(emps, da.accommodations || [], Array.isArray(dv) ? dv : []));
      } catch { /* */ } finally { setLoaded(true); }
    })();
  }, [refreshKey]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const contracts = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) if (a.contract) set.add(a.contract);
    return [...set].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [alerts]);

  const filtered = useMemo(() => filterAlerts(alerts, {
    kinds: groups.length < ALL_GROUP_IDS.length ? groups : undefined,
    contract: contract || undefined,
    search: search || undefined,
    maxDays: maxDays.trim() !== '' ? Number(maxDays) : undefined,
  }), [alerts, groups, contract, search, maxDays]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/hr/alerts/pdf', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kinds: groups.length < ALL_GROUP_IDS.length ? groups : undefined,
          contract: contract || undefined,
          search: search || undefined,
          maxDays: maxDays.trim() !== '' ? Number(maxDays) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Nie udało się wygenerować raportu');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alarmy-agencja-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Nie udało się pobrać raportu PDF.');
    } finally {
      setDownloading(false);
    }
  };

  if (!loaded) return null;

  if (!alerts.length) {
    return (
      <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
        Brak alarmów wymagających uwagi.
      </div>
    );
  }

  const toggleGroup = (id: string) => setGroups((cur) => (
    cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]
  ));

  const counts: Record<string, number> = {};
  for (const a of alerts) { const g = groupOf(a); counts[g] = (counts[g] || 0) + 1; }

  const visible = expanded ? filtered : filtered.slice(0, 5);

  const onItemClick = (item: AlertItem) => {
    if (item.kind === 'fleet') return; // flota ma własną zakładkę, nie otwieramy kartoteki pracownika
    if (item.kind === 'lease') { onOpenAccommodation?.(); return; }
    if (item.employeeId) { const e = employeeById.get(item.employeeId); if (e) onOpen?.(e); }
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-amber-800">
        <AlertTriangle size={18} />
        <p className="font-sans font-semibold">Alarmy wymagające uwagi ({filtered.length}{filtered.length !== alerts.length ? ` / ${alerts.length}` : ''})</p>
        {ALERT_GROUPS.filter((g) => counts[g.id]).map((g) => (
          <span key={g.id} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GROUP_BADGE[g.id] ?? 'bg-amber-100 text-amber-800'}`}>{counts[g.id]} {g.label.toLowerCase()}</span>
        ))}
        <button onClick={() => setShowFilters((v) => !v)} className="ml-auto flex items-center gap-1 rounded-full border border-amber-300 bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-white">
          <Filter size={12} /> Filtry
        </button>
        <button
          onClick={downloadPdf}
          disabled={downloading}
          className="flex items-center gap-1 rounded-full border border-amber-300 bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-white disabled:opacity-50"
        >
          <Download size={12} /> {downloading ? 'Generowanie…' : 'Pobierz raport PDF'}
        </button>
      </div>

      {showFilters && (
        <div className="mb-3 space-y-2 rounded-xl bg-white/70 p-3">
          <div className="flex flex-wrap gap-1.5">
            {ALERT_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition ${groups.includes(g.id) ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={contract} onChange={(e) => setContract(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700">
              <option value="">— wszystkie kontrakty —</option>
              {contracts.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj (osoba, dokument)…"
              className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            />
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              Termin ≤
              <input
                type="number"
                min={0}
                value={maxDays}
                onChange={(e) => setMaxDays(e.target.value)}
                placeholder="dni"
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
              />
              dni
            </label>
            {(groups.length < ALL_GROUP_IDS.length || contract || search || maxDays) && (
              <button
                onClick={() => { setGroups(ALL_GROUP_IDS); setContract(''); setSearch(''); setMaxDays(''); }}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:underline"
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        </div>
      )}

      {!filtered.length ? (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-500">Brak alarmów pasujących do wybranych filtrów.</p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((i) => {
            const clickable = i.kind !== 'fleet' && (i.kind === 'lease' ? !!onOpenAccommodation : !!i.employeeId);
            const Tag: any = clickable ? 'button' : 'div';
            return (
              <Tag key={i.id} onClick={clickable ? () => onItemClick(i) : undefined} className={`flex w-full items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-left text-sm ${clickable ? 'hover:bg-white' : ''}`}>
                <span className="font-medium text-slate-700">{i.person}</span>
                <span className="hidden text-slate-400 sm:inline">· {i.label}{i.date ? ` · do ${fmtDate(i.date)}` : ''}</span>
                <span className="text-slate-400 sm:hidden">· {i.label}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${GROUP_BADGE[groupOf(i)] ?? 'bg-amber-100 text-amber-800'}`}>
                  {i.days == null ? (i.kind === 'zus' ? 'niezgłoszony' : 'brak') : i.days < 0 ? `wygasła ${-i.days} dni temu` : i.days === 0 ? 'wygasa dziś' : `za ${i.days} dni`}
                </span>
                {clickable && <ChevronRight size={14} className="shrink-0 text-slate-300" />}
              </Tag>
            );
          })}
        </div>
      )}

      {filtered.length > 5 && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-2 flex items-center gap-1 px-1 text-xs font-semibold text-amber-800 hover:underline">
          <ChevronDown size={14} className={`transition ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Zwiń' : `Pokaż wszystkie (${filtered.length})`}
        </button>
      )}
    </div>
  );
}
