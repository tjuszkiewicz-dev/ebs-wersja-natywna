// Status wygasania dokumentu (karta pobytu / pozwolenie / wiza)
export type ExpiryTone = 'expired' | 'soon' | 'warn' | 'ok';

export interface ExpiryStatus { days: number; tone: ExpiryTone; label: string }

export function expiryStatus(dateStr?: string | null): ExpiryStatus | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0)  return { days, tone: 'expired', label: `wygasła ${-days} dni temu` };
  if (days <= 30) return { days, tone: 'soon', label: days === 0 ? 'wygasa dziś' : `za ${days} dni` };
  if (days <= 60) return { days, tone: 'warn', label: `za ${days} dni` };
  return { days, tone: 'ok', label: `za ${days} dni` };
}

export const TONE_BADGE: Record<ExpiryTone, string> = {
  expired: 'bg-red-100 text-red-700',
  soon:    'bg-rose-50 text-rose-700',
  warn:    'bg-amber-50 text-amber-700',
  ok:      'bg-emerald-50 text-emerald-700',
};

// Termin na złożenie wniosku o kartę pobytu = 90 dni od wjazdu do strefy Schengen.
// (alert pojawia się standardowo, gdy do tego terminu zostaje ≤30 dni → tone 'soon').
export const SCHENGEN_DAYS = 90;
export function schengenDeadline(entryDate?: string | null): string | null {
  if (!entryDate) return null;
  const d = new Date(entryDate);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + SCHENGEN_DAYS * 86400000).toISOString().slice(0, 10);
}

export const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pl-PL');
};
