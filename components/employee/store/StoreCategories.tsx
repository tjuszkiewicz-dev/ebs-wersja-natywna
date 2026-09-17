'use client';
import React from 'react';
import { HeartPulse, ShieldCheck, Landmark, GraduationCap, Users, Sparkles, LayoutGrid, type LucideIcon } from 'lucide-react';
import { BENEFIT_CATEGORIES, type CategoryFilter } from '@/lib/benefits/catalog';
import type { BenefitCategory } from '@/types/enums';

export const CATEGORY_ICONS: Record<string, LucideIcon> = { HeartPulse, ShieldCheck, Landmark, GraduationCap, Users, Sparkles };

export interface CategoryCounts { total: number; byCategory: Record<BenefitCategory, number> }

interface Props {
  value: CategoryFilter;
  counts: CategoryCounts;
  onChange: (c: CategoryFilter) => void;
  balance: number;
  variant: 'sidebar' | 'chips';
}

export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2';

/** Wiersz nawigacji w stylu sklepu — ten sam token dla kategorii i pozycji konta w EmployeeNav. */
export const NAV_ROW = `flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition ${FOCUS_RING}`;
export const NAV_ROW_ACTIVE = 'bg-slate-900 text-white';
export const NAV_ROW_IDLE = 'text-slate-700 hover:bg-slate-100';

function entriesFor(counts: CategoryCounts) {
  return [
    { id: 'ALL' as CategoryFilter, label: 'Wszystkie', icon: LayoutGrid, count: counts.total },
    ...BENEFIT_CATEGORIES.map(c => ({ id: c.id as CategoryFilter, label: c.label, icon: CATEGORY_ICONS[c.icon] ?? Sparkles, count: counts.byCategory[c.id] })),
  ];
}

/**
 * Pionowa lista kategorii (md+). `active=false` = kategoria jest zapamiętana, ale użytkownik ogląda
 * inny ekran (Historia/Pomoc) — wtedy nic nie podświetlamy, żeby nie sugerować, że siatka jest widoczna.
 */
export function CategoryList({ value, counts, onChange, active = true }: { value: CategoryFilter; counts: CategoryCounts; onChange: (c: CategoryFilter) => void; active?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      {entriesFor(counts).map(e => {
        const on = active && value === e.id;
        return (
          <button key={e.id} onClick={() => onChange(e.id)} aria-current={on ? 'page' : undefined}
            className={`${NAV_ROW} ${on ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}>
            <e.icon size={18} className={on ? 'text-primary-300' : 'text-slate-400'} />
            <span className="flex-1 text-left">{e.label}</span>
            <span className={`text-xs tabular-nums ${on ? 'text-white/70' : 'text-slate-400'}`}>{e.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function BalanceCard({ balance }: { balance: number }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <p className="text-xs uppercase tracking-wider text-white/60">Twoje saldo</p>
      <p className="text-2xl font-black mt-1">{balance} <span className="text-base font-semibold text-white/70">pkt</span></p>
      <p className="text-xs text-white/50 mt-1">1 pkt = 1 zł</p>
    </div>
  );
}

export function StoreCategories({ value, counts, onChange, balance, variant }: Props) {
  if (variant === 'chips') {
    return (
      <nav aria-label="Kategorie" className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 -mx-4 snap-x">
        {entriesFor(counts).map(e => (
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
      <CategoryList value={value} counts={counts} onChange={onChange} />
      <div className="mt-6">
        <BalanceCard balance={balance} />
      </div>
    </aside>
  );
}
