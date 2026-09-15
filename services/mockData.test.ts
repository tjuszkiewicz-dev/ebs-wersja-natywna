import { describe, it, expect } from 'vitest';
import { INITIAL_SERVICES } from './mockData';
import { BenefitCategory } from '@/types/enums';

describe('INITIAL_SERVICES — katalog sklepu benefitów', () => {
  const ids = INITIAL_SERVICES.map(s => s.id);

  it('każda pozycja ma kategorię z enumu', () => {
    const allowed = new Set(Object.values(BenefitCategory));
    for (const s of INITIAL_SERVICES) {
      expect(allowed.has(s.category), `${s.id} bez kategorii`).toBe(true);
    }
  });

  it('identyfikatory są unikalne', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('zawiera 11 nowych pozycji partnerskich z ceną 0 i Medicover', () => {
    const partnerIds = ids.filter(id => id.startsWith('SRV-P-'));
    expect(partnerIds).toHaveLength(11);
    for (const id of partnerIds) {
      const s = INITIAL_SERVICES.find(x => x.id === id)!;
      expect(s.price, `${id} ma mieć cenę 0`).toBe(0);
      expect(s.partner, `${id} bez partnera`).toBeTruthy();
    }
    expect(INITIAL_SERVICES.find(s => s.id === 'SRV-P-MEDICOVER')?.category).toBe(BenefitCategory.ZDROWIE);
  });

  it('cztery aplikacje Eliton są w katalogu z fulfillment=auto', () => {
    for (const id of ['SRV-MENTAL-01', 'SRV-LEGAL-01', 'SRV-SECURE-01', 'SRV-VAULT-01']) {
      const s = INITIAL_SERVICES.find(x => x.id === id);
      expect(s, `${id} brak w katalogu`).toBeTruthy();
      expect(s!.fulfillment).toBe('auto');
      expect(s!.price).toBeGreaterThan(0);
    }
  });

  it('ceny istniejących pozycji bez zmian (próbka)', () => {
    const price = (id: string) => INITIAL_SERVICES.find(s => s.id === id)!.price;
    expect(price('SRV-01')).toBe(20);        // Spotify
    expect(price('SRV-04')).toBe(25);        // Multikino
    expect(price('SRV-03')).toBe(200);       // porada prawna
    expect(price('SRV-MENTAL-01')).toBe(100);
  });

  it('każda cena w katalogu jest liczbą całkowitą w zakresie 0–10 000', () => {
    for (const s of INITIAL_SERVICES) {
      expect(Number.isInteger(s.price), `${s.id}: price nie jest liczbą całkowitą (${s.price})`).toBe(true);
      expect(s.price, `${s.id}: price poniżej 0`).toBeGreaterThanOrEqual(0);
      expect(s.price, `${s.id}: price powyżej 10 000`).toBeLessThanOrEqual(10_000);
    }
  });
});
