// Kolejka zgłoszeń BOK — czysta logika (statusy, filtry, patch obsługi, termin), bez Reacta
// i bez bazy, żeby dało się ją testować i użyć po obu stronach (route + ekran).
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §11.
import { INITIAL_SERVICES } from '@/services/mockData';
import { findCatalogItem } from './catalog';

export type QueueStatus = 'new' | 'in_progress' | 'done';
export const QUEUE_STATUSES: readonly QueueStatus[] = ['new', 'in_progress', 'done'];
export const STATUS_LABEL: Readonly<Record<QueueStatus, string>> = {
  new: 'Nowe', in_progress: 'W toku', done: 'Zamknięte',
};

export type QueueKind = 'orders' | 'inquiries';
export const QUEUE_KINDS: readonly QueueKind[] = ['orders', 'inquiries'];
export function isQueueKind(v: unknown): v is QueueKind {
  return typeof v === 'string' && (QUEUE_KINDS as readonly string[]).includes(v);
}

/** Filtr statusu w ekranie i w query stringu; „otwarte" = to, nad czym BOK ma pracować. */
export type StatusFilter = 'open' | QueueStatus | 'all';
export const STATUS_FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: 'open', label: 'Otwarte' },
  { id: 'new', label: 'Nowe' },
  { id: 'in_progress', label: 'W toku' },
  { id: 'done', label: 'Zamknięte' },
  { id: 'all', label: 'Wszystkie' },
];

export function isQueueStatus(v: unknown): v is QueueStatus {
  return typeof v === 'string' && (QUEUE_STATUSES as readonly string[]).includes(v);
}

export function parseStatusFilter(raw: string | null | undefined): StatusFilter {
  if (raw === 'open' || raw === 'all' || isQueueStatus(raw)) return raw;
  return 'open';
}

export function statusesForFilter(filter: StatusFilter): QueueStatus[] {
  if (filter === 'open') return ['new', 'in_progress'];
  if (filter === 'all') return [...QUEUE_STATUSES];
  return [filter];
}

/** Stronicowanie jak w /api/admin/logs: domyślnie 50, maks. 200, offset ≥ 0. */
export function parsePaging(limitRaw: string | null | undefined, offsetRaw: string | null | undefined,
  opts: { def?: number; max?: number } = {}): { limit: number; offset: number } {
  const def = opts.def ?? 50;
  const max = opts.max ?? 200;
  const limit = Math.min(Math.max(parseInt(limitRaw || String(def), 10) || def, 1), max);
  const offset = Math.max(parseInt(offsetRaw || '0', 10) || 0, 0);
  return { limit, offset };
}

export const NOTE_MAX = 500;

/** Notatka BOK: przycięta, pusta → null (kolumna jest nullowalna, „" nie ma tu sensu). */
export function normalizeNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export interface HandlingInput { status?: QueueStatus; note?: string | null }
export interface HandlingPatch {
  status?: QueueStatus;
  note?: string | null;
  handled_by?: string | null;
  handled_at?: string | null;
  updated_at: string;
}

/**
 * Jedna reguła dla obu tabel: przejście na „w toku"/„zamknięte" podpisuje obsługującego
 * i czas; powrót na „nowe" zdejmuje podpis (zgłoszenie wraca do kolejki dla wszystkich).
 * Sama notatka nie zmienia statusu ani podpisu — BOK może dopisać uwagę bez „brania" zgłoszenia.
 */
export function buildHandlingPatch(input: HandlingInput, actorId: string, now: Date): HandlingPatch {
  const patch: HandlingPatch = { updated_at: now.toISOString() };
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === 'new') { patch.handled_by = null; patch.handled_at = null; }
    else { patch.handled_by = actorId; patch.handled_at = now.toISOString(); }
  }
  if (input.note !== undefined) patch.note = normalizeNote(input.note);
  return patch;
}

/** Aplikacje Eliton realizowane automatycznie — id z katalogu (dla bok_sync_order_queue). */
export function autoServiceIds(): string[] {
  return INITIAL_SERVICES.filter(s => s.fulfillment === 'auto').map(s => s.id);
}

/** INTERNAL-* (mikrowydatki w aplikacjach) i pozycje `auto` nie wymagają ruchu BOK. */
export function fulfillmentFor(serviceId: string): 'auto' | 'bok' {
  if (serviceId.startsWith('INTERNAL-')) return 'auto';
  return findCatalogItem(serviceId)?.fulfillment ?? 'bok';
}

export function partnerFor(serviceId: string): string | undefined {
  if (serviceId.startsWith('INTERNAL-')) return 'Eliton';
  return findCatalogItem(serviceId)?.partner;
}

/** Obietnica z potwierdzeń dla pracownika (BOK_SLA_TEXT) wyrażona liczbowo. */
export const SLA_BUSINESS_DAYS = 2;

/**
 * Dodaje n dni roboczych (pomija soboty i niedziele; święta nie są liczone — świadomie).
 * Liczone w UTC, żeby wynik był ten sam na Vercelu (UTC) i na maszynie deweloperskiej (Warszawa).
 */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d;
}

/** Otwarte zgłoszenie starsze niż SLA → „po terminie" (ekran pokazuje to tekstem, nie samym kolorem). */
export function isOverdue(createdAt: string | Date, status: QueueStatus, now: Date = new Date()): boolean {
  if (status === 'done') return false;
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (Number.isNaN(created.getTime())) return false;
  return now.getTime() > addBusinessDays(created, SLA_BUSINESS_DAYS).getTime();
}
