import { describe, it, expect } from 'vitest';
import {
  FINANCIAL_FOOTPRINT,
  OWNED_TABLES,
  DETACH_TABLES,
  footprintTotal,
  decideMode,
  nonEmptyFootprint,
  expectedConfirmation,
  confirmationMatches,
  buildPlan,
  anonymizedEmail,
  anonymizedProfilePatch,
  isMissingAuthUserError,
} from './accountPurge';

const zeroFootprint = (): Record<string, number> =>
  Object.fromEntries(FINANCIAL_FOOTPRINT.map((t) => [`${t.table}.${t.column}`, 0]));

describe('footprintTotal', () => {
  it('sumuje liczniki', () => {
    expect(footprintTotal({ a: 1, b: 2, c: 0 })).toBe(3);
  });

  it('pusty obiekt = 0', () => {
    expect(footprintTotal({})).toBe(0);
  });

  it('ignoruje wartości nieliczbowe (NaN z nieudanego count)', () => {
    expect(footprintTotal({ a: 2, b: NaN })).toBe(2);
  });
});

describe('decideMode — serce decyzji', () => {
  it('czyste konto → purge', () => {
    expect(decideMode(zeroFootprint())).toBe('purge');
  });

  it('pusty ślad (brak kluczy) → purge', () => {
    expect(decideMode({})).toBe('purge');
  });

  it.each(FINANCIAL_FOOTPRINT.map((t) => `${t.table}.${t.column}`))(
    'pojedynczy wpis w %s → anonymize',
    (key) => {
      expect(decideMode({ ...zeroFootprint(), [key]: 1 })).toBe('anonymize');
    }
  );

  it('księga voucherowa wymusza anonimizację nawet przy jednej transakcji', () => {
    expect(decideMode({ 'voucher_transactions.to_user_id': 1 })).toBe('anonymize');
  });
});

