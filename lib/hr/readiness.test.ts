import { describe, it, expect } from 'vitest';
import { computeReadiness } from './readiness';

describe('computeReadiness', () => {
  it('pracownik bez dokumentów → niższy wynik niż z kompletem dokumentów', () => {
    const empty = computeReadiness({});
    const full = computeReadiness({
      pesel: '90010112345',
      passport_number: 'AB1234567',
      passport_expiry: '2099-01-01',
      visa_expiry: '2099-01-01',
      zus_registration_date: '2026-01-01',
      medical_exam_expiry: '2099-01-01',
    });
    expect(full.done).toBeGreaterThan(empty.done);
    expect(full.ready).toBe(true);
    expect(empty.ready).toBe(false);
  });

  it('total pozostaje stały niezależnie od danych', () => {
    const empty = computeReadiness({});
    const full = computeReadiness({ pesel: '90010112345' });
    expect(empty.total).toBe(full.total);
  });
});
