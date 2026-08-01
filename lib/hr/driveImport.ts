// ── Import katalogu pracowników z Google Drive (folder publiczny „każdy z linkiem") ──
// Bez klucza API: listowanie przez widok embeddedfolderview, pobieranie przez
// uc?export=download (z obsługą strony potwierdzenia dla większych plików).
import { OCR_TO_EMPLOYEE, langFromCountry, type OcrResult } from './ocr';

export interface DriveEntry { id: string; name: string; isFolder: boolean }

export function extractDriveFolderId(url: string): string | null {
  const m = url.match(/folders\/([\w-]{10,})/) || url.match(/[?&]id=([\w-]{10,})/);
  return m ? m[1] : null;
}

export async function listDriveFolder(folderId: string): Promise<DriveEntry[]> {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!r.ok) throw new Error(`Google Drive odpowiedział ${r.status} — sprawdź, czy katalog ma dostęp „każdy z linkiem"`);
  const html = await r.text();
  const entries: DriveEntry[] = [];
  // bloki wpisów: id="entry-<ID>" ... href="...(/folders/|/file/d/)..." ... flip-entry-title">NAZWA<
  const re = /id="entry-([\w-]+)"[\s\S]*?href="([^"]+)"[\s\S]*?flip-entry-title">([^<]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    entries.push({ id: m[1], name: decodeHtml(m[3].trim()), isFolder: m[2].includes('/folders/') });
  }
  return entries;
}

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export async function downloadDriveFile(fileId: string, maxBytes = 8 * 1024 * 1024): Promise<{ buf: Buffer; contentType: string } | null> {
  const tryUrls = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ];
  for (const url of tryUrls) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
      if (!r.ok) continue;
      const ct = r.headers.get('content-type') || 'application/octet-stream';
      if (ct.includes('text/html')) continue; // strona potwierdzenia — spróbuj następnego URL
      const ab = await r.arrayBuffer();
      if (ab.byteLength === 0 || ab.byteLength > maxBytes) return null;
      return { buf: Buffer.from(ab), contentType: ct.split(';')[0].trim() };
    } catch { /* spróbuj kolejnego wariantu */ }
  }
  return null;
}

// „Nazwisko Imię (Drugie)" z nazwy folderu → zgadnięcie pól (OCR i tak nadpisze)
export function guessNameFromFolder(folderName: string): { first: string; last: string } {
  const words = folderName.replace(/[_.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return { last: words[0], first: words.slice(1).join(' ') };
  return { last: folderName.trim() || '(import Drive)', first: '—' };
}

// Czysta funkcja budująca dane NOWEJ karty kandydata z importu Drive: dane z OCR
// (paszport/karta pobytu/…) ZAWSZE wygrywają, nazwa folderu jest fallbackiem WYŁĄCZNIE
// per-pole, gdy OCR nic nie odczytał dla first_name/last_name (bez tego nazwiska w
// formacie „NAZWISKA IMIONA" z nazwy folderu lądowałyby w złych kolumnach). Wartości
// puste/białe znaki z OCR są traktowane jak brak danych, nie jak realny odczyt.
export function buildImportPatch(agg: OcrResult, guess: { first: string; last: string }): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const [ocrKey, col] of Object.entries(OCR_TO_EMPLOYEE)) {
    const raw = (agg as any)[ocrKey];
    const s = raw == null ? '' : String(raw).trim();
    if (s) patch[col] = s;
  }
  if (!patch.first_name) {
    const g = (guess.first || '').trim();
    if (g) patch.first_name = g;
  }
  if (!patch.last_name) {
    const g = (guess.last || '').trim();
    if (g) patch.last_name = g;
  }
  // auto-język dokumentów wg obywatelstwa (tylko gdy sami go nie wpisaliśmy wyżej)
  if (!patch.language) {
    const lang = langFromCountry(agg.nationality ?? patch.country_of_origin);
    if (lang) patch.language = lang;
  }
  return patch;
}