describe('FINANCIAL_FOOTPRINT — kompletność wobec migracji', () => {
  it('zawiera wszystkie FK blokujące usunięcie konta', () => {
    const keys = FINANCIAL_FOOTPRINT.map((t) => `${t.table}.${t.column}`);
    // ON DELETE RESTRICT → auth.users (001_initial_schema.sql)
    expect(keys).toContain('vouchers.current_owner_id');
    expect(keys).toContain('voucher_transactions.from_user_id');
    expect(keys).toContain('voucher_transactions.to_user_id');
    expect(keys).toContain('commissions.agent_id');
    expect(keys).toContain('distribution_batch_items.user_id');
    expect(keys).toContain('buyback_agreements.user_id');
    expect(keys).toContain('support_tickets.creator_id');
    expect(keys).toContain('ticket_messages.sender_id');
    // NO ACTION → user_profiles (017_buyback_batches.sql) — brak w briefie, wykryte w migracji
    expect(keys).toContain('buyback_batches.created_by');
    expect(keys).toContain('buyback_batch_items.employee_id');
  });

  it('nie zawiera duplikatów', () => {
    const keys = FINANCIAL_FOOTPRINT.map((t) => `${t.table}.${t.column}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('każda pozycja ma opis dla właściciela', () => {
    for (const t of FINANCIAL_FOOTPRINT) expect(t.label.length).toBeGreaterThan(0);
  });
});

describe('listy operacyjne', () => {
  it('żadna tabela śladu finansowego nie jest kasowana ani odpinana', () => {
    const footprintTables = new Set(FINANCIAL_FOOTPRINT.map((t) => t.table));
    for (const t of [...OWNED_TABLES, ...DETACH_TABLES]) {
      expect(footprintTables.has(t.table)).toBe(false);
    }
  });

  it('odpięcia i kasowania się nie nakładają na tej samej kolumnie', () => {
    const owned = new Set(OWNED_TABLES.map((t) => `${t.table}.${t.column}`));
    for (const d of DETACH_TABLES) {
      expect(owned.has(`${d.table}.${d.column}`)).toBe(false);
    }
  });

  it('odpina powiązania hr_employees bez FK (dangling po usunięciu konta)', () => {
    const keys = DETACH_TABLES.map((t) => `${t.table}.${t.column}`);
    expect(keys).toContain('hr_employees.user_id');
    expect(keys).toContain('hr_employees.coordinator_id');
    // FK bez ON DELETE (044_shell_entitlements.sql) — bez odpięcia PURGE padnie
    expect(keys).toContain('user_app_entitlements.granted_by');
  });
});

describe('nonEmptyFootprint', () => {
  it('zwraca tylko niezerowe pozycje', () => {
    expect(nonEmptyFootprint({ a: 0, b: 3, c: 0, d: 1 })).toEqual([
      { key: 'b', count: 3 },
      { key: 'd', count: 1 },
    ]);
  });

  it('czyste konto → pusta lista', () => {
    expect(nonEmptyFootprint(zeroFootprint())).toEqual([]);
  });
});

describe('potwierdzenie tożsamości', () => {
  const profile = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', full_name: 'Jan Kowalski' };

  it('dokładna nazwa przechodzi', () => {
    expect(confirmationMatches('Jan Kowalski', profile)).toBe(true);
  });

  it('nazwa z białymi znakami przechodzi po przycięciu', () => {
    expect(confirmationMatches('  Jan Kowalski \n', profile)).toBe(true);
  });

  it('inna wielkość liter NIE przechodzi', () => {
    expect(confirmationMatches('jan kowalski', profile)).toBe(false);
  });

  it('fragment nazwy nie przechodzi', () => {
    expect(confirmationMatches('Jan', profile)).toBe(false);
  });

  it('puste potwierdzenie nie przechodzi', () => {
    expect(confirmationMatches('', profile)).toBe(false);
    expect(confirmationMatches('   ', profile)).toBe(false);
  });

  it('brak pola / zły typ nie przechodzi', () => {
    expect(confirmationMatches(undefined, profile)).toBe(false);
    expect(confirmationMatches(null, profile)).toBe(false);
    expect(confirmationMatches(123, profile)).toBe(false);
    expect(confirmationMatches({ toString: () => 'Jan Kowalski' }, profile)).toBe(false);
  });

  it('konto bez nazwy wymaga przepisania identyfikatora, nie pustki', () => {
    const anon = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', full_name: null };
    expect(expectedConfirmation(anon)).toBe(anon.id);
    expect(confirmationMatches('', anon)).toBe(false);
    expect(confirmationMatches('   ', anon)).toBe(false);
    expect(confirmationMatches(anon.id, anon)).toBe(true);
  });

  it('nazwa złożona z samych spacji traktowana jak brak nazwy', () => {
    const blank = { id: 'id-1', full_name: '   ' };
    expect(expectedConfirmation(blank)).toBe('id-1');
    expect(confirmationMatches('   ', blank)).toBe(false);
  });
});

describe('buildPlan', () => {
  it('purge kasuje konto logowania i profil', () => {
    const plan = buildPlan('purge');
    expect(plan.mode).toBe('purge');
    expect(plan.deletes).toContain('auth.users (konto logowania)');
    expect(plan.deletes).toContain('user_profiles (profil)');
    expect(plan.keeps).toEqual([]);
  });

  it('anonimizacja NIE kasuje profilu ani konta logowania', () => {
    const plan = buildPlan('anonymize');
    expect(plan.deletes).not.toContain('user_profiles (profil)');
    expect(plan.deletes.some((d) => d.startsWith('auth.users'))).toBe(false);
  });

  it('anonimizacja jawnie zachowuje księgę i dokumenty finansowe', () => {
    const plan = buildPlan('anonymize');
    expect(plan.keeps).toContain('voucher_transactions.from_user_id');
    expect(plan.keeps).toContain('voucher_transactions.to_user_id');
    expect(plan.keeps).toContain('vouchers.current_owner_id');
    expect(plan.keeps).toContain('buyback_agreements.user_id');
  });

  it('oba tryby kasują te same rzeczy prywatne konta', () => {
    expect(buildPlan('anonymize').deletes).toEqual(OWNED_TABLES.map((t) => `${t.table}.${t.column}`));
    expect(buildPlan('purge').deletes.slice(0, OWNED_TABLES.length)).toEqual(
      OWNED_TABLES.map((t) => `${t.table}.${t.column}`)
    );
  });

  it('w planie purge konto logowania idzie PRZED profilem', () => {
    const plan = buildPlan('purge');
    expect(plan.deletes.indexOf('auth.users (konto logowania)')).toBeLessThan(
      plan.deletes.indexOf('user_profiles (profil)')
    );
  });
});

describe('anonimizacja — dane', () => {
  it('adres logowania jest jednoznacznie martwy i unikalny', () => {
    const email = anonymizedEmail('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(email).toBe('usuniete+aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee@invalid.local');
    expect(email.endsWith('@invalid.local')).toBe(true);
    expect(anonymizedEmail('id-a')).not.toBe(anonymizedEmail('id-b'));
  });

  it('patch czyści wszystkie pola z danymi osobowymi', () => {
    const patch = anonymizedProfilePatch('2026-08-01T00:00:00.000Z');
    for (const col of [
      'pesel', 'pesel_encrypted', 'phone_number', 'iban', 'address_street',
      'address_city', 'address_zip', 'temp_password', 'contact_email',
      'company_name', 'department', 'position',
    ]) {
      expect(patch[col]).toBeNull();
    }
    expect(patch.full_name).toBe('Konto usunięte');
    expect(patch.iban_verified).toBe(false);
    expect(patch.status).toBe('anonymized');
    expect(patch.anonymized_at).toBe('2026-08-01T00:00:00.000Z');
  });

  it('patch NIE dotyka roli ani firmy (spójność księgi i raportów)', () => {
    const patch = anonymizedProfilePatch('2026-08-01T00:00:00.000Z');
    expect('role' in patch).toBe(false);
    expect('company_id' in patch).toBe(false);
    expect('id' in patch).toBe(false);
  });
});

describe('isMissingAuthUserError', () => {
  it.each([
    'User not found',
    'user not found',
    'User  not found',
    'relation does not exist',
  ])('toleruje %s', (msg) => {
    expect(isMissingAuthUserError(msg)).toBe(true);
  });

  it.each(['Database error deleting user', 'permission denied', ''])(
    'NIE toleruje %s',
    (msg) => {
      expect(isMissingAuthUserError(msg)).toBe(false);
    }
  );

  it('nie-string → false', () => {
    expect(isMissingAuthUserError(undefined)).toBe(false);
    expect(isMissingAuthUserError(null)).toBe(false);
  });
});
