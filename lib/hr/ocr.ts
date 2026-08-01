// OCR dokumentów pracowniczych przez Claude (vision) — czyta paszporty, decyzje PESEL,
// karty pobytu, pozwolenia, dokumenty bankowe i zwraca ustrukturyzowane pola.
// Server-only (ANTHROPIC_API_KEY).
import { getAnthropic, AI_MODEL } from '@/lib/anthropic';

export const OCR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const OCR_PDF_TYPE = 'application/pdf';

// Telefony/przeglądarki często wysyłają PDF-y i zdjęcia jako application/octet-stream —
// wtedy typ ustalamy z rozszerzenia nazwy pliku, a w ostateczności z sygnatury bajtów.
const EXT_TO_TYPE: Record<string, string> = { pdf: OCR_PDF_TYPE, jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export function isGenericType(contentType?: string | null): boolean {
  const ct = (contentType || '').toLowerCase();
  return !ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream';
}

export function resolveOcrType(contentType?: string | null, filename?: string | null): string | null {
  const ct = (contentType || '').toLowerCase();
  if (OCR_IMAGE_TYPES.includes(ct) || ct === OCR_PDF_TYPE) return ct;
  if (!isGenericType(ct)) return null; // realny, ale nieobsługiwany typ (np. HEIC)
  const ext = (filename || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && EXT_TO_TYPE[ext]) || null;
}

export function sniffOcrType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return OCR_PDF_TYPE;
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
  return null;
}

export interface OcrResult {
  doc_type?: string | null;
  first_name?: string | null; second_name?: string | null;
  last_name?: string | null; second_last_name?: string | null; family_name?: string | null;
  passport_number?: string | null; passport_expiry?: string | null;
  birth_date?: string | null; birth_place?: string | null; nationality?: string | null; gender?: string | null;
  pesel?: string | null; bank_account?: string | null;
  residence_card_number?: string | null; residence_card_expiry?: string | null;
  work_permit_number?: string | null; work_permit_expiry?: string | null;
  visa_expiry?: string | null;
}

