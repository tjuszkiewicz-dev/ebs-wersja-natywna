'use client';
import React from 'react';
import { Search, X, Wallet } from 'lucide-react';
import { STORE_TITLE } from '@/lib/benefits/constants';

interface Props { query: string; onQuery: (q: string) => void; balance: number; onExit: () => void }

export function StoreHeader({ query, onQuery, balance, onExit }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center gap-3 md:gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <img src="/ebs-black.svg" alt="EBS" className="h-6 w-auto" />
          <span className="hidden sm:inline font-bold text-slate-900 tracking-tight">{STORE_TITLE}</span>
        </div>
        <label className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search" value={query} onChange={e => onQuery(e.target.value)}
            placeholder="Szukaj benefitu…" aria-label="Szukaj benefitu"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white"
          />
        </label>
        <div className="hidden md:flex items-center gap-2 px-3 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold shrink-0" aria-label={`Saldo ${balance} punktów`}>
          <Wallet size={16} /> {balance} pkt
        </div>
        <button
          onClick={onExit} aria-label="Zamknij sklep"
          className="p-3 -m-1 rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          <X size={20} />
        </button>
      </div>
    </header>
  );
}
