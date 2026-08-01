// Dedup pracownikow po imionach i nazwiskach — fallback gdy brak numeru paszportu.
// Cudzoziemcy bywaja wpisywani w roznej kolejnosci czlonow (imie/nazwisko zamienione)
// i z rozna pisownia koncowki (VILCHES / VILCHEZ) — normalizacja to koryguje.
// Zrodlo BBS: commit d64c657.

// UWAGA (swiadomy kompromis): zrownanie koncowego 's'/'z' jest celowo agresywne —
// da falszywe trafienie dla dwoch ROZNYCH osob, ktorych nazwiska roznia sie wylacznie
// ostatnia litera (np. "Perez" vs "Perex", "Ramos" vs "Ramoz"). Akceptujemy to ryzyko,
// bo koszt falszywego alarmu (koordynator dostaje pytanie "czy to ta sama osoba?")
// jest niski, a koszt przeoczonego duplikatu (VILCHES/VILCHEZ z produkcji) wysoki.
//
// Uwaga implementacyjna: polskie Ł/ł NIE dekomponuje sie pod Unicode NFD
// (w odroznieniu od a-ogonek, c-acute, n-acute, o-acute, s-acute, z-acute, z-dot),
// wiec trzeba je zamienic na 'l' recznie PRZED normalizacja NFD.
export function normTok(s: string | null | undefined): string {
  const base = (s ?? '')
    .toLowerCase()
    .replace(/\u0142/g, 'l')
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
