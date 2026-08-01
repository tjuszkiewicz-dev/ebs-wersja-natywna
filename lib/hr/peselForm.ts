// Wypełnianie oficjalnego wniosku o nadanie numeru PESEL (formularz EL/W/1, AcroForm)
// danymi pracownika. Zachowuje oryginalny rządowy PDF — nakładamy tylko wartości pól.
import { PDFDocument, NoSuchFieldError, UnexpectedFieldTypeError } from 'pdf-lib';

// WinAnsi (font domyślny pdf-lib) nie koduje polskich liter specyficznych — transliterujemy
// TYLKO je (ł,ż,ź,ś,ć,ń,ą,ę). Hiszpańskie akcenty (á,é,í,ó,ú,ü,ñ) są w WinAnsi → zostają.
const PL: Record<string, string> = { 'ł': 'l', 'Ł': 'L', 'ż': 'z', 'Ż': 'Z', 'ź': 'z', 'Ź': 'Z', 'ś': 's', 'Ś': 'S', 'ć': 'c', 'Ć': 'C', 'ń': 'n', 'Ń': 'N', 'ą': 'a', 'Ą': 'A', 'ę': 'e', 'Ę': 'E' };

// Cyrylica (ukraińska/rosyjska) → łacinka — pole może dostać wklejoną/wpisaną wartość cyrylicą
// (np. z adresu OCR-owanego z dokumentu wschodniego pracownika). Transliteracja uproszczona
// (nie ISO-9/paszportowa) — to pole miejscowości podpisu, nie dane tożsamości do weryfikacji 1:1.
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i',
  ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ъ: '', ы: 'y', э: 'e', ё: 'e',
};
const CYR_FULL: Record<string, string> = { ...CYR };
for (const [k, v] of Object.entries(CYR)) {
  CYR_FULL[k.toUpperCase()] = v.charAt(0).toUpperCase() + v.slice(1);
}

// Typografia „inteligentna" (myślniki, cudzysłowy, twarda spacja) → warianty ASCII z WinAnsi.
const TYPO: Record<string, string> = { '—': '-', '–': '-', '‑': '-', '„': '"', '”': '"', '“': '"', '‘': "'", '’': "'", ' ': ' ' };

// Ostatnia linia obrony: WinAnsi (Windows-1252) to zasadniczo Latin-1 + garść symboli w 0x80-0x9F
// (już pokryte przez TYPO/PL/CYR powyżej). Wszystko poza drukowalnym ASCII i Latin-1 Supplement
// (emoji, CJK, arabski, nieprzewidziane symbole) zamieniamy na „?" — pdf-lib rzuca wyjątek przy
// próbie zakodowania takiego znaku (encodeUnicodeCodePoint), a to NIE MOŻE cicho ubić pola
// pkt 8 wniosku urzędowego.
const winAnsiSafe = (s: string): string => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

const wa = (s: unknown): string => {
  if (s == null) return '';
  const withTypo = String(s).replace(/[—–‑„”“‘’ ]/g, c => TYPO[c] ?? c);
  const withCyr = withTypo.replace(/[а-яіїєґА-ЯІЇЄҐ]/g, c => CYR_FULL[c] ?? c);
  const withPl = withCyr.replace(/[łŁżŻźŹśŚćĆńŃąĄęĘ]/g, c => PL[c] ?? c);
  return winAnsiSafe(withPl);
};
const up = (s: unknown): string => wa(s).toUpperCase();

const dateParts = (iso?: string | null) => {
  if (!iso) return { d: '', m: '', y: '' };
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return { d: '', m: '', y: '' };
  return { d: String(dt.getDate()).padStart(2, '0'), m: String(dt.getMonth() + 1).padStart(2, '0'), y: String(dt.getFullYear()) };
};

// Pola, które da się wypełnić z kartoteki — do raportu braków w UI
export function peselMissingFields(emp: any): string[] {
  const miss: string[] = [];
  if (!emp.first_name) miss.push('imię');
  if (!emp.last_name && !emp.second_last_name) miss.push('nazwisko');
  if (!emp.birth_date) miss.push('data urodzenia');
  if (!emp.country_of_origin) miss.push('kraj / obywatelstwo');
  if (!emp.passport_number) miss.push('nr paszportu');
  if (!(emp.accommodation?.street || emp.accommodation?.city || emp.accommodation?.address)) miss.push('adres (nocleg)');
  return miss;
}

