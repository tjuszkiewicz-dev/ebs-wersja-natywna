// Znaczniki generatora dokumentów Agencji Pracy — {{klucz}} w treści szablonu
// podstawiany danymi pracownika z kartoteki. Wspólne dla edytora (klient) i API (serwer).

export interface DocPlaceholder { key: string; label: string }

// Pełne oficjalne imię i nazwisko (konwencja latynoska: 2 imiona + 2 nazwiska z paszportu)
export const fullName = (e: any) =>
  [e.first_name, e.second_name, e.last_name, e.second_last_name].filter(Boolean).join(' ');

// Adres zamieszkania pracownika = adres noclegu. Preferujemy pola STRUKTURALNE
// z bazy noclegowej (street/house_no/apartment_no/postal_code/city); dla starych
// rekordów z samym stringiem — splitAddress() poniżej.
export interface AddressParts {
  adres_zamieszkania: string | null; adres_ulica: string | null;
  adres_nr_domu: string | null; adres_nr_lokalu: string | null;
  adres_kod: string | null; adres_miejscowosc: string | null;
  adres_wojewodztwo: string | null; adres_powiat: string | null; adres_gmina: string | null; adres_poczta: string | null;
}
const EMPTY_ADDRESS: AddressParts = {
  adres_zamieszkania: null, adres_ulica: null, adres_nr_domu: null, adres_nr_lokalu: null,
  adres_kod: null, adres_miejscowosc: null, adres_wojewodztwo: null, adres_powiat: null, adres_gmina: null, adres_poczta: null,
};

export function accAddressParts(acc: any): AddressParts {
  if (!acc) return { ...EMPTY_ADDRESS };
  const hasParts = acc.street || acc.house_no || acc.postal_code || acc.city;
  if (hasParts) {
    // pełny adres do pól „adres zamieszkania" i map: „Ulica 12/3, 00-000 Miasto"
    const streetLine = [acc.street, acc.house_no ? String(acc.house_no) + (acc.apartment_no ? `/${acc.apartment_no}` : '') : null].filter(Boolean).join(' ').trim();
    const cityPart = [acc.postal_code, acc.city].filter(Boolean).join(' ').trim();
    const full = [streetLine, cityPart].filter(Boolean).join(', ') || acc.address || null;
    // w kwestionariuszu Ulica / Nr domu / Nr lokalu to OSOBNE pola — nie łączymy numeru w ulicę
    return {
      adres_zamieszkania: full,
      adres_ulica: acc.street || null,
      adres_nr_domu: acc.house_no ? String(acc.house_no) : null,
      adres_nr_lokalu: acc.apartment_no ? String(acc.apartment_no) : null,
      adres_kod: acc.postal_code || null,
      adres_miejscowosc: acc.city || null,
      adres_wojewodztwo: acc.voivodeship || null,
      adres_powiat: acc.county || null,
      adres_gmina: acc.commune || null,
      adres_poczta: acc.post_office || null,
    };
  }
  // stary rekord: tylko złożony string — rozbijamy heurystyką (bez numeru osobno)
  const sp = splitAddress(acc.address);
  return { ...EMPTY_ADDRESS, adres_zamieszkania: acc.address || null, adres_ulica: sp.adres_ulica, adres_kod: sp.adres_kod, adres_miejscowosc: sp.adres_miejscowosc };
}

// Rozbicie adresu noclegu na pola kwestionariusza: „ul. Przykładowa 12, 55-080 Miasto"
// → ulica+numer / kod pocztowy / miejscowość. Gdy format nietypowy — pola zostają puste
// (w PDF wyjdą kropki), a pełny adres i tak jest w {{adres_zamieszkania}}.
export function splitAddress(address?: string | null): { adres_ulica: string | null; adres_kod: string | null; adres_miejscowosc: string | null } {
  const out = { adres_ulica: null as string | null, adres_kod: null as string | null, adres_miejscowosc: null as string | null };
  const a = (address || '').trim();
  if (!a) return out;
  const zip = a.match(/\b\d{2}-\d{3}\b/);
  if (zip) {
    out.adres_kod = zip[0];
    const afterZip = a.slice(a.indexOf(zip[0]) + zip[0].length).replace(/^[\s,]+/, '').split(',')[0].trim();
    if (afterZip) out.adres_miejscowosc = afterZip;
  }
  const firstSeg = a.split(',')[0].trim();
  if (firstSeg && !firstSeg.includes(out.adres_kod || '@@')) out.adres_ulica = firstSeg;
  // format „Miasto, ul. X 12" — ulica w drugim segmencie
  if (out.adres_ulica && /^\p{Lu}[\p{L}\s-]+$/u.test(out.adres_ulica) && !/\d/.test(out.adres_ulica)) {
    const seg2 = (a.split(',')[1] || '').trim();
    if (/\d/.test(seg2) && !seg2.match(/\d{2}-\d{3}/)) { out.adres_miejscowosc = out.adres_miejscowosc || out.adres_ulica; out.adres_ulica = seg2; }
  }
  // format „97-500 Miasto, Ulica 2" — kod na początku, ulica w drugim segmencie
  if (!out.adres_ulica) {
    const seg2 = (a.split(',')[1] || '').trim();
    if (seg2 && !/\b\d{2}-\d{3}\b/.test(seg2)) out.adres_ulica = seg2;
  }
  return out;
}

