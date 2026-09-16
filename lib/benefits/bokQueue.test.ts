import { describe, it, expect } from 'vitest';
import {
  QUEUE_STATUSES, STATUS_FILTERS, isQueueStatus, isQueueKind, parseStatusFilter, statusesForFilter,
  parsePaging, normalizeNote, buildHandlingPatch, autoServiceIds, fulfillmentFor, partnerFor,
  addBusinessDays, isOverdue, NOTE_MAX,
} from './bokQueue';
import { INITIAL_SERVICES } from '@/services/mockData';

describe('statusy i filtry', () => {
  it('trzy statusy w kolejności pracy', () => {
    expect(QUEUE_STATUSES).toEqual(['new', 'in_progress', 'done']);
    expect(isQueueStatus('done')).toBe(true);
    expect(isQueueStatus('closed')).toBe(false);
    expect(isQueueStatus(null)).toBe(false);
  });

  it('rodzaje kolejki: zamówienia i zapytania', () => {
    expect(isQueueKind('orders')).toBe(true);
    expect(isQueueKind('inquiries')).toBe(true);
    expect(isQueueKind('tickets')).toBe(false);
  });

  it('nieznany filtr → „otwarte" (domyślny widok pracy BOK)', () => {
    expect(parseStatusFilter(undefined)).toBe('open');
    expect(parseStatusFilter(null)).toBe('open');
    expect(parseStatusFilter('cokolwiek')).toBe('open');
    expect(parseStatusFilter('done')).toBe('done');
    expect(parseStatusFilter('all')).toBe('all');
  });

  it('„otwarte" = nowe + w toku; „wszystkie" = trzy statusy; pojedynczy = sam siebie', () => {
    expect(statusesForFilter('open')).toEqual(['new', 'in_progress']);
    expect(statusesForFilter('all')).toEqual(['new', 'in_progress', 'done']);
    expect(statusesForFilter('in_progress')).toEqual(['in_progress']);
  });

  it('każdy filtr z listy ekranu jest parsowalny', () => {
    for (const f of STATUS_FILTERS) expect(parseStatusFilter(f.id)).toBe(f.id);
  });
});

describe('parsePaging', () => {
  it('domyślnie 50/0, limit przycięty do 1..200, śmieci ignorowane', () => {
    expect(parsePaging(null, null)).toEqual({ limit: 50, offset: 0 });
    expect(parsePaging('500', '10')).toEqual({ limit: 200, offset: 10 });
    expect(parsePaging('0', '-5')).toEqual({ limit: 50, offset: 0 }); // 0 = brak sensownego limitu → domyślny, jak w /api/admin/logs
    expect(parsePaging('abc', 'xyz')).toEqual({ limit: 50, offset: 0 });
  });
});

describe('notatka i patch obsługi', () => {
  const now = new Date('2026-09-17T10:00:00Z');

  it('notatka: trim, pusta → null, nie-string → null', () => {
    expect(normalizeNote('  wysłano kod  ')).toBe('wysłano kod');
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
    expect(normalizeNote(42)).toBeNull();
    expect(NOTE_MAX).toBe(500);
  });

  it('„w toku"/„zamknięte" podpisuje obsługującego i czas', () => {
    const p = buildHandlingPatch({ status: 'in_progress' }, 'user-1', now);
    expect(p).toEqual({ status: 'in_progress', handled_by: 'user-1', handled_at: now.toISOString(), updated_at: now.toISOString() });
    expect(buildHandlingPatch({ status: 'done' }, 'user-2', now).handled_by).toBe('user-2');
  });

  it('powrót na „nowe" zdejmuje podpis — zgłoszenie wraca do wspólnej kolejki', () => {
    const p = buildHandlingPatch({ status: 'new' }, 'user-1', now);
    expect(p.status).toBe('new');
    expect(p.handled_by).toBeNull();
    expect(p.handled_at).toBeNull();
  });

  it('sama notatka nie rusza statusu ani podpisu', () => {
    const p = buildHandlingPatch({ note: ' oddzwonić jutro ' }, 'user-1', now);
    expect(p).toEqual({ note: 'oddzwonić jutro', updated_at: now.toISOString() });
    expect('status' in p).toBe(false);
    expect('handled_by' in p).toBe(false);
  });

  it('note: null czyści notatkę', () => {
    expect(buildHandlingPatch({ note: null }, 'u', now).note).toBeNull();
  });
});

describe('katalog → sposób realizacji', () => {
  it('aplikacje Eliton są „auto", reszta katalogu i nieznane id → BOK', () => {
    const auto = autoServiceIds();
    expect(auto).toEqual(expect.arrayContaining(['SRV-MENTAL-01', 'SRV-LEGAL-01', 'SRV-SECURE-01', 'SRV-VAULT-01']));
    for (const id of auto) expect(INITIAL_SERVICES.find(s => s.id === id)?.fulfillment).toBe('auto');
    expect(fulfillmentFor('SRV-LEGAL-01')).toBe('auto');
    expect(fulfillmentFor('SRV-04')).toBe('bok');
    expect(fulfillmentFor('SRV-NIE-MA')).toBe('bok');
  });

  it('INTERNAL-* (wydatki w aplikacjach) to zawsze „auto" z partnerem Eliton', () => {
    expect(fulfillmentFor('INTERNAL-AI-COACH')).toBe('auto');
    expect(partnerFor('INTERNAL-AI-COACH')).toBe('Eliton');
  });

  it('partner z katalogu; brak pozycji → undefined', () => {
    expect(partnerFor('SRV-P-UNIQA')).toBe('Profitowi');
    expect(partnerFor('SRV-NIE-MA')).toBeUndefined();
  });
});

describe('termin SLA (2 dni robocze)', () => {
  it('addBusinessDays pomija weekend', () => {
    const friday = new Date('2026-09-18T12:00:00Z'); // piątek
    expect(addBusinessDays(friday, 2).toISOString()).toBe('2026-09-22T12:00:00.000Z'); // wtorek
    const monday = new Date('2026-09-14T12:00:00Z');
    expect(addBusinessDays(monday, 2).toISOString()).toBe('2026-09-16T12:00:00.000Z');
  });

  it('otwarte zgłoszenie po 2 dniach roboczych jest po terminie; zamknięte nigdy', () => {
    const created = '2026-09-14T09:00:00Z'; // poniedziałek
    expect(isOverdue(created, 'new', new Date('2026-09-16T08:59:00Z'))).toBe(false);
    expect(isOverdue(created, 'new', new Date('2026-09-16T09:01:00Z'))).toBe(true);
    expect(isOverdue(created, 'in_progress', new Date('2026-09-17T09:00:00Z'))).toBe(true);
    expect(isOverdue(created, 'done', new Date('2026-12-01T00:00:00Z'))).toBe(false);
  });

  it('zgłoszenie z piątku ma czas do wtorku', () => {
    const friday = '2026-09-18T15:00:00Z';
    expect(isOverdue(friday, 'new', new Date('2026-09-21T15:00:00Z'))).toBe(false); // poniedziałek
    expect(isOverdue(friday, 'new', new Date('2026-09-22T15:01:00Z'))).toBe(true);  // wtorek po 15:00
  });

  it('nieparsowalna data nie jest „po terminie"', () => {
    expect(isOverdue('nie-data', 'new')).toBe(false);
  });
});
