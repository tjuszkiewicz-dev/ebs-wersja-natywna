'use client';
import React from 'react';
import { Search, X, Wallet } from 'lucide-react';
import { STORE_TITLE } from '@/lib/benefits/constants';

interface Props {
  query: string;
  onQuery: (q: string) => void;
  balance: number;
  /** 'overlay' (domyślnie) — nakładka pełnoekranowa: logo + X; 'page' — sklep jako ekran startowy
   *  wewnątrz ramki portalu: logo i X ma nagłówek portalu, tytuł — lewa kolumna (EmployeeNav),
   *  więc tu zostaje sama szukajka (+ saldo na mobile). */
  variant?: 'overlay' | 'page';
  onExit?: () => void;
}

export function StoreHeader({ query, onQuery, balance, variant = 'overlay', onExit }: Props) {
  const page = variant === 'page';
  return (
    // Wariant 'page': od md w górę szukajkę ma nagłówek portalu (jedno pole), więc pasek sklepu
    // zostaje tylko na mobile (pole + saldo).
    <header className={`sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 ${page ? 'md:hidden' : ''}`}>
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center gap-3 md:gap-6">
        {!page && (
          <div className="flex items-center gap-2 shrink-0">
            <img src="/ebs-black.svg" alt="EBS" className="h-6 w-auto" />
            <span className="hidden sm:inline font-bold text-slate-900 tracking-tight">{STORE_TITLE}</span>
          </div>
        )}
        <label className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search" value={query} onChange={e => onQuery(e.target.value)}
            placeholder="Szukaj benefitu…" aria-label="Szukaj benefitu"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white"
          />
        </label>
        {/* Saldo: w nakładce od md w górę (mobile ma X); na ekranie startowym odwrotnie — od md
            pokazuje je karta „Twoje saldo" w kolumnie kategorii, a mobile nie ma innego miejsca. */}
        <div role="status" className={`${page ? 'flex md:hidden' : 'hidden md:flex'} items-center gap-2 px-3 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold shrink-0`} aria-label={`Saldo ${balance} punktów`}>
          <Wallet size={16} /> {balance} pkt
        </div>
        {!page && onExit && (
          <button
            onClick={onExit} aria-label="Zamknij sklep"
            className="p-3 -m-1 rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </header>
  );
}
