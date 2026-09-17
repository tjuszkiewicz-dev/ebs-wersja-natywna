'use client';
// Lewa kolumna portalu pracownika w trybie „sklep jako ekran startowy" (STORE_IS_HOME) — od 17.09.2026
// ZASTĘPUJE ciemne zwijane menu (`Sidebar`) decyzją właściciela („zastąp zwijane menu nowym layoutem").
// Zawartość = kolumna kategorii sklepu (kategorie z licznikami + karta salda) plus to, co z dawnego menu
// musi zostać: Aktywne usługi, Historia, Centrum Pomocy. Tokeny 1:1 ze sklepu (StoreCategories:
// wiersz `NAV_ROW`, aktywny = `bg-slate-900`, jeden akcent `primary-*`, `rounded-xl`/`rounded-2xl`).
// Tylko md+: na telefonie kategorie są chipsami w sklepie, a resztę obsługuje dolny pasek.
import React, { useMemo } from 'react';
import { ShoppingBag, ShieldCheck, History, HelpCircle, type LucideIcon } from 'lucide-react';
import type { ServiceItem } from '@/types';
import { countByCategory, filterCatalog, type CategoryFilter } from '@/lib/benefits/catalog';
import { STORE_TITLE } from '@/lib/benefits/constants';
import { CategoryList, BalanceCard, NAV_ROW, NAV_ROW_ACTIVE, NAV_ROW_IDLE } from './store/StoreCategories';

const ACCOUNT_LINKS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'emp-active-services', label: 'Aktywne usługi', icon: ShieldCheck },
  { id: 'emp-history',         label: 'Historia',        icon: History },
  { id: 'emp-support',         label: 'Centrum Pomocy',  icon: HelpCircle },
];

/** Widoki, przy których siatka sklepu NIE jest na ekranie — wtedy kategoria nie świeci. */
const NON_STORE_VIEWS = new Set(ACCOUNT_LINKS.map(l => l.id));

interface Props {
  services: ServiceItem[];
  balance: number;
  category: CategoryFilter;
  query: string;
  onCategory: (c: CategoryFilter) => void;
  currentView: string;
  onChangeView: (view: string) => void;
}

export function EmployeeNav({ services, balance, category, query, onCategory, currentView, onChangeView }: Props) {
  const counts = useMemo(() => countByCategory(filterCatalog(services, { query })), [services, query]);
  const onStore = !NON_STORE_VIEWS.has(currentView);

  return (
    <aside
      aria-label="Nawigacja portalu"
      className="hidden md:flex w-72 shrink-0 flex-col h-screen sticky top-0 z-20 bg-white border-r border-slate-200 text-slate-900"
    >
      {/* Nagłówek kolumny — wysokość jak czarny nagłówek portalu (md:h-20), żeby linie się spotykały. */}
      <div className="h-16 md:h-20 shrink-0 flex items-center gap-3 px-5 border-b border-slate-200">
        <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
          <ShoppingBag size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-tight tracking-tight truncate">{STORE_TITLE}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Eliton Benefits</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Kategorie</p>
        <CategoryList value={category} counts={counts} onChange={onCategory} active={onStore} />

        <div className="mt-6">
          <BalanceCard balance={balance} />
        </div>

        <p className="px-3 mt-6 mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Twoje konto</p>
        <div className="flex flex-col gap-1">
          {ACCOUNT_LINKS.map(l => {
            const on = currentView === l.id;
            return (
              <button key={l.id} onClick={() => onChangeView(l.id)} aria-current={on ? 'page' : undefined}
                className={`${NAV_ROW} ${on ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}>
                <l.icon size={18} className={on ? 'text-primary-300' : 'text-slate-400'} />
                <span className="flex-1 text-left">{l.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 px-5 py-3 border-t border-slate-200">
        <p className="text-[10px] text-slate-400">Wersja EBS 1.1.0</p>
      </div>
    </aside>
  );
}
