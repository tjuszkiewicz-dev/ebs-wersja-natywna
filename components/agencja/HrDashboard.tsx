'use client';

import React, { useState, useEffect } from 'react';
import { Building2, FolderOpen, BarChart3, Wallet, BedDouble, Archive, Hourglass, LayoutDashboard, Bus, HardHat, Stamp } from 'lucide-react';
import { HrPoczekalnia } from './HrPoczekalnia';
import { HrKontrakty } from './HrKontrakty';
import { HrDokumenty } from './HrDokumenty';
import { HrArchiwum } from './HrArchiwum';
import { HrPulpit } from './HrPulpit';
import { HrRozliczenia } from './HrRozliczenia';
import { HrBazaNoclegowa } from './HrBazaNoclegowa';
// HrRaporty, HrDowoz, HrBhp, HrLegalizacja nie zostały jeszcze przeniesione
// do EBS (E2b) — taby zostają, renderują placeholder. T9 podmienia.

type HrTab = 'pulpit' | 'poczekalnia' | 'kontrakty' | 'dokumenty' | 'raporty' | 'rozliczenia' | 'noclegi' | 'dowoz' | 'bhp' | 'legalizacja' | 'archiwum';

const TABS: { id: HrTab; label: string; icon: React.ReactNode; perm: string }[] = [
  { id: 'pulpit',      label: 'Pulpit',                  icon: <LayoutDashboard size={16} />, perm: 'agencja.pulpit' },
  { id: 'poczekalnia', label: 'Poczekalnia',             icon: <Hourglass size={16} />, perm: 'agencja.poczekalnia' },
  { id: 'kontrakty',   label: 'Kontrakty',               icon: <Building2 size={16} />, perm: 'agencja.kontrakty' },
  { id: 'dokumenty',   label: 'Dokumenty',               icon: <FolderOpen size={16} />, perm: 'agencja.dokumenty' },
  { id: 'raporty',     label: 'Raporty',                 icon: <BarChart3 size={16} />, perm: 'agencja.raporty' },
  { id: 'rozliczenia', label: 'Rozliczenia pracowników', icon: <Wallet size={16} />, perm: 'agencja.rozliczenia' },
  { id: 'noclegi',     label: 'Baza Noclegowa',          icon: <BedDouble size={16} />, perm: 'agencja.noclegi' },
  { id: 'dowoz',       label: 'Plan dowozu',             icon: <Bus size={16} />, perm: 'agencja.dowoz' },
  { id: 'bhp',         label: 'Magazyn BHP',             icon: <HardHat size={16} />, perm: 'agencja.bhp' },
  { id: 'legalizacja', label: 'Legalizacja',             icon: <Stamp size={16} />, perm: 'agencja.legalizacja' },
  { id: 'archiwum',    label: 'Archiwum',                icon: <Archive size={16} />, perm: 'agencja.archiwum' },
];

export const HrDashboard: React.FC = () => {
  const [tab, setTab] = useState<HrTab>('pulpit');
  const [perms, setPerms] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch('/api/me/permissions', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        const set = new Set<string>(d.permissions || []);
        setPerms(set);
        setTab(t => {
          const visible = TABS.filter(x => set.has(x.perm));
          return visible.some(x => x.id === t) ? t : (visible[0]?.id ?? t);
        });
      })
      .catch(() => {});
  }, []);

  const visibleTabs = perms ? TABS.filter(t => perms.has(t.perm)) : TABS;

  return (
    <div>
      {/* Taby agencji — filtrowane wg uprawnień roli (Ustawienia → Uprawnienia) */}
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-slate-200">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pulpit'      && <HrPulpit />}
      {tab === 'poczekalnia' && <HrPoczekalnia />}
      {tab === 'kontrakty'   && <HrKontrakty onGoToNoclegi={() => setTab('noclegi')} />}
      {tab === 'dokumenty'   && <HrDokumenty />}
      {tab === 'raporty'     && <div className="p-6 text-slate-400">Wkrótce (E2b)</div> /* T9 podmienia */}
      {tab === 'rozliczenia' && <HrRozliczenia />}
      {tab === 'noclegi'     && <HrBazaNoclegowa />}
      {tab === 'dowoz'       && <div className="p-6 text-slate-400">Wkrótce (E2b)</div> /* T9 podmienia */}
      {tab === 'bhp'         && <div className="p-6 text-slate-400">Wkrótce (E2b)</div> /* T9 podmienia */}
      {tab === 'legalizacja' && <div className="p-6 text-slate-400">Wkrótce (E2b)</div> /* T9 podmienia */}
      {tab === 'archiwum'    && <HrArchiwum />}
    </div>
  );
};
