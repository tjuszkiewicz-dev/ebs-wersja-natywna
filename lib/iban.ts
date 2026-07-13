/**
 * Waliduje IBAN algorytmem mod-97 (ISO 13616). Ignoruje spacje i wielkość liter.
 * Akceptuje 15–34 znaki alfanumeryczne rozpoczynające się od 2-literowego kodu kraju + 2 cyfr.
 */
export function isValidIBAN(raw: string): boolean {
  const s = (raw || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rem = 0;
  for (let i = 0; i < numeric.length; i++) {
    rem = (rem * 10 + (numeric.charCodeAt(i) - 48)) % 97;
  }
  return rem === 1;
}

/** Formatuje IBAN w grupy po 4 znaki (do druku na dokumencie). */
export function formatIBAN(raw: string): string {
  return (raw || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Normalizuje numer konta do postaci IBAN: usuwa spacje, wielkie litery,
 * a polski 26-cyfrowy NRB (bez kodu kraju) poprzedza „PL".
 */
export function normalizeIBAN(raw: string): string {
  const s = (raw || '').replace(/\s+/g, '').toUpperCase();
  return /^\d{26}$/.test(s) ? `PL${s}` : s;
}
