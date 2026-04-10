// GET /api/companies/gus-lookup?nip=XXXXXXXXXX
//
// Pobiera dane firmy po NIP.
// Strategia:
//   1. GUS BIR/REGON (jeśli GUS_API_KEY w .env) — pełny katalog państwowy
//   2. MF Biała Lista VAT (zawsze, bez klucza) — dla czynnych podatników VAT
//
// Zwraca: { name, address_street, address_city, address_zip, nip, regon?, krs?, source }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';

// ── REGON/GUS BIR ─────────────────────────────────────────────────────────────
// GUS BIR: SOAP 1.2 + WS-Addressing (wymagane przez WCF endpoint)
// Rejestracja i klucz: https://api.stat.gov.pl/Home/RegonApi (bezpłatne)
const GUS_BASE_PROD = 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
const GUS_BASE_TEST = 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';

/** Wyodrębnia tekst z encji XML (&lt; → <) */
function xmlDecode(s: string): string {
  return s
    .replace(/&lt;/g,  '<')
    .replace(/&gt;/g,  '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#xD;/g, '');
}

/** Wyodrębnia wartość pojedynczego tagu XML */
function xmlTag(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim() ?? '';
}

/** Formatuje kod pocztowy GUS (5 cyfr → XX-XXX) */
function formatZip(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.length === 5 ? `${d.slice(0, 2)}-${d.slice(2)}` : raw;
}

/** Wywołanie SOAP GUS BIR z wymaganymi nagłówkami WS-Addressing */
async function gusSoap(
  baseUrl: string,
  action:  string,
  body:    string,
  extraHeaders: Record<string, string> = {},
) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml;charset=UTF-8',
      ...extraHeaders,
    },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  // Odpowiedź może być opakowana w MTOM (multipart) — wyodrębnij XML
  const xmlPart = text.includes('<s:Envelope')
    ? text.slice(text.indexOf('<s:Envelope'))
    : text;
  return { ok: res.ok, status: res.status, xml: xmlPart };
}

async function lookupViaGUS(nip: string) {
  const apiKey = process.env.GUS_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.GUS_TEST_MODE === 'true' ? GUS_BASE_TEST : GUS_BASE_PROD;

  // ── Krok 1: Zaloguj ────────────────────────────────────────────────────────
  const loginSoap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:ns="http://CIS/BIR/PUBL/2014/07"
               xmlns:wsa="http://www.w3.org/2005/08/addressing">
  <soap:Header>
    <wsa:To>${baseUrl}</wsa:To>
    <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj</wsa:Action>
  </soap:Header>
  <soap:Body>
    <ns:Zaloguj>
      <ns:pKluczUzytkownika>${apiKey}</ns:pKluczUzytkownika>
    </ns:Zaloguj>
  </soap:Body>
</soap:Envelope>`;

  const loginResp = await gusSoap(baseUrl, 'Zaloguj', loginSoap).catch(() => null);
  if (!loginResp?.ok) return null;

  const sid = xmlTag(loginResp.xml, 'ZalogujResult');
  if (!sid || sid === '0') return null;

  // ── Krok 2: DaneSzukajPodmioty ────────────────────────────────────────────
  const searchSoap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:ns="http://CIS/BIR/PUBL/2014/07"
               xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract"
               xmlns:wsa="http://www.w3.org/2005/08/addressing">
  <soap:Header>
    <wsa:To>${baseUrl}</wsa:To>
    <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
    <ns:pIdentyfikatorSesji>${sid}</ns:pIdentyfikatorSesji>
  </soap:Header>
  <soap:Body>
    <ns:DaneSzukajPodmioty>
      <ns:pParametryWyszukiwania>
        <dat:Nip>${nip}</dat:Nip>
      </ns:pParametryWyszukiwania>
    </ns:DaneSzukajPodmioty>
  </soap:Body>
</soap:Envelope>`;

  const searchResp = await gusSoap(baseUrl, 'DaneSzukajPodmioty', searchSoap, { sid }).catch(() => null);
  if (!searchResp?.ok) return null;

  // Wynik jest XML-escape'owany wewnątrz tagu DaneSzukajPodmiotyResult
  const rawResult  = xmlTag(searchResp.xml, 'DaneSzukajPodmiotyResult');
  if (!rawResult) return null;

  const innerXml = xmlDecode(rawResult);

  // Sprawdź czy są dane (ErrorCode 4 = brak wyników)
  const errorCode = xmlTag(innerXml, 'ErrorCode');
  if (errorCode && errorCode !== '0') return null;

  const name   = xmlTag(innerXml, 'Nazwa');
  if (!name) return null;

  const street = [xmlTag(innerXml, 'Ulica'), xmlTag(innerXml, 'NrNieruchomosci')]
    .filter(Boolean)
    .join(' ');
  const city   = xmlTag(innerXml, 'Miejscowosc');
  const zip    = formatZip(xmlTag(innerXml, 'KodPocztowy'));
  const regon  = xmlTag(innerXml, 'Regon') || xmlTag(innerXml, 'RegonLink') || null;

  return {
    name,
    address_street: street,
    address_city:   city,
    address_zip:    zip,
    nip,
    regon:          regon || null,
    krs:            null,
    source:         'gus_bir' as const,
  };
}

// ── MF Biała Lista VAT ────────────────────────────────────────────────────────
function parseAddress(raw: string | null | undefined) {
  if (!raw) return { street: '', city: '', zip: '' };
  const trimmed = raw.trim();
  const zipMatch = trimmed.match(/(\d{2}-\d{3})\s+(.+)$/);
  if (zipMatch) {
    const zip      = zipMatch[1];
    const city     = zipMatch[2].trim();
    const zipIndex = trimmed.lastIndexOf(zip);
    const street   = trimmed.slice(0, zipIndex).replace(/,\s*$/, '').trim();
    return { street, city, zip };
  }
  const lastComma = trimmed.lastIndexOf(',');
  if (lastComma !== -1) {
    return { street: trimmed.slice(0, lastComma).trim(), city: trimmed.slice(lastComma + 1).trim(), zip: '' };
  }
  return { street: trimmed, city: '', zip: '' };
}

async function lookupViaMF(nip: string) {
  const date = new Date().toISOString().slice(0, 10);
  const res  = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`, {
    headers: { Accept: 'application/json' },
    signal:  AbortSignal.timeout(8_000),
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MF API HTTP ${res.status}`);

  const json    = await res.json();
  const subject = json?.result?.subject;
  if (!subject) return null;

  const rawAddress = subject.workingAddress || subject.residenceAddress || '';
  const { street, city, zip } = parseAddress(rawAddress);

  return {
    name:           (subject.name ?? '') as string,
    address_street: street,
    address_city:   city,
    address_zip:    zip,
    nip:            (subject.nip  ?? nip) as string,
    regon:          (subject.regon ?? null) as string | null,
    krs:            (subject.krs  ?? null) as string | null,
    source:         'mf_whitelist' as const,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const nip = new URL(req.url).searchParams.get('nip') ?? '';
  if (!/^\d{10}$/.test(nip)) {
    return NextResponse.json({ error: 'NIP musi zawierać dokładnie 10 cyfr' }, { status: 400 });
  }

  try {
    // GUS BIR (REGON) → MF Biała Lista (fallback)
    const result = (await lookupViaGUS(nip)) ?? (await lookupViaMF(nip));

    if (!result) {
      return NextResponse.json(
        { error: 'Nie znaleziono firmy dla podanego NIP w rejestrach GUS/MF' },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Błąd połączenia z rejestrem' },
      { status: 502 },
    );
  }
}
