'use client';
// Stan nawigacji sklepu (kategoria + szukajka) wyniesiony do powłoki portalu — od 17.09.2026
// lewa kolumna sklepu (kategorie + saldo) zastępuje dawne zwijane menu pracownika i jest renderowana
// przez EmployeeDashboardClient obok <main>, a siatka sklepu żyje wewnątrz DashboardEmployee.
// Jedno miejsce prawdy dla obu; bez providera (tryb EMPLOYEE_HOME='wallet', nakładka) BenefitStore
// trzyma stan lokalnie.
import { createContext, useContext } from 'react';
import type { CategoryFilter } from '@/lib/benefits/catalog';

export interface StoreNavState {
  category: CategoryFilter;
  setCategory: (c: CategoryFilter) => void;
  query: string;
  setQuery: (q: string) => void;
}

export const StoreNavContext = createContext<StoreNavState | null>(null);

export function useStoreNav(): StoreNavState | null {
  return useContext(StoreNavContext);
}
