'use client';
// Sklep benefitów v2 — pełnoekranowa nakładka (spec 2026-09-15 §5).
//
// Kierunek wizualny (Step 1, reguła nadrzędna "nigdy nie projektuj z głowy"):
// - /ui-ux-pro-max: `search.py --design-system "sklep benefitow pracowniczych..."` zwrócił
//   ogólny system SaaS/Glassmorphism (akcent #2563EB) — ODRZUCONY: łamie zasadę jednego akcentu
//   i markę EBS (primary-* zielony jest już przyjęty w całej apce). Trafniejsze dopasowania:
//   `--domain product "marketplace app gallery product grid catalog"` (Marketplace P2P: category
//   colors + success green) i `--domain style "light minimal card grid sidebar navigation flat"`
//   → styl "Bento Grids" (promienie 16–24px, tło zbliżone do slate-50, białe karty, hover
//   scale/soft-shadow, Apple-style content-first) — potwierdza kierunek z brifu (siatka jak
//   21st.dev Immich gallery).
// - /design-taste-frontend: ta powierzchnia to katalog produktowy (app-gallery), nie landing —
//   reguły dot. hero/copy/eyebrow pominięte (poza zakresem, skill §13 wyłącza "dense product
//   UI"). Zastosowane: Shape Consistency Lock, Color Consistency Lock (jeden akcent), Button/
//   Form Contrast Check, wymóg reduced-motion, focus-visible, realne zdjęcia (katalog już stoi
//   na Unsplash — zero placeholder-slopu).
// - MotionSites i 21st.dev (MCP): niedostępne w tej sesji (wymagają jednorazowego OAuth,
//   nieautoryzowane) — pominięte zgodnie z instrukcją, reszta zestawu użyta.
//
// Wybrane tokeny:
// - Paleta: tło `slate-50`, karty `white`, obwódki `slate-200`, tekst `slate-900`/`slate-500`,
//   jeden akcent = `primary-*` EBS (zieleń marki, tailwind.config.js). Bez `secondary-*` (indigo).
// - Typografia: `font-sans` (DM Sans, bez zmian globalnych); nagłówki sekcji
//   `text-lg font-bold tracking-tight`; tytuły kafelków `text-sm font-semibold`.
// - Promienie (jedna reguła, konsekwentnie w całym sklepie): `rounded-2xl` kontenery/karty/
//   kafelki/panel salda, `rounded-xl` inputy/przyciski prostokątne, `rounded-full` pigułki/ikony.
// - Cień/elevacja: spoczynek `shadow-sm`, hover `shadow-md` + `-translate-y-0.5`.
// - Ruch: tylko wejście nakładki (opacity), spięte z `useReducedMotion` (`motion/react`) —
//   przy "reduced motion" nakładka pojawia się bez animacji. Hover/focus na kafelkach i
//   przyciskach to zwykłe przejścia CSS (poza zakresem wymogu — dotyczy "overlay/panel").
// - Poprawka kontrastu względem kodu bazowego brifu: odznaka `open` (`bg-emerald-500
//   text-white`) dawała ~2,5:1 (WCAG AA dla tekstu 12px bold wymaga 4,5:1) — podbita do
//   `bg-primary-700 text-white` (~5,5:1); szczegóły przy `TONE` w StoreGrid.tsx.
// - Dodane `focus-visible` na klikalnych elementach, które go nie miały w kodzie z brifu
//   (przycisk zamknięcia, kategorie, "Wyczyść") — ujednolicone z kafelkami i polem szukania.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { ServiceItem, Transaction, PurchaseResult } from '@/types';
import type { BenefitCategory } from '@/types/enums';
import { filterCatalog, groupByCategory, countByCategory, resolveAction, type CategoryFilter, type EmployeeAppTab } from '@/lib/benefits/catalog';
import { StoreHeader } from './StoreHeader';
import { StoreCategories } from './StoreCategories';
import { StoreGrid } from './StoreGrid';
import { StoreDetail } from './StoreDetail';

export interface BenefitStoreProps {
  services: ServiceItem[];
  transactions: Transaction[];
  balance: number;
  userEmail?: string;
  canTransact: boolean;
  initialCategory?: BenefitCategory | null;
  onPurchase: (item: ServiceItem) => Promise<PurchaseResult>;
  onOpenApp: (tab: EmployeeAppTab) => void;
  onExit: () => void;
}

export function BenefitStore({ services, transactions, balance, userEmail, canTransact, initialCategory, onPurchase, onOpenApp, onExit }: BenefitStoreProps) {
  const [category, setCategory] = useState<CategoryFilter>(initialCategory ?? 'ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ServiceItem | null>(null);
  const reduceMotion = useReducedMotion();

  // Portal do document.body: ten komponent jest montowany wewnątrz prawej kolumny
  // EmployeeDashboardClient ("flex-1 flex flex-col … relative z-10"), która tworzy własny
  // kontekst warstwowania — z-[100] poniżej liczyłby się tylko WEWNĄTRZ niego, więc Sidebar
  // (fixed, z-50, poza tą kolumną) i tak zasłaniał lewy pasek kategorii sklepu. Ta sama
  // pułapka co przy komunikatorze w E6a. `mounted` unika niezgodności SSR/klienta (document
  // nie istnieje na serwerze).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ownedIds = useMemo(() => new Set(transactions.map(t => t.serviceId).filter((x): x is string => !!x)), [transactions]);
  const counts = useMemo(() => countByCategory(filterCatalog(services, { query })), [services, query]);
  const groups = useMemo(() => groupByCategory(filterCatalog(services, { category, query })), [services, category, query]);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
      className="fixed inset-0 z-[100] bg-slate-50 text-slate-900 overflow-y-auto" role="dialog" aria-label="Sklep benefitów">
      <StoreHeader query={query} onQuery={setQuery} balance={balance} onExit={onExit} />
      <div className="md:hidden px-4">
        <StoreCategories variant="chips" value={category} counts={counts} onChange={setCategory} balance={balance} />
      </div>
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 flex gap-8">
        <StoreCategories variant="sidebar" value={category} counts={counts} onChange={setCategory} balance={balance} />
        <main className="flex-1 min-w-0">
          <StoreGrid groups={groups} ownedIds={ownedIds} balance={balance} onSelect={setSelected} query={query} onClearQuery={() => setQuery('')} />
        </main>
      </div>
      <AnimatePresence>
        {selected && (
          <StoreDetail key={selected.id} item={selected} action={resolveAction(selected, ownedIds, balance)}
            balance={balance} canTransact={canTransact} userEmail={userEmail}
            onClose={() => setSelected(null)} onPurchase={onPurchase} onOpenApp={onOpenApp} />
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}
