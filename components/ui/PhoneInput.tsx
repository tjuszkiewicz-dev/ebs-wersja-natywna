"use client";
import React from 'react';
import { Phone } from 'lucide-react';

// ─── Exported helpers (use in places where full component can't be used) ────

/** Format up to 9 raw digits as "XXX XXX XXX" */
export function formatPhoneDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Extract the 9 subscriber digits from any phone value (strips +48, spaces) */
export function digitsFromPhone(value: string): string {
  return value.replace(/^\+?48\s*/, '').replace(/\s/g, '').replace(/\D/g, '');
}

/** Returns true when value is empty OR contains exactly 9 digits */
export function isValidPhone(value: string): boolean {
  const d = digitsFromPhone(value);
  return d.length === 0 || d.length === 9;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PhoneInputProps {
  value: string;
  onChange: (formatted: string) => void;
  label?: string;
  /** External error message (overrides built-in invalid-length message) */
  error?: string;
  required?: boolean;
  /** Override the default label className */
  labelClassName?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  label,
  error,
  required,
  labelClassName,
}) => {
  const digits = digitsFromPhone(value || '');
  const displayValue = formatPhoneDigits(digits);
  const isInvalid = digits.length > 0 && digits.length < 9;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Strip +48 prefix (handles paste of full number) then keep only digits
    const cleaned = raw.replace(/^\+?48\s*/, '').replace(/\D/g, '').slice(0, 9);
    onChange(cleaned.length === 0 ? '' : `+48 ${formatPhoneDigits(cleaned)}`);
  };

  return (
    <div className="w-full">
      {label && (
        <label className={
          labelClassName ??
          'flex text-xs font-bold text-slate-600 uppercase mb-1.5 justify-between items-center'
        }>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className={[
        'relative flex items-center bg-white border rounded-xl overflow-hidden',
        'transition-all duration-200 focus-within:ring-2 focus-within:border-transparent',
        (isInvalid || error)
          ? 'border-red-300 focus-within:ring-red-200'
          : 'border-slate-300 focus-within:ring-indigo-500',
      ].join(' ')}>
        <span className="pl-3 pr-1 py-2.5 text-sm text-slate-400 select-none whitespace-nowrap font-mono">
          +48
        </span>
        <input
          type="tel"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder="--- --- ---"
          className="flex-1 bg-transparent text-slate-900 text-sm py-2.5 pr-10 pl-1 focus:outline-none font-mono placeholder-slate-400"
        />
        <Phone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {(error || isInvalid) && (
        <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1 animate-in slide-in-from-top-1">
          {error || 'Podaj pełny numer telefonu (9 cyfr)'}
        </p>
      )}
    </div>
  );
};
