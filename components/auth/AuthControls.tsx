'use client';

// Kontrolki ekranów auth w tokenach strony elitonbenefits.pl:
// karta #191c1f na szkle, pola rounded-[14px] na white/[0.04], eyebrow zielony
// z rozstrzelonym trackingiem, główny przycisk = biała pigułka z ciemnym tekstem.

import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import React, { useId, useState } from 'react';

export function AuthEyebrow({ children, pill }: { children: React.ReactNode; pill?: boolean }) {
  // Wariant „pill" = eyebrow ze strony („JAK TO DZIAŁA"): czytelny także na jasnej aurorze.
  return (
    <p
      className={
        pill
          ? 'inline-block rounded-full border border-white/[0.12] bg-[#191c1f]/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4ade80] backdrop-blur-sm'
          : 'text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4ade80]'
      }
    >
      {children}
    </p>
  );
}

export function AuthCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[24px] border border-white/[0.08] bg-[#191c1f]/[0.92] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.32)] sm:p-8 sm:backdrop-blur-[14px] ${className}`}
    >
      {children}
    </div>
  );
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
  label: string;
  /** Ikona po lewej stronie pola (lucide, 16px). */
  icon?: React.ReactNode;
  /** Element po prawej stronie etykiety (np. „Nie pamiętam hasła"). */
  labelAction?: React.ReactNode;
  /** Pole hasła z przełącznikiem widoczności. */
  revealable?: boolean;
  id?: string;
};

export function AuthField({ label, icon, labelAction, revealable, id, type, ...input }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [revealed, setRevealed] = useState(false);
  const inputType = revealable ? (revealed ? 'text' : 'password') : type;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={fieldId} className="text-[13px] font-medium text-white/60">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="group relative">
        {icon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors duration-200 group-focus-within:text-[#4ade80]"
          >
            {icon}
          </span>
        )}
        <input
          id={fieldId}
          type={inputType}
          {...input}
          className={`auth-input h-12 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-base text-white outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-ebs placeholder:text-white/35 hover:border-white/[0.14] focus:border-[#4ade80]/60 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(74,222,128,0.12)] disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px] ${icon ? 'pl-11' : 'pl-4'} ${revealable ? 'pr-12' : 'pr-4'}`}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Ukryj hasło' : 'Pokaż hasło'}
            aria-pressed={revealed}
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/40 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]/50"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  loading?: boolean;
};

const BUTTON_BASE =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] transition-[transform,background-color,border-color,opacity] duration-150 ease-ebs focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:hover:scale-100';

const BUTTON_VARIANT = {
  primary:
    'bg-white font-semibold text-[#191c1f] hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] focus-visible:ring-white/20 disabled:opacity-60',
  ghost:
    'border border-white/[0.13] font-medium text-white hover:border-white/[0.24] hover:bg-white/[0.06] active:scale-[0.98] focus-visible:ring-white/10 disabled:opacity-50',
};

export function AuthButton({ variant = 'primary', loading, children, className = '', ...btn }: ButtonProps) {
  return (
    <button
      {...btn}
      disabled={btn.disabled || loading}
      aria-busy={loading || undefined}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      )}
      {children}
    </button>
  );
}

export function AuthTextLink({ children, className = '', ...a }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...a}
      className={`-my-3 -mx-2 rounded-md px-2 py-3 text-[13px] font-medium text-white/50 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]/50 ${className}`}
    >
      {children}
    </button>
  );
}

export function AuthAlert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const isError = tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-[14px] border px-4 py-3 text-[13px] leading-snug animate-rise motion-reduce:animate-none ${
        isError
          ? 'border-red-400/20 bg-red-400/10 text-red-200'
          : 'border-[#4ade80]/20 bg-[#4ade80]/10 text-green-100'
      }`}
    >
      {isError ? (
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}
