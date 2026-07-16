'use client';

import Link from 'next/link';
import { LayoutGrid, LogOut } from 'lucide-react';

export function TopBar() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <header
      className="sticky top-0 z-50 flex h-16 w-full flex-shrink-0 items-center justify-between
                 border-b border-white/10 px-5 sm:px-6 backdrop-blur-md"
      style={{ backgroundColor: 'rgba(6,14,10,.88)' }}
    >
      {/* Brand */}
      <Link href="/launcher" className="flex items-center gap-3 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ebs-black.svg"
          alt=""
          className="h-8 w-auto"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
        <span className="hidden font-sans text-base font-bold tracking-tight text-white sm:block">
          Eliton Benefits
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-300">
            System
          </span>
        </span>
      </Link>

      {/* Prawa strona */}
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/launcher"
          title="Wybierz aplikację"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70
                     transition-colors hover:bg-white/5 hover:text-white"
        >
          <LayoutGrid size={18} />
          <span className="hidden sm:inline">Aplikacje</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60
                     transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
        >
          <LogOut size={17} />
          <span className="hidden sm:inline">Wyloguj</span>
        </button>
      </div>
    </header>
  );
}
