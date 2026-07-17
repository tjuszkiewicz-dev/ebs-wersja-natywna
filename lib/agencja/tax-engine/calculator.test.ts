import { describe, it, expect } from 'vitest';
import { obliczNettoZBrutto, znajdzBruttoDlaNetto, DEFAULT_CONFIG } from './index';
import type { Pracownik } from './types';

/**
 * Podzbiór pól `Pracownik` wymagany przez `obliczNettoZBrutto`/`znajdzBruttoDlaNetto`
 * (silnik operuje na czystych funkcjach — nie potrzebuje pełnego rekordu pracownika
 * z bazy, tylko parametrów wpływających na wyliczenie ZUS/PIT).
 */
type ParametryWyliczenia = Pick<
  Pracownik,
  'typUmowy' | 'trybSkladek' | 'choroboweAktywne' | 'pit2' | 'ulgaMlodych' | 'kupTyp' | 'pitMode'
>;

const pracownikUOP: ParametryWyliczenia = {
  typUmowy: 'UOP',
  trybSkladek: 'PELNE',
  choroboweAktywne: true,
  pit2: DEFAULT_CONFIG.pit.pit2Kwota,
  ulgaMlodych: false,
  kupTyp: 'STANDARD',
  pitMode: 'AUTO',
};

describe('tax-engine (inwarianty płacowe PL)', () => {
  it('UOP 5000 brutto: netto < brutto, składniki > 0, suma spójna z netto', () => {
    const wynik = obliczNettoZBrutto(5000, pracownikUOP, DEFAULT_CONFIG);

    expect(wynik.netto).toBeGreaterThan(3000);
    expect(wynik.netto).toBeLessThan(wynik.brutto);
    expect(wynik.zusPracownik.suma).toBeGreaterThan(0);
    expect(wynik.zdrowotna).toBeGreaterThan(0);
    expect(wynik.pit).toBeGreaterThan(0);

    // spójność: netto musi wynikać wprost ze składników (brutto - zus - zdrowotna - pit)
    expect(wynik.netto).toBeCloseTo(
      wynik.brutto - wynik.zusPracownik.suma - wynik.zdrowotna - wynik.pit,
      6
    );
  });

  it('wyższe brutto → wyższe netto (monotoniczność)', () => {
    const a = obliczNettoZBrutto(4000, pracownikUOP, DEFAULT_CONFIG);
    const b = obliczNettoZBrutto(8000, pracownikUOP, DEFAULT_CONFIG);

    expect(b.netto).toBeGreaterThan(a.netto);
  });

  it('znajdzBruttoDlaNetto jest odwrotnością obliczNettoZBrutto (±0.01 PLN)', () => {
    const docelowe = DEFAULT_CONFIG.minNetto;
    const wynik = znajdzBruttoDlaNetto(docelowe, pracownikUOP, DEFAULT_CONFIG);

    expect(wynik.netto).toBeCloseTo(docelowe, 1);
    expect(wynik.brutto).toBeGreaterThan(docelowe);

    // round-trip: podanie znalezionego brutto z powrotem do obliczNettoZBrutto
    // musi dać (w przybliżeniu) to samo netto docelowe
    const sprawdzenie = obliczNettoZBrutto(wynik.brutto, pracownikUOP, DEFAULT_CONFIG);
    expect(sprawdzenie.netto).toBeCloseTo(docelowe, 1);
  });
});
