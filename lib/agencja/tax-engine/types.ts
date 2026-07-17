export type TypUmowy = 'UOP' | 'UZ';
export type TrybSkladek = 'PELNE' | 'STUDENT_UZ' | 'INNY_TYTUL';
export type KupTyp = 'STANDARD' | 'PODWYZSZONE' | 'PROC_20' | 'PROC_50';
export type PitMode = 'AUTO' | 'FLAT_0' | 'FLAT_12' | 'FLAT_32';

export interface CalcConfig {
  zus: {
    pracownik: { emerytalna: number; rentowa: number; chorobowa: number };
    pracodawca: { emerytalna: number; rentowa: number; wypadkowa: number; fp: number; fgsp: number };
    zdrowotna: number;
  };
  pit: {
    prog1Limit: number;
    prog1Stawka: number;
    prog2Stawka: number;
    kupStandard: number;
    kupPodwyzszone: number;
    uzKupProc: number;
    uzKupAutorskie: number;
    pit2Kwota: number;
  };
  minBrutto: number;
  minNetto: number;
  minNettoUZ: number;
  prowizja: { standard: number; plus: number };
  offerValidDays: number;
}

export interface Pracownik {
  id: string;
  imie: string;
  nazwisko: string;
  dataUrodzenia?: string;
  typUmowy: TypUmowy;
  trybSkladek: TrybSkladek;
  choroboweAktywne: boolean;
  pit2: number;
  ulgaMlodych: boolean;
  kupTyp: KupTyp;
  nettoDocelowe: number;
  nettoZasadnicza: number;
  pitMode: PitMode;
  skladkaFP: boolean;
  skladkaFGSP: boolean;
  stawkaWypadkowa?: number;
}

export interface ZusBreakdown {
  emerytalna: number;
  rentowa: number;
  chorobowa: number;
  suma: number;
}

export interface ZusPracodawcaBreakdown {
  emerytalna: number;
  rentowa: number;
  wypadkowa: number;
  fp: number;
  fgsp: number;
  suma: number;
}

export interface WynikJednostkowy {
  brutto: number;
  zusPracownik: ZusBreakdown;
  zdrowotna: number;
  pit: number;
  kup: number;
  podstawaPit: number;
  netto: number;
}

export interface WynikPracownika {
  pracownikId: string;
  // Standard model
  standardBrutto: number;
  standardZusPracownik: ZusBreakdown;
  standardZusPracodawca: ZusPracodawcaBreakdown;
  standardZdrowotna: number;
  standardPit: number;
  standardNetto: number;
  standardKosztPracodawcy: number;
  // Split model (Eliton Prime)
  splitBruttoZasadnicza: number;
  splitBruttoSwiadczenie: number;
  splitZusPracownikZasadnicza: ZusBreakdown;
  splitZusPracownikSwiadczenie: ZusBreakdown;
  splitZusPracodawcaZasadnicza: ZusPracodawcaBreakdown;
  splitZusPracodawcaSwiadczenie: ZusPracodawcaBreakdown;
  splitZdrowotna: number;
  splitPit: number;
  splitNetto: number;
  splitKosztPracodawcy: number;
  // Savings
  oszczednoscBrutto: number;
  prowizja: number;
  oszczednoscNetto: number;
}

export interface PodsumowanieWynikow {
  sumaKosztStandard: number;
  sumaKosztSplit: number;
  sumaBruttoSwiadczen: number;
  oszczednoscBrutto: number;
  prowizja: number;
  oszczednoscNetto: number;
  oszczednoscRoczna: number;
  sredniaOszczednoscNaEtat: number;
}

export interface GlobalneWyniki {
  szczegoly: WynikPracownika[];
  podsumowanie: PodsumowanieWynikow;
}

export interface Firma {
  nazwa: string;
  nip: string;
  adres?: string;
  kodPocztowy?: string;
  miasto?: string;
  email?: string;
  telefon?: string;
  osobaKontaktowa?: string;
  okres: string;
  stawkaWypadkowa: number;
}
