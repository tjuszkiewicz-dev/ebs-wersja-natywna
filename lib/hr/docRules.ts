// Reguły dokumentów kościelnych wg instrukcji zleceniodawcy (2026-07-06).
// Wspólne dla klienta (generator: liczba egzemplarzy, etykiety) i serwera (stopka pełnomocnictw).

// LICZBA EGZEMPLARZY do druku:
//  ×2 — umowa (PL i obca), zaświadczenie Zakonu, dekrety powołania/delegacji
//  ×1 — pozostałe (oświadczenia, kwestionariusze, wszystkie pełnomocnictwa)
export function docCopies(name: string): number {
  const n = (name || '').toLowerCase();
  if (/umowa|zaświadczenie|zaswiadczenie|dekret/.test(n)) return 2;
  return 1;
}

// Czy dokument jest pełnomocnictwem (dostaje stopkę: nazwa + numeracja stron).
export function isPelnomocnictwo(name: string): boolean {
  return /pełnomocnictwo|pelnomocnictwo|pelnmaciej|pelnpiotr/i.test(name || '');
}

// Nazwa pełnomocnictwa do STOPKI (numeracja stron dodawana osobno przy renderze).
// null → dokument nie jest pełnomocnictwem (brak stopki).
export function pelnomocnictwoFooter(name: string): string | null {
  const n = (name || '').toLowerCase();
  if (/pelnmaciej/.test(n)) return 'Pełnomocnictwo — P. Maciej Lisowski';
  if (/pelnpiotr/.test(n)) return 'Pełnomocnictwo — mec. Piotr Rał';
  if (/pełnomocnictwo|pelnomocnictwo/.test(n)) return name.trim(); // ogólne + dwujęzyczne ZUS
  return null;
}