const PROMPT = `Czytasz zeskanowany dokument pracownika-cudzoziemca zatrudnionego w Polsce (paszport, decyzja o nadaniu PESEL, karta pobytu, pozwolenie na pracę, wiza, dokument bankowy, umowa itp.).

Wyodrębnij WSZYSTKIE dane, które faktycznie widzisz w dokumencie, i zwróć WYŁĄCZNIE poprawny JSON (bez markdown, bez komentarzy) o polach:
{
 "doc_type": "passport|pesel|residence_card|work_permit|visa|bank|other",
 "first_name": "PIERWSZE imię (Format Z Wielkiej Litery)",
 "second_name": "DRUGIE imię lub null",
 "last_name": "PIERWSZE nazwisko (apellido paterno — po ojcu)",
 "second_last_name": "DRUGIE nazwisko (apellido materno — po matce) lub null",
 "family_name": "nazwisko rodowe/panieńskie TYLKO gdy jawnie wskazane w dokumencie, inaczej null",
 "passport_number": "nr paszportu lub null",
 "passport_expiry": "data ważności paszportu YYYY-MM-DD lub null",
 "birth_date": "YYYY-MM-DD lub null",
 "birth_place": "miejsce urodzenia lub null",
 "nationality": "kraj po polsku, np. Kolumbia, Peru, lub null",
 "gender": "płeć: 'M' (mężczyzna) lub 'K' (kobieta) — w paszporcie pole Sex/Płeć oraz znak w MRZ (M=mężczyzna, F=kobieta); null jeśli brak",
 "pesel": "11 cyfr lub null",
 "bank_account": "nr rachunku (IBAN/26 cyfr) lub null",
 "residence_card_number": null lub nr karty pobytu,
 "residence_card_expiry": null lub YYYY-MM-DD,
 "work_permit_number": null lub nr pozwolenia na pracę,
 "work_permit_expiry": null lub YYYY-MM-DD,
 "visa_expiry": null lub data ważności wizy YYYY-MM-DD
}

Zasady: pola nieobecne w dokumencie = null (nie zgaduj). Imiona i nazwiska pisz Formatem Z Wielkiej Litery (nie WERSALIKAMI). Obcokrajowcy z Ameryki Łacińskiej mają zwykle DWA imiona i DWA nazwiska — rozdziel je do właściwych pól (nigdy nie łącz dwóch nazwisk w last_name). Daty zawsze YYYY-MM-DD.

KOLEJNOŚĆ PÓL W PASZPORCIE (krytyczne): w paszportach — zwłaszcza kolumbijskich i innych latynoskich — najpierw wydrukowane są NAZWISKA (Apellidos / Surname[s]), a dopiero POD NIMI imiona (Nombres / Given names). Nie zakładaj kolejności imię-nazwisko z samego układu tekstu. ROZSTRZYGA strefa MRZ na dole: format P<KRAJNAZWISKO1<NAZWISKO2<<IMIE1<IMIE2 — wszystko PRZED podwójnym '<<' to nazwiska (last_name, second_last_name), wszystko PO '<<' to imiona (first_name, second_name), w kolejności z dokumentu. Przykład: P<COLGONZALEZ<RODRIGUEZ<<PAULA<ANDREA → last_name=Gonzalez, second_last_name=Rodriguez, first_name=Paula, second_name=Andrea. Przy rozbieżności między polami tekstowymi a MRZ zaufaj MRZ.

DATA WAŻNOŚCI PASZPORTU: skan często zawiera KILKA dokumentów naraz (np. u góry cédula/dowód z własną „Fecha de vencimiento", niżej paszport). passport_expiry bierz WYŁĄCZNIE ze strony danych paszportu (Date of expiry / Fecha de vencimiento przy danych paszportu) i ZWERYFIKUJ z 2. linią MRZ: po numerze paszportu i kraju idzie data urodzenia (RRMMDD), cyfra kontrolna, płeć (M/F), a ZARAZ PO płci data ważności RRMMDD (np. ...F3411067... → 2034-11-06). Przy rozbieżności zaufaj MRZ — nigdy dacie z innego dokumentu na skanie.`;

const anthropic = getAnthropic;

export async function extractFromDocument(buf: Buffer, contentType: string): Promise<OcrResult> {
  const data = buf.toString('base64');
  const block: any = contentType === OCR_PDF_TYPE
    ? { type: 'document', source: { type: 'base64', media_type: OCR_PDF_TYPE, data } }
    : { type: 'image', source: { type: 'base64', media_type: contentType, data } };

  const msg = await anthropic().messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }],
  });

  const text = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) throw new Error('Model nie zwrócił JSON');
  const parsed = JSON.parse(jsonStr) as OcrResult;
  // normalizacja pustych
  for (const k of Object.keys(parsed) as (keyof OcrResult)[]) {
    const v = parsed[k];
    if (v == null || String(v).trim() === '' || String(v).toLowerCase() === 'null') parsed[k] = null;
  }
  // płeć → 'M' | 'K' (model bywa niesforny: F/female/kobieta/mężczyzna…)
  if (parsed.gender != null) {
    const g = String(parsed.gender).trim().toLowerCase();
    parsed.gender = /^(m|mężczyzna|mezczyzna|male|masculino|hombre)$/.test(g) ? 'M'
      : /^(k|f|kobieta|female|femenino|mujer)$/.test(g) ? 'K' : null;
  }
  return parsed;
}

// Priorytet źródła per typ dokumentu — paszport najbardziej wiarygodny dla tożsamości
const DOC_PRIORITY: Record<string, number> = { passport: 0, residence_card: 1, work_permit: 2, visa: 3, pesel: 4, bank: 5, other: 9 };

