import type { CalcConfig, KupTyp, Pracownik, TypUmowy, TrybSkladek, WynikJednostkowy } from './types';
import { obliczPit } from './pit';
import { obliczZdrowotna, obliczZusPracownik } from './zus';

function wyznaczKup(brutto: number, typUmowy: TypUmowy, kupTyp: KupTyp, config: CalcConfig): number {
  if (typUmowy === 'UZ') {
    if (kupTyp === 'PROC_50') return (brutto * config.pit.uzKupAutorskie) / 100;
    return (brutto * config.pit.uzKupProc) / 100;
  }
  // UOP
  if (kupTyp === 'PODWYZSZONE') return config.pit.kupPodwyzszone;
  return config.pit.kupStandard;
}

function wyznaczStawkePit(podstawaRoczna: number, pitMode: string, config: CalcConfig): number {
  if (pitMode === 'FLAT_0') return 0;
  if (pitMode === 'FLAT_12') return config.pit.prog1Stawka;
  if (pitMode === 'FLAT_32') return config.pit.prog2Stawka;
  // AUTO
  return podstawaRoczna <= config.pit.prog1Limit ? config.pit.prog1Stawka : config.pit.prog2Stawka;
}

export function obliczNettoZBrutto(
  brutto: number,
  pracownik: Pick<Pracownik, 'typUmowy' | 'trybSkladek' | 'choroboweAktywne' | 'pit2' | 'ulgaMlodych' | 'kupTyp' | 'pitMode'>,
  config: CalcConfig
): WynikJednostkowy {
  const { typUmowy, trybSkladek, choroboweAktywne, pit2, ulgaMlodych, kupTyp, pitMode } = pracownik;

  const zusPracownik = obliczZusPracownik(brutto, typUmowy, trybSkladek, choroboweAktywne, config);
  const podstawaZdrowotnej = brutto - zusPracownik.suma;
  const zdrowotna = obliczZdrowotna(podstawaZdrowotnej, trybSkladek, config);
  const kup = wyznaczKup(brutto, typUmowy, kupTyp, config);
  const podstawaPit = Math.max(0, brutto - zusPracownik.suma - kup);
  // Approx roczna podstawa (×12 for bracket check)
  const stawka = wyznaczStawkePit(podstawaPit * 12, pitMode, config);
  const pit = obliczPit(podstawaPit, pit2, ulgaMlodych, stawka);
  const netto = brutto - zusPracownik.suma - zdrowotna - pit;

  return { brutto, zusPracownik, zdrowotna, pit, kup, podstawaPit, netto };
}

/**
 * Binary search: finds gross salary that yields the target net income (±0.01 PLN).
 */
export function znajdzBruttoDlaNetto(
  nettoDocelowe: number,
  pracownik: Pick<Pracownik, 'typUmowy' | 'trybSkladek' | 'choroboweAktywne' | 'pit2' | 'ulgaMlodych' | 'kupTyp' | 'pitMode'>,
  config: CalcConfig
): WynikJednostkowy {
  let lo = nettoDocelowe * 0.8;
  let hi = nettoDocelowe * 2.5;
  let best = obliczNettoZBrutto(hi, pracownik, config);

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const wynik = obliczNettoZBrutto(mid, pracownik, config);
    if (Math.abs(wynik.netto - nettoDocelowe) < 0.005) return wynik;
    if (wynik.netto < nettoDocelowe) lo = mid;
    else { hi = mid; best = wynik; }
  }

  // Fine-grained scan in ±5 PLN band
  const center = best.brutto;
  let closest = best;
  for (let delta = -500; delta <= 500; delta++) {
    const b = center + delta * 0.01;
    const w = obliczNettoZBrutto(b, pracownik, config);
    if (Math.abs(w.netto - nettoDocelowe) < Math.abs(closest.netto - nettoDocelowe)) closest = w;
  }
  return closest;
}
