// Dedup pracownikow po imionach i nazwiskach — fallback gdy brak numeru paszportu.
// Cudzoziemcy bywaja wpisywani w roznej kolejnosci czlonow (imie/nazwisko zamienione)
// i z rozna pisownia koncowki (VILCHES / VILCHEZ) — normalizacja to koryguje.
// Zrodlo BBS: commit d64c657.

// UWAGA (swiadomy kompromis): zrownanie koncowego 's'/'z' jest celowo agresywne —
// da falszywe trafienie dla dwoch ROZNYCH osob, ktorych nazwiska roznia sie wylacznie
// ostatnia litera (np. "Perez" vs "Perex", "Ramos" vs "Ramoz"). Akceptujemy to ryzyko,
// bo koszt falszywego alarmu (koordynator dostaje pytanie "czy to ta sama osoba?")
// jest niski, a koszt przeoczonego duplikatu (VILCHES/VILCHEZ z produkcji) wysoki.
// Zamierzone zachowanie utrwalone testem w nameMatch.test.ts (nie "naprawiac" bez decyzji).
//
// Uwaga implementacyjna: niektore litery Unicode NIE dekomponuja sie pod normalize('NFD')
// na litere bazowa + osobny znak diakrytyczny (w odroznieniu od a-ogonek, c-acute, n-acute,
// o-acute, s-acute, z-acute, z-dot czy wietnamskich znakow tonalnych/rogu — te dekomponuja
// sie poprawnie i po odfiltrowaniu non-ASCII zostaje wlasciwa litera bazowa). Takie litery
// trzeba RECZNIE stransliterowac PRZED normalize('NFD'), inaczej etap "usun non-ASCII"
// zgubi cala litere zamiast zamienic ja na odpowiednik ASCII (np. "Straße" -> "strae"
// zamiast "strasse", "Møller" -> "mller" zamiast "moller").
//
// Minimalny obslugiwany zestaw (jezyki istotne dla EBS: oferta niemieckojezyczna,
// pracownicy z Wietnamu, ogolnie popularne w agencjach pracy tymczasowej):
//   ł (polski)              -> l
//   ß (niemiecki, Eszett)   -> ss
//   ø (dunski/norweski)     -> o
//   đ (wietnamski)          -> d
//   æ (dunski/norweski)     -> ae
//   œ (francuski)           -> oe
//   þ (islandzki, thorn)    -> th
//   ð (islandzki, eth)      -> d
// Podmiana idzie PO toLowerCase(), wiec obsluguje tez wielkie litery wejsciowe.
export function normTok(s: string | null | undefined): string {
  const base = (s ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/ø/g, 'o')
    .replace(/đ/g, 'd')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/þ/g, 'th')
    .replace(/ð/g, 'd')
    .normalize('NFD')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^a-z]/g, '');
  return base.replace(/[sz]$/, '#'); // VILCHES / VILCHEZ traktujemy jak jedno
}

export function nameKey(e: {
  first_name?: string | null; second_name?: string | null;
  last_name?: string | null; second_last_name?: string | null;
}): string {
  return [e.first_name, e.second_name, e.last_name, e.second_last_name]
    .map(normTok).filter(Boolean).sort().join('|');
}
