'use client';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { ServiceItem } from '@/types';
import { resolveAction, type CategoryDef, type StoreAction } from '@/lib/benefits/catalog';
import { CATEGORY_ICONS } from './StoreCategories';

export function badgeFor(action: StoreAction, item: ServiceItem, balance: number): { text: string; tone: 'price' | 'inquire' | 'open' | 'muted' } {
  switch (action) {
    case 'open':         return { text: 'Otwórz', tone: 'open' };
    case 'inquire':      return { text: 'Zapytaj o ofertę', tone: 'inquire' };
    case 'insufficient': return { text: `Brakuje ${item.price - balance} pkt`, tone: 'muted' };
    default:             return { text: `${item.price} pkt`, tone: 'price' };
  }
}

// Tony odznak na zdjęciach — kontrast liczony wg WCAG AA (4.5:1; 12px bold NIE kwalifikuje się
// jako "duży tekst", więc próg 3:1 tu nie wystarczy). `open` z kodu bazowego brifu
// (bg-emerald-500 text-white) dawał ~2.5:1 — podbite do primary-700/white (~5.5:1). Reszta
// tonów zmierzona i już zgodna: price ~15:1, inquire (amber-100/900) ~11:1, muted ~6,1:1.
const TONE: Record<string, string> = {
  price:   'bg-white/95 text-slate-900',
  inquire: 'bg-amber-100 text-amber-900',
  open:    'bg-primary-700 text-white',
  muted:   'bg-slate-200 text-slate-600',
};

function StoreTile({ item, action, balance, onSelect }: { item: ServiceItem; action: StoreAction; balance: number; onSelect: (i: ServiceItem) => void }) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const badge = badgeFor(action, item, balance);

  // `onError` sam nie wystarczy: przy SSR (App Router) obrazek, który pada błyskawicznie
  // (np. martwy URL w katalogu — zweryfikowane: 2 pozycje w mockData.ts dają 404), potrafi
  // dokończyć ładowanie zanim React zdąży podpiąć listenery przy hydracji — zdarzenie się
  // wtedy gubi i kafelek zostaje z natywną, "połamaną" ikonką przeglądarki zamiast placeholdera.
  // Dlatego przy montowaniu dobijamy sprawdzeniem `complete && naturalWidth === 0`
  // (tak przeglądarka znakuje już zakończone, nieudane ładowanie). `useLayoutEffect`, nie
  // `useEffect` (poprawka Task 11a) — odpala się synchronicznie przed pierwszym malowaniem,
  // więc połamana natywna ikonka nie zdąży mignąć nawet na jedną klatkę przed fallbackiem.
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);

  return (
    <button onClick={() => onSelect(item)} className="group text-left rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm transition hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2">
      <div className="relative aspect-[4/3] bg-slate-100">
        {item.image && !broken
          ? <img ref={imgRef} src={item.image} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center text-slate-300"><ImageOff size={28} /></div>}
        <span className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold shadow-sm ${TONE[badge.tone]}`}>{badge.text}</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{item.name}</p>
        {item.partner && <p className="text-xs text-slate-500 mt-1">{item.partner}</p>}
      </div>
    </button>
  );
}

interface Props {
  groups: { category: CategoryDef; items: ServiceItem[] }[];
  ownedIds: ReadonlySet<string>;
  balance: number;
  onSelect: (item: ServiceItem) => void;
  query: string;
  onClearQuery: () => void;
}

export function StoreGrid({ groups, ownedIds, balance, onSelect, query, onClearQuery }: Props) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600">Nic nie znaleźliśmy dla „{query}".</p>
        <button onClick={onClearQuery} className="mt-4 px-4 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2">Wyczyść</button>
      </div>
    );
  }
  return (
    <div className="space-y-10">
      {groups.map(({ category, items }) => {
        const Icon = CATEGORY_ICONS[category.icon];
        return (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-center gap-3">
                {Icon && <span className="w-9 h-9 rounded-xl bg-slate-900 text-primary-300 flex items-center justify-center"><Icon size={18} /></span>}
                <div>
                  <h2 id={`cat-${category.id}`} className="text-lg font-bold tracking-tight text-slate-900">{category.label}</h2>
                  <p className="text-xs text-slate-500">{category.description}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 tabular-nums">{items.length}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(item => (
                <StoreTile key={item.id} item={item} action={resolveAction(item, ownedIds, balance)} balance={balance} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
