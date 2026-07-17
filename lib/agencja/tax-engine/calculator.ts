import type {
  CalcConfig, Firma, GlobalneWyniki, Pracownik,
  PodsumowanieWynikow, WynikPracownika, ZusPracodawcaBreakdown
} from './types';
import { DEFAULT_CONFIG } from './constants';
import { znajdzBruttoDlaNetto, obliczNettoZBrutto } from './grossUp';
import { obliczZusPracodawca } from './zus';

function emptyPracodawca(): ZusPracodawcaBreakdown {
  return { emerytalna: 0, rentowa: 0, wypadkowa: 0, fp: 0, fgsp: 0, suma: 0 };
}

function obliczKosztPracodawcy(brutto: number, zusPracodawca: ZusPracodawcaBreakdown): number {
  return brutto + zusPracodawca.suma;
}

export function obliczPracownika(
  p: Pracownik,
  config: CalcConfig,
  provisionPct: number,
  globalWypadkowa: number
): WynikPracownika {
  const wypadkowa = p.stawkaWypadkowa ?? globalWypadkowa;

  // ── Standard model (full gross = nettoDocelowe back-calculated)
  const stdWynik = znajdzBruttoDlaNetto(p.nettoDocelowe, p, config);
  const stdZusPracodawca = obliczZusPracodawca(
    stdWynik.brutto, p.typUmowy, p.trybSkladek,
    wypadkowa, p.skladkaFP, p.skladkaFGSP, config
  );
  const stdKoszt = obliczKosztPracodawcy(stdWynik.brutto, stdZusPracodawca);

  // ── Split model (Eliton Prime)
  // Part 1: zasadnicza (base, UOP/UZ standard ZUS)
  const nettoZasadnicza = Math.max(p.nettoZasadnicza, config.minNettoUZ);
  const zasadWynik = znajdzBruttoDlaNetto(nettoZasadnicza, p, config);
  const zasadZusPracodawca = obliczZusPracodawca(
    zasadWynik.brutto, p.typUmowy, p.trybSkladek,
    wypadkowa, p.skladkaFP, p.skladkaFGSP, config
  );

  // Part 2: swiadczenie (benefit portion, UZ with zero ZUS)
  const nettoSwiadczenie = Math.max(0, p.nettoDocelowe - nettoZasadnicza);
  const swiadczParams: Pracownik = {
    ...p,
    typUmowy: 'UZ',
    trybSkladek: 'STUDENT_UZ', // ZUS-free
    choroboweAktywne: false,
    kupTyp: 'PROC_20',
  };
  const swiadWynik = nettoSwiadczenie > 0
    ? znajdzBruttoDlaNetto(nettoSwiadczenie, swiadczParams, config)
    : obliczNettoZBrutto(0, swiadczParams, config);
  const swiadZusPracodawca = obliczZusPracodawca(
    swiadWynik.brutto, 'UZ', 'STUDENT_UZ',
    0, false, false, config
  );

  const splitNetto = zasadWynik.netto + swiadWynik.netto;
  const splitKoszt = obliczKosztPracodawcy(zasadWynik.brutto, zasadZusPracodawca)
    + obliczKosztPracodawcy(swiadWynik.brutto, swiadZusPracodawca);

  const oszczednoscBrutto = stdKoszt - splitKoszt;
  const prowizja = (swiadWynik.brutto * provisionPct) / 100;
  const oszczednoscNetto = oszczednoscBrutto - prowizja;

  return {
    pracownikId: p.id,
    // Standard
    standardBrutto: stdWynik.brutto,
    standardZusPracownik: stdWynik.zusPracownik,
    standardZusPracodawca: stdZusPracodawca,
    standardZdrowotna: stdWynik.zdrowotna,
    standardPit: stdWynik.pit,
    standardNetto: stdWynik.netto,
    standardKosztPracodawcy: stdKoszt,
    // Split
    splitBruttoZasadnicza: zasadWynik.brutto,
    splitBruttoSwiadczenie: swiadWynik.brutto,
    splitZusPracownikZasadnicza: zasadWynik.zusPracownik,
    splitZusPracownikSwiadczenie: swiadWynik.zusPracownik,
    splitZusPracodawcaZasadnicza: zasadZusPracodawca,
    splitZusPracodawcaSwiadczenie: swiadZusPracodawca,
    splitZdrowotna: zasadWynik.zdrowotna + swiadWynik.zdrowotna,
    splitPit: zasadWynik.pit + swiadWynik.pit,
    splitNetto,
    splitKosztPracodawcy: splitKoszt,
    // Savings
    oszczednoscBrutto,
    prowizja: Math.max(0, prowizja),
    oszczednoscNetto,
  };
}

export function obliczGlobalnie(
  pracownicy: Pracownik[],
  firma: Firma,
  provisionPct: number,
  config: CalcConfig = DEFAULT_CONFIG
): GlobalneWyniki {
  const szczegoly = pracownicy.map(p =>
    obliczPracownika(p, config, provisionPct, firma.stawkaWypadkowa)
  );

  const sumaKosztStandard = szczegoly.reduce((a, w) => a + w.standardKosztPracodawcy, 0);
  const sumaKosztSplit = szczegoly.reduce((a, w) => a + w.splitKosztPracodawcy, 0);
  const sumaBruttoSwiadczen = szczegoly.reduce((a, w) => a + w.splitBruttoSwiadczenie, 0);
  const oszczednoscBrutto = sumaKosztStandard - sumaKosztSplit;
  const prowizja = szczegoly.reduce((a, w) => a + w.prowizja, 0);
  const oszczednoscNetto = oszczednoscBrutto - prowizja;
  const sredniaOszczednoscNaEtat = szczegoly.length > 0 ? oszczednoscNetto / szczegoly.length : 0;

  const podsumowanie: PodsumowanieWynikow = {
    sumaKosztStandard,
    sumaKosztSplit,
    sumaBruttoSwiadczen,
    oszczednoscBrutto,
    prowizja,
    oszczednoscNetto,
    oszczednoscRoczna: oszczednoscNetto * 12,
    sredniaOszczednoscNaEtat,
  };

  return { szczegoly, podsumowanie };
}
