import { describe, it, expect } from 'vitest';
import { BenefitCategory, ServiceType } from '@/types/enums';
import type { ServiceItem } from '@/types';
import {
  BENEFIT_CATEGORIES, normalizeSearch, filterCatalog, sortForSection, groupByCategory,
  countByCategory, resolveAction, findCatalogItem, partnerCount, APP_TAB_BY_SERVICE,
} from './catalog';

const item = (over: Partial<ServiceItem>): ServiceItem => ({
  id: 'X', name: 'Nazwa', description: 'Opis', price: 10, type: ServiceType.ONE_TIME,
  icon: 'Zap', isActive: true, category: BenefitCategory.CODZIENNOSC, ...over,
});

describe('BENEFIT_CATEGORIES', () => {
  it('sześć kategorii w kolejności ze specu', () => {
    expect(BENEFIT_CATEGORIES.map(c => c.id)).toEqual([
      BenefitCategory.ZDROWIE, BenefitCategory.UBEZPIECZENIA, BenefitCategory.FINANSE,
      BenefitCategory.ROZWOJ, BenefitCategory.RODZINA, BenefitCategory.CODZIENNOSC,
    ]);
    for (const c of BENEFIT_CATEGORIES) { expect(c.label).toBeTruthy(); expect(c.icon).toBeTruthy(); }
  });
});

describe('normalizeSearch / filterCatalog', () => {
  const items = [
    item({ id: 'A', name: 'PZU — Ubezpieczenie NNW', partner: 'Profitowi', category: BenefitCategory.UBEZPIECZENIA }),
    item({ id: 'B', name: 'Luxmed — Optyka', partner: 'Profitowi', category: BenefitCategory.ZDROWIE, description: 'Rehabilitacja' }),
    item({ id: 'C', name: 'Spotify', category: BenefitCategory.CODZIENNOSC }),
    item({ id: 'D', name: 'Nieaktywna', isActive: false }),
  ];

  it('normalizuje wielkość liter i diakrytyki', () => {
    expect(normalizeSearch('  UBEZPIECZENIE Życiowe ')).toBe('ubezpieczenie zyciowe');
  });

  it('szuka po nazwie, opisie i partnerze, bez rozróżniania wielkości liter i ogonków', () => {
    expect(filterCatalog(items, { query: 'ubezp' }).map(i => i.id)).toEqual(['A']);
    expect(filterCatalog(items, { query: 'REHABILIT' }).map(i => i.id)).toEqual(['B']);
    expect(filterCatalog(items, { query: 'profitowi' }).map(i => i.id).sort()).toEqual(['A', 'B']);
    expect(filterCatalog(items, { query: 'zycie' })).toEqual([]);
  });

  it('filtruje po kategorii, ALL = wszystkie aktywne', () => {
    expect(filterCatalog(items, { category: BenefitCategory.ZDROWIE }).map(i => i.id)).toEqual(['B']);
    expect(filterCatalog(items, { category: 'ALL' }).map(i => i.id).sort()).toEqual(['A', 'B', 'C']);
  });

  it('pomija nieaktywne', () => {
    expect(filterCatalog(items, {}).some(i => i.id === 'D')).toBe(false);
  });
});

describe('sortForSection', () => {
  it('cena > 0 rosnąco, potem cena 0, remisy alfabetycznie', () => {
    const sorted = sortForSection([
      item({ id: '1', name: 'Zeta', price: 0 }), item({ id: '2', name: 'Beta', price: 30 }),
      item({ id: '3', name: 'Alfa', price: 0 }), item({ id: '4', name: 'Gamma', price: 30 }),
      item({ id: '5', name: 'Delta', price: 5 }),
    ]);
    expect(sorted.map(i => i.id)).toEqual(['5', '2', '4', '3', '1']);
  });
});

describe('groupByCategory / countByCategory', () => {
  const items = [
    item({ id: 'c1', category: BenefitCategory.CODZIENNOSC }),
    item({ id: 'z1', category: BenefitCategory.ZDROWIE }),
    item({ id: 'z2', category: BenefitCategory.ZDROWIE, isActive: false }),
  ];
  it('grupuje w kolejności kategorii i pomija puste', () => {
    const groups = groupByCategory(items);
    expect(groups.map(g => g.category.id)).toEqual([BenefitCategory.ZDROWIE, BenefitCategory.CODZIENNOSC]);
    expect(groups[0].items.map(i => i.id)).toEqual(['z1']);
  });
  it('liczy tylko aktywne', () => {
    const c = countByCategory(items);
    expect(c.total).toBe(2);
    expect(c.byCategory[BenefitCategory.ZDROWIE]).toBe(1);
    expect(c.byCategory[BenefitCategory.UBEZPIECZENIA]).toBe(0);
  });
});

describe('resolveAction', () => {
  const owned = new Set(['SRV-MENTAL-01']);
  it('cena 0 → inquire, niezależnie od salda', () => {
    expect(resolveAction(item({ price: 0 }), owned, 0)).toBe('inquire');
    expect(resolveAction(item({ price: 0 }), owned, 999)).toBe('inquire');
  });
  it('kupiona aplikacja auto → open', () => {
    expect(resolveAction(item({ id: 'SRV-MENTAL-01', price: 100, fulfillment: 'auto' }), owned, 0)).toBe('open');
  });
  it('niekupiona aplikacja auto → buy / insufficient wg salda', () => {
    expect(resolveAction(item({ id: 'SRV-LEGAL-01', price: 150, fulfillment: 'auto' }), owned, 150)).toBe('buy');
    expect(resolveAction(item({ id: 'SRV-LEGAL-01', price: 150, fulfillment: 'auto' }), owned, 149)).toBe('insufficient');
  });
  it('produkt bok kupiony wcześniej nadal jest do kupienia (bilety kupuje się wiele razy)', () => {
    expect(resolveAction(item({ id: 'SRV-04', price: 25 }), new Set(['SRV-04']), 25)).toBe('buy');
  });
  it('saldo równe cenie → buy; mniejsze → insufficient', () => {
    expect(resolveAction(item({ price: 25 }), owned, 25)).toBe('buy');
    expect(resolveAction(item({ price: 25 }), owned, 24)).toBe('insufficient');
  });
});

describe('findCatalogItem / partnerCount / APP_TAB_BY_SERVICE', () => {
  it('zna Multikino, nie zna SRV-NIEMA', () => {
    expect(findCatalogItem('SRV-04')?.price).toBe(25);
    expect(findCatalogItem('SRV-NIEMA')).toBeUndefined();
  });
  it('liczy unikalnych partnerów bez Eliton', () => {
    expect(partnerCount([
      item({ partner: 'Eliton' }), item({ partner: 'Profitowi' }), item({ partner: 'Profitowi' }), item({ partner: 'Orange' }), item({}),
    ])).toBe(2);
  });
  it('mapuje cztery aplikacje na zakładki', () => {
    expect(APP_TAB_BY_SERVICE['SRV-MENTAL-01']).toBe('WELLBEING');
    expect(APP_TAB_BY_SERVICE['SRV-LEGAL-01']).toBe('LEGAL');
    expect(APP_TAB_BY_SERVICE['SRV-SECURE-01']).toBe('SECURE_MESSENGER');
    expect(APP_TAB_BY_SERVICE['SRV-VAULT-01']).toBe('DIGITAL_VAULT');
  });
});
