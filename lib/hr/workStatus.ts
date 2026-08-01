// Status PRACY pracownika — WYŁĄCZNIE prezentacyjny.
// NIE mylić z hr_employees.status (active/inactive), które steruje
// rozliczeniami, payrollem i filtrem alertów. Rozdział jest świadomy.
export type WorkStatusId = 'pracuje' | 'oczekuje' | 'urlop' | 'zwolniony';

export const WORK_STATUSES = [
  { id: 'pracuje',   label: 'Pracuje',   badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { id: 'oczekuje',  label: 'Oczekuje',  badge: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  { id: 'urlop',     label: 'Urlop',     badge: 'bg-sky-100 text-sky-700 border-sky-200',             dot: 'bg-sky-500' },
  { id: 'zwolniony', label: 'Zwolniony', badge: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500' },
] as const satisfies ReadonlyArray<{ id: WorkStatusId; label: string; badge: string; dot: string }>;

export const WORK_STATUS_IDS = WORK_STATUSES.map(s => s.id) as readonly WorkStatusId[];
export const DEFAULT_WORK_STATUS: WorkStatusId = 'pracuje';

export function isWorkStatusId(v: unknown): v is WorkStatusId {
  return typeof v === 'string' && (WORK_STATUS_IDS as readonly string[]).includes(v);
}

export function workStatusDef(id: string | null | undefined) {
  return WORK_STATUSES.find(s => s.id === id) ?? WORK_STATUSES[0];
}
