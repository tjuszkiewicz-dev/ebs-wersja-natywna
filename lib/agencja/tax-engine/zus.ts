import type { CalcConfig, TrybSkladek, TypUmowy, ZusBreakdown, ZusPracodawcaBreakdown } from './types';

export function obliczZusPracownik(
  brutto: number,
  typUmowy: TypUmowy,
  trybSkladek: TrybSkladek,
  choroboweAktywne: boolean,
  config: CalcConfig
): ZusBreakdown {
  if (trybSkladek === 'STUDENT_UZ' || trybSkladek === 'INNY_TYTUL') {
    return { emerytalna: 0, rentowa: 0, chorobowa: 0, suma: 0 };
  }

  const r = config.zus.pracownik;
  const emerytalna = (brutto * r.emerytalna) / 100;
  const rentowa = (brutto * r.rentowa) / 100;
  const chorobowa = typUmowy === 'UOP' || (typUmowy === 'UZ' && choroboweAktywne)
    ? (brutto * r.chorobowa) / 100
    : 0;
  const suma = emerytalna + rentowa + chorobowa;

  return { emerytalna, rentowa, chorobowa, suma };
}

export function obliczZusPracodawca(
  brutto: number,
  typUmowy: TypUmowy,
  trybSkladek: TrybSkladek,
  stawkaWypadkowa: number,
  naliczajFP: boolean,
  naliczajFGSP: boolean,
  config: CalcConfig
): ZusPracodawcaBreakdown {
  if (trybSkladek === 'STUDENT_UZ' || trybSkladek === 'INNY_TYTUL') {
    return { emerytalna: 0, rentowa: 0, wypadkowa: 0, fp: 0, fgsp: 0, suma: 0 };
  }

  const r = config.zus.pracodawca;
  const emerytalna = (brutto * r.emerytalna) / 100;
  const rentowa = (brutto * r.rentowa) / 100;
  const wypadkowa = (brutto * stawkaWypadkowa) / 100;
  const fp = naliczajFP ? (brutto * r.fp) / 100 : 0;
  const fgsp = naliczajFGSP ? (brutto * r.fgsp) / 100 : 0;
  const suma = emerytalna + rentowa + wypadkowa + fp + fgsp;

  return { emerytalna, rentowa, wypadkowa, fp, fgsp, suma };
}

export function obliczZdrowotna(podstawa: number, trybSkladek: TrybSkladek, config: CalcConfig): number {
  if (trybSkladek === 'STUDENT_UZ') return 0;
  return (podstawa * config.zus.zdrowotna) / 100;
}
