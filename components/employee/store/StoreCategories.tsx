'use client';
import React from 'react';
import { HeartPulse, ShieldCheck, Landmark, GraduationCap, Users, Sparkles, LayoutGrid, type LucideIcon } from 'lucide-react';
import { BENEFIT_CATEGORIES, type CategoryFilter } from '@/lib/benefits/catalog';
import type { BenefitCategory } from '@/types/enums';

export const CATEGORY_ICONS: Record<string, LucideIcon> = { HeartPulse, ShieldCheck, Landmark, GraduationCap, Users, Sparkles };

interface Props {
  value: CategoryFilter;
  counts: { total: number; byCategory: Record<BenefitCategory, number> };
  onChange: (c: CategoryFilter) => void;
  balance: number;
  variant: 'sidebar' | 'chips';
}

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2';

export function StoreCategories({ value, counts, onChange, balance, variant }: Props) {
  const entries: { id: CategoryFilter; label: string; icon: LucideIcon; count: number }[] = [
    { id: 'ALL', label: 'Wszystkie', icon: LayoutGrid, count: counts.total },
    ...BENEFIT_CATEGORIES.map(c => ({ id: c.id as CategoryFilter, label: c.label, icon: CATEGORY_ICONS[c.icon] ?? Sparkles, count: counts.byCategory[c.id] })),
  ];

  if (variant === 'chips') {
    return (
      <nav aria-label="Kategorie" className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 -mx-4 snap-x">
        {entries.map(e => (
          <button key={e.id} onClick={() => onChange(e.id)} aria-pressed={value === e.id}
            className={`snap-start shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium border transition ${FOCUS_RING} ${value === e.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}>
            <e.icon size={15} /> {e.label} <span className={`text-xs ${value === e.id ? 'text-white/70' : 'text-slate-400'}`}>{e.count}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col gap-1 sticky top-20 self-start" aria-label="Kategorie">
      {entries.map(e => (
        <button key={e.id} onClick={() => onChange(e.id)} aria-current={value === e.id ? 'page' : undefined}
          className={`flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition ${FOCUS_RING} ${value === e.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
          <e.icon size={18} className={value === e.id ? 'text-primary-300' : 'text-slate-400'} />
          <span className="flex-1 text-left">{e.label}</span>
          <span className={`text-xs tabular-nums ${value === e.id ? 'text-white/70' : 'text-slate-400'}`}>{e.count}</span>
        </button>
      ))}
      <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
        <p className="text-xs uppercase tracking-wider text-white/60">Twoje saldo</p>
        <p className="text-2xl font-black mt-1">{balance} <span className="text-base font-semibold text-white/70">pkt</span></p>
        <p className="text-xs text-white/50 mt-1">1 pkt = 1 zł</p>
      </div>
    </aside>
  );
}