// Scal wyniki wielu dokumentów: pierwsze niepuste wg priorytetu
export function aggregateResults(results: OcrResult[]): OcrResult {
  const sorted = [...results].sort((a, b) => (DOC_PRIORITY[a.doc_type ?? 'other'] ?? 9) - (DOC_PRIORITY[b.doc_type ?? 'other'] ?? 9));
  const agg: OcrResult = {};
  for (const r of sorted) {
    for (const k of Object.keys(r) as (keyof OcrResult)[]) {
      if (k === 'doc_type') continue;
      if (agg[k] == null && r[k] != null) agg[k] = r[k];
    }
  }
  return agg;
}

// Mapowanie pól OCR → kolumny hr_employees
export const OCR_TO_EMPLOYEE: Record<string, string> = {
  first_name: 'first_name', second_name: 'second_name', last_name: 'last_name', second_last_name: 'second_last_name', family_name: 'family_name',
  passport_number: 'passport_number', passport_expiry: 'passport_expiry',
  birth_date: 'birth_date', birth_place: 'birth_place', nationality: 'country_of_origin', gender: 'gender',
  pesel: 'pesel', bank_account: 'bank_account',
  residence_card_number: 'residence_card_number', residence_card_expiry: 'residence_card_expiry',
  work_permit_number: 'work_permit_number', work_permit_expiry: 'work_permit_expiry',
  visa_expiry: 'visa_expiry',
};

// Domyślny język dokumentów wg kraju z paszportu (Latynosi→es, kraje b. ZSRR→ru)
export function langFromCountry(country: string | null | undefined): 'es' | 'en' | 'ru' | 'pl' | null {
  const c = String(country ?? '').toLowerCase();
  if (!c) return null;
  if (/kolumb|colomb|peru|wenezuel|venezuel|meksyk|mexic|ekwador|ecuador|boliw|argentyn|chile|gwatemal|hondur|nikarag|salwador|paragw|urugw|kuba|dominikan|kostaryk|panam/.test(c)) return 'es';
  if (/ukrain|bialorus|białoru|belarus|rosja|russi|kazach|gruzj|armeni|azerbejdz|moldaw|mołdaw|uzbek|kirgi|tadzyk|tadżyk/.test(c)) return 'ru';
  if (/polsk|poland/.test(c)) return 'pl';
  return null;
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// Normalizacja numerów dokumentów (paszport, PESEL, IBAN, karta pobytu…) do porównań —
// usuwa spacje/myślniki/kropki i ujednolica wielkość liter, żeby "AB-123 456" == "ab123456".
export function normalizeDocNumber(v: any): string {
  return String(v ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}
const normNum = normalizeDocNumber;

export interface MergeOutcome {
  applied: Record<string, string>;                                  // puste pola → wpisane
  conflicts: { field: string; current: string; extracted: string }[]; // różnice → do decyzji
}

export function mergeIntoEmployee(employee: any, agg: OcrResult): MergeOutcome {
  const applied: Record<string, string> = {};
  const conflicts: MergeOutcome['conflicts'] = [];
  for (const [ocrKey, col] of Object.entries(OCR_TO_EMPLOYEE)) {
    const extracted = (agg as any)[ocrKey];
    if (extracted == null) continue;
    const current = employee[col];
    if (current == null || String(current).trim() === '') {
      applied[col] = String(extracted);
    } else {
      const numeric = ['passport_number', 'pesel', 'bank_account', 'residence_card_number', 'work_permit_number'].includes(ocrKey);
      const same = numeric ? normNum(current) === normNum(extracted) : norm(current) === norm(extracted);
      if (!same) conflicts.push({ field: col, current: String(current), extracted: String(extracted) });
    }
  }
  // auto-język dokumentów wg obywatelstwa (tylko gdy pole puste — nie nadpisujemy ręcznego wyboru)
  if (!employee.language) {
    const lang = langFromCountry(agg.nationality ?? applied.country_of_origin ?? employee.country_of_origin);
    if (lang) applied.language = lang;
  }
  return { applied, conflicts };
}
