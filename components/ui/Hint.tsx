'use client';

// Małe „i" w bladoniebieskim kółku — po najechaniu dymek z opisem funkcji.
// Używane przy inputach (obok etykiety) i przyciskach w całym panelu.
import React from 'react';

export function Hint({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span
        aria-label={text}
        className="flex h-[15px] w-[15px] cursor-help select-none items-center justify-center rounded-full bg-sky-100 text-[9px] font-bold italic text-sky-500 ring-1 ring-sky-200"
      >
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-[70] mb-1.5 w-60 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </span>
    </span>
  );
}
