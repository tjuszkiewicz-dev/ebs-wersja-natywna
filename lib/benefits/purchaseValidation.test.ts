import { describe, it, expect } from 'vitest';
import { validatePurchase } from './purchaseValidation';

describe('validatePurchase', () => {
  it('pozycja katalogowa: kwota musi równać się cenie', () => {
    expect(validatePurchase('SRV-04', 25)).toMatchObject({ ok: true, kind: 'catalog' });
    expect(validatePurchase('SRV-04', 1)).toEqual({ ok: false, error: 'price_mismatch' });
  });
  it('cena 0 nie jest do kupienia za punkty', () => {
    expect(validatePurchase('SRV-P-PZU', 0)).toEqual({ ok: false, error: 'not_purchasable' });
    expect(validatePurchase('SRV-P-PZU', 10)).toEqual({ ok: false, error: 'not_purchasable' });
  });
  it('nieznane SRV → unknown_service', () => {
    expect(validatePurchase('SRV-NIEMA', 5)).toEqual({ ok: false, error: 'unknown_service' });
  });
  it('INTERNAL-* (wydatki wewnątrz aplikacji) przechodzi bez katalogu', () => {
    expect(validatePurchase('INTERNAL-1726000000', 3)).toEqual({ ok: true, kind: 'internal' });
  });
  it('stare PARTNER-* i śmieci → invalid_id', () => {
    expect(validatePurchase('PARTNER-123', 0)).toEqual({ ok: false, error: 'invalid_id' });
    expect(validatePurchase('', 5)).toEqual({ ok: false, error: 'invalid_id' });
  });
});
