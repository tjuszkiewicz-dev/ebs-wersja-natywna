import type { CalcConfig } from './types';

export const DEFAULT_CONFIG: CalcConfig = {
  zus: {
    pracownik: { emerytalna: 9.76, rentowa: 1.5, chorobowa: 2.45 },
    pracodawca: { emerytalna: 9.76, rentowa: 6.5, wypadkowa: 1.67, fp: 2.45, fgsp: 0.1 },
    zdrowotna: 9.0,
  },
  pit: {
    prog1Limit: 120000,
    prog1Stawka: 12,
    prog2Stawka: 32,
    kupStandard: 250,
    kupPodwyzszone: 300,
    uzKupProc: 20,
    uzKupAutorskie: 50,
    pit2Kwota: 300,
  },
  minBrutto: 4806,
  minNetto: 3606,
  minNettoUZ: 840,
  prowizja: { standard: 28, plus: 26 },
  offerValidDays: 14,
};