export const DOC_PLACEHOLDERS: DocPlaceholder[] = [
  { key: 'imie', label: 'Imię (pierwsze)' },
  { key: 'drugie_imie', label: 'Drugie imię' },
  { key: 'imiona', label: 'Imiona (oba)' },
  { key: 'nazwisko', label: 'Nazwiska (oba — oficjalne)' },
  { key: 'pierwsze_nazwisko', label: 'Pierwsze nazwisko (po ojcu)' },
  { key: 'drugie_nazwisko', label: 'Drugie nazwisko (po matce)' },
  { key: 'nazwisko_rodowe', label: 'Nazwisko rodowe' },
  { key: 'imie_nazwisko', label: 'Pełne imię i nazwisko (wszystko)' },
  { key: 'paszport_wazny_do', label: 'Paszport ważny do' },
  { key: 'data_urodzenia', label: 'Data urodzenia' },
  { key: 'miejsce_urodzenia', label: 'Miejsce urodzenia' },
  { key: 'nr_paszportu', label: 'Nr paszportu' },
  { key: 'pesel', label: 'PESEL' },
  { key: 'nr_konta', label: 'Nr konta bankowego' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'email', label: 'E-mail' },
  { key: 'kraj_pochodzenia', label: 'Kraj pochodzenia' },
  { key: 'zawod', label: 'Zawód / specjalizacja' },
  { key: 'kontrakt', label: 'Kontrakt / obiekt' },
  { key: 'grupa', label: 'Grupa' },
  { key: 'nocleg', label: 'Nocleg (nazwa)' },
  { key: 'nocleg_adres', label: 'Nocleg (adres)' },
  { key: 'adres_zamieszkania', label: 'Adres zamieszkania (= adres noclegu)' },
  { key: 'adres_ulica', label: 'Adres zam. — ulica' },
  { key: 'adres_nr_domu', label: 'Adres zam. — nr domu' },
  { key: 'adres_nr_lokalu', label: 'Adres zam. — nr lokalu' },
  { key: 'adres_kod', label: 'Adres zam. — kod pocztowy' },
  { key: 'adres_miejscowosc', label: 'Adres zam. — miejscowość' },
  { key: 'adres_wojewodztwo', label: 'Adres zam. — województwo' },
  { key: 'adres_powiat', label: 'Adres zam. — powiat' },
  { key: 'adres_gmina', label: 'Adres zam. — gmina' },
  { key: 'adres_poczta', label: 'Adres zam. — poczta' },
  { key: 'karta_pobytu_nr', label: 'Nr karty pobytu' },
  { key: 'karta_pobytu_do', label: 'Karta pobytu ważna do' },
  { key: 'pozwolenie_nr', label: 'Nr pozwolenia na pracę' },
  { key: 'pozwolenie_do', label: 'Pozwolenie ważne do' },
  { key: 'wiza_do', label: 'Wiza ważna do' },
  { key: 'zus_data', label: 'Data zgłoszenia do ZUS' },
  { key: 'dzis', label: 'Dzisiejsza data' },
];

const fmtDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('pl-PL');
};

// Buduje mapę znacznik→wartość z rekordu pracownika (null = brak danych).
// docDate (ISO 'YYYY-MM-DD') — data drukowana w dokumentach; brak → dzisiaj.
export function buildDocData(e: any, docDate?: string | null): Record<string, string | null> {
  return {
    imie: e.first_name || null,
    drugie_imie: e.second_name || null,
    imiona: [e.first_name, e.second_name].filter(Boolean).join(' ') || null,
    // {{nazwisko}} = OBA nazwiska — oficjalne dane paszportowe wymagane na umowach
    nazwisko: [e.last_name, e.second_last_name].filter(Boolean).join(' ') || null,
    pierwsze_nazwisko: e.last_name || null,
    drugie_nazwisko: e.second_last_name || null,
    nazwisko_rodowe: e.family_name || null,
    imie_nazwisko: fullName(e) || null,
    paszport_wazny_do: fmtDate(e.passport_expiry),
    // (adres_ulica/adres_kod/adres_miejscowosc dokładane niżej przez splitAddress)
    data_urodzenia: fmtDate(e.birth_date),
    miejsce_urodzenia: e.birth_place || null,
    nr_paszportu: e.passport_number || null,
    pesel: e.pesel || null,
    nr_konta: e.bank_account || null,
    telefon: e.phone || null,
    email: e.email || null,
    kraj_pochodzenia: e.country_of_origin || null,
    zawod: e.profession || null,
    kontrakt: e.contract?.name || null,
    grupa: e.team || null,
    nocleg: e.accommodation?.name || null,
    nocleg_adres: e.accommodation?.address || null,
    // reguła firmowa: adres zamieszkania pracownika = adres przydzielonego noclegu
    ...accAddressParts(e.accommodation),
    karta_pobytu_nr: e.residence_card_number || null,
    karta_pobytu_do: fmtDate(e.residence_card_expiry),
    pozwolenie_nr: e.work_permit_number || null,
    pozwolenie_do: fmtDate(e.work_permit_expiry),
    wiza_do: fmtDate(e.visa_expiry),
    zus_data: fmtDate(e.zus_registration_date),
    dzis: (docDate ? fmtDate(docDate) : null) || new Date().toLocaleDateString('pl-PL'),
  };
}

// Znaczniki użyte w treści szablonu
export function extractPlaceholders(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/\{\{([a-z_]+)\}\}/g)) found.add(m[1]);
  return [...found];
}

// Podstawienie: brakujące dane → kropkowana linia (do ręcznego uzupełnienia na wydruku)
export function fillPlaceholders(html: string, data: Record<string, string | null>): { html: string; missing: string[] } {
  const missing: string[] = [];
  const out = html.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    const v = data[key];
    if (v == null || v === '') { if (!missing.includes(key)) missing.push(key); return '……………………'; }
    return v;
  });
  return { html: out, missing };
}
