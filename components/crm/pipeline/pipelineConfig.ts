import type { LeadStatus } from './pipelineTypes';

// ─── Konfiguracja kolumn ──────────────────────────────────────────────────────

export interface ColumnDef {
  id: LeadStatus;
  label: string;
  /** akcent kropki / licznika */
  dot: string;
  /** tinta tła kolumny */
  tint: string;
  /** ramka kolumny */
  ring: string;
}

export const COLUMNS: ColumnDef[] = [
  { id: 'NEW',        label: 'Nowy',                        dot: 'bg-slate-400',   tint: 'bg-slate-50/80',    ring: 'border-slate-200' },
  { id: 'IN_TALKS',   label: 'W rozmowach',                 dot: 'bg-primary-400', tint: 'bg-primary-50/70',  ring: 'border-primary-200' },
  { id: 'SIGNED',     label: 'Podpisany', dot: 'bg-emerald-500', tint: 'bg-emerald-50/70',  ring: 'border-emerald-200' },
  { id: 'RESIGNED',   label: 'Zrezygnował',                 dot: 'bg-amber-500',   tint: 'bg-amber-50/60',    ring: 'border-amber-200' },
  { id: 'TERMINATED', label: 'Umowa Rozwiązana',            dot: 'bg-slate-500',   tint: 'bg-slate-50/80',    ring: 'border-slate-300' },
];

export const STATUS_LABEL: Record<LeadStatus, string> = COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<LeadStatus, string>,
);

/** Badge statusu dla widoku listy */
export const STATUS_BADGE: Record<LeadStatus, string> = {
  NEW:        'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  IN_TALKS:   'bg-primary-50 text-primary-700 ring-1 ring-primary-200',
  SIGNED:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  RESIGNED:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  TERMINATED: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300',
};

// ─── Mapowanie ról opiekuna ───────────────────────────────────────────────────

export const ROLE_LABEL: Record<string, string> = {
  superadmin: 'ADMINISTRATOR',
  dyrektor:   'DYREKTOR',
  menedzer:   'MANAGER',
  partner:    'DORADCA BIZNESOWY',
  leadowiec:  'LEADOWIEC',
};

export function roleLabel(role?: string | null): string {
  if (!role) return '';
  return ROLE_LABEL[role] ?? role.toUpperCase();
}

// ─── Źródła leada ─────────────────────────────────────────────────────────────

export const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'manual',    label: 'Kontakt własny' },
  { value: 'polecenie', label: 'Polecenie' },
  { value: 'event',     label: 'Event/Targi' },
  { value: 'marketing', label: 'Marketing' },
];

export const SOURCE_LABEL: Record<string, string> = SOURCE_OPTIONS.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<string, string>,
);