export async function fillPeselForm(blank: Uint8Array, emp: any, docDate?: string | null, opts?: { signCity?: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(blank);
  const form = pdf.getForm();

  const setT = (name: string, value: string) => {
    try {
      const f = form.getTextField(name);
      const max = f.getMaxLength?.();
      f.setText(typeof max === 'number' && max > 0 ? value.slice(0, max) : value);
    } catch (e) {
      // brak pola / zły typ pola w tym PDF-ie — oczekiwane, pomijamy po cichu.
      // KAŻDY inny błąd (np. znak nieobsłużony przez WinAnsi mimo sanitizacji w wa()) MUSI
      // trafić do logów serwera — cicha pusta rubryka w urzędowym wniosku to błąd krytyczny.
      if (!(e instanceof NoSuchFieldError) && !(e instanceof UnexpectedFieldTypeError)) {
        console.error(`[peselForm] pole "${name}" nie zostało wypełnione (wartość: "${value}"):`, e instanceof Error ? e.message : e);
      }
    }
  };
  const check = (name: string) => { try { form.getCheckBox(name).check(); } catch { /* */ } };

  const bd = dateParts(emp.birth_date);
  const pe = dateParts(emp.passport_expiry);
  const sig = docDate ? new Date(docDate) : new Date();
  const sigD = String(sig.getDate()).padStart(2, '0');
  const sigM = String(sig.getMonth() + 1).padStart(2, '0');
  const sigY = String(sig.getFullYear()).slice(-2); // pole podpisu ma format RR

  const imiona = [emp.first_name, emp.second_name].filter(Boolean).join(' ');
  const nazwiska = [emp.last_name, emp.second_last_name].filter(Boolean).join(' ');
  const acc = emp.accommodation || {};
  const kod = String(acc.postal_code || '').replace(/[^\d]/g, '');
  const kod2 = kod.slice(0, 2);
  const kod3 = kod.slice(2, 5);
  const miejscowosc = acc.city || '';
  const ulica = acc.street || '';
  const nrDomu = acc.house_no != null ? String(acc.house_no) : '';
  const nrLokalu = acc.apartment_no != null ? String(acc.apartment_no) : '';

  // 1. Wnioskodawca (cudzoziemiec składa wniosek sam o siebie)
  setT('wnioskodawca imię', up(imiona));
  setT('wnioskodawca nazwisko', up(nazwiska));
  setT('adres do korespondencji osoby, która składa wniosek ulica', up(ulica));
  setT('adres do korespondencji osoby, która składa wniosek numer domu', up(nrDomu));
  setT('adres do korespondencji osoby, która składa wniosek numer lokalu', up(nrLokalu));
  setT('adres do korespondencji osoby, która składa wniosek kod pocztowy dwie cyfry', kod2);
  setT('adres do korespondencji osoby, która składa wniosek kod pocztowy trzy cyfry', kod3);
  setT('adres do korespondencji osoby, która składa wniosek miejscowość', up(miejscowosc));

  // 2. Dane osoby, której dotyczy wniosek
  setT('dane osoby, której dotyczy wniosek  imię pierwsze', up(emp.first_name));
  setT('dane osoby, której dotyczy wniosek  imię drugie', up(emp.second_name));
  setT('dane osoby, której dotyczy wniosek  nazwisko', up(nazwiska));
  if (emp.gender === 'M') check('dane osoby, której dotyczy wniosek płeć mężczyzna');
  else if (emp.gender === 'K') check('dane osoby, której dotyczy wniosek płeć kobieta');
  setT('dane osoby, której dotyczy wniosek data urodzenia dzień', bd.d);
  setT('dane osoby, której dotyczy wniosek data urodzenia miesiąc', bd.m);
  setT('dane osoby, której dotyczy wniosek data urodzenia rok', bd.y);
  setT('dane osoby, której dotyczy wniosek data urodzenia kraj urodzenia', up(emp.country_of_origin));
  setT('dane osoby, której dotyczy wniosek data urodzenia kraj miejsca zamieszkania', up(emp.country_of_origin));
  check('dane osoby, której dotyczy wniosek data urodzenia obywatelstwo lub status inne');
  setT('dane osoby, której dotyczy wniosek data urodzenia obywatelstwo lub status podaj inne', up(emp.country_of_origin));

  // dokument podróży cudzoziemca (paszport)
  setT('dokument podróży cudzoziemca lub inny dokument potwierdzający tożsamość i obywatelstwo seria i numer', up(emp.passport_number));
  setT('dokument podróży cudzoziemca lub inny dokument potwierdzający tożsamość i obywatelstwo data ważności dzień', pe.d);
  setT('dokument podróży cudzoziemca lub inny dokument potwierdzający tożsamość i obywatelstwo data ważności miesiąc', pe.m);
  setT('dokument podróży cudzoziemca lub inny dokument potwierdzający tożsamość i obywatelstwo data ważności rok', pe.y);

  // 3. Dodatkowe dane (jeśli są)
  setT('dodatkowe dane osoby, której wniosek dotyczy nazwisko rodowe', up(emp.family_name));
  setT('dodatkowe dane osoby, której wniosek dotyczy miejsce urodzenia', up(emp.birth_place));

  // powiadomienie w formie papierowej (domyślne w formularzu — ustawiamy jawnie)
  check('przekazanie wnioskodawcy powiadomienia o nadaniu numeru PESEL papierowa');

  // podpisy (pkt 8) — miejscowość: ręczna z generatora (opts.signCity) nadpisuje;
  // brak podania → domyślnie jak dotąd, z adresu noclegu
  const signCity = opts?.signCity?.trim();
  setT('podpisy miejscowość', wa(signCity ? signCity : miejscowosc));
  setT('podpisy data dzień', sigD);
  setT('podpisy data miesiąc', sigM);
  setT('podpisy data rok', sigY);

  return pdf.save();
}
