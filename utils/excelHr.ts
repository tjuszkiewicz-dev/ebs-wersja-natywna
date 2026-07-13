// Excel utilities for HR panel
// Szablon (generateExcelTemplate) + eksport pracowników (exportActiveEmployees)
// używają ExcelJS dla pełnej obsługi kolorów/stylów.
// Parse pliku wejściowego nadal przez SheetJS (lżejszy, tylko odczyt).
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { isValidIBAN, normalizeIBAN } from '@/lib/iban';

export interface HrExcelRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  pesel: string;
  amount: number;
  email: string;
  department?: string;
  position?: string;
  iban?: string;
  contractType?: string;
  phoneNumber?: string;
  street?: string;
  zipCode?: string;
  city?: string;
  hireDate?: string;
  errors: string[];
  isValid: boolean;
}

const VALID_PESEL = /^\d{11}$/;

function validatePesel(pesel: string): boolean {
  if (!VALID_PESEL.test(pesel)) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const digits = pesel.split('').map(Number);
  const checksum = weights.reduce((sum, w, i) => sum + w * digits[i], 0);
  return (10 - (checksum % 10)) % 10 === digits[10];
}

export async function generateExcelTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EBS — Eliton Benefits System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Lista pracowników', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Szerokości kolumn — identyczne jak w eksporcie aktywnych pracowników
  ws.columns = HEADERS.map(([, wch]) => ({ width: wch }));

  // Wiersz 1 — nagłówki z kolorami
  HEADERS.forEach(([label], idx) => {
    let color = COLOR_GREEN;
    if (idx === 3) color = COLOR_GREEN_LITE;
    else if (idx >= 9 && idx <= 12) color = COLOR_BLUE;
    else if (idx >= 13) color = COLOR_ORANGE;
    applyHeaderCell(ws, idx + 1, label, color);
  });
  ws.getRow(1).height = 32;

  // 1000 pustych wierszy z kolorami identycznymi jak nagłówki
  for (let r = 2; r <= 1001; r++) {
    const exRow = ws.getRow(r);
    exRow.height = 18;
    HEADERS.forEach(([, ], idx) => {
      let color = COLOR_GREEN;
      if (idx === 3) color = COLOR_GREEN_LITE;
      else if (idx >= 9 && idx <= 12) color = COLOR_BLUE;
      else if (idx >= 13) color = COLOR_ORANGE;
      const cell = exRow.getCell(idx + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'hair', color: { argb: 'FFCCCCCC' } },
        right:  { style: 'hair', color: { argb: 'FFCCCCCC' } },
      };
    });
  }

  // Autofiltr
  ws.autoFilter = { from: 'A1', to: 'O1' };

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `szablon_lista_pracownikow_${today}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Szablon kartoteki (bez kolumny "Zamówienie voucherów") ────────────────────
const KARTOTEKA_HEADERS: [string, number][] = [
  ['Imię',              14],
  ['Nazwisko',          18],
  ['PESEL',             13],
  ['Email',             28],
  ['Ulica',             26],
  ['Kod pocztowy',      13],
  ['Miasto',            18],
  ['Telefon',           14],
  ['Dział',             18],
  ['Stanowisko',        22],
  ['Typ umowy',         16],
  ['Data zatrudnienia', 17],
  ['IBAN',              30],
  ['Status IBAN',       16],
];

function getKartotekaColor(idx: number): string {
  if (idx >= 12) return COLOR_ORANGE;
  if (idx >= 8)  return COLOR_BLUE;
  return COLOR_GREEN;
}

export async function generateKartotekaTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EBS — Eliton Benefits System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Kartoteka pracowników', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = KARTOTEKA_HEADERS.map(([, wch]) => ({ width: wch }));

  KARTOTEKA_HEADERS.forEach(([label], idx) => {
    applyHeaderCell(ws, idx + 1, label, getKartotekaColor(idx));
  });
  ws.getRow(1).height = 32;

  for (let r = 2; r <= 1001; r++) {
    const exRow = ws.getRow(r);
    exRow.height = 18;
    KARTOTEKA_HEADERS.forEach((_, idx) => {
      const cell = exRow.getCell(idx + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: getKartotekaColor(idx) } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'hair', color: { argb: 'FFCCCCCC' } },
        right:  { style: 'hair', color: { argb: 'FFCCCCCC' } },
      };
    });
  }

  const lastCol = String.fromCharCode(64 + KARTOTEKA_HEADERS.length);
  ws.autoFilter = { from: 'A1', to: `${lastCol}1` };

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `szablon_kartoteka_${today}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ActiveEmployeeRow {
  firstName: string;
  lastName: string;
  pesel: string;
  amount?: number; // nowa opcjonalna kwota
  email: string;
  street: string;
  zipCode: string;
  city: string;
  phoneNumber: string;
  department: string;
  position: string;
  contractType: string;
  hireDate: string;
  iban: string;
  ibanVerified: string;
}

// ── Kolory (ARGB hex, bez '#') ────────────────────────────────────────────────
const COLOR_GREEN      = 'FFB7E1CD'; // pastelowy zielony  A–H
const COLOR_GREEN_LITE = 'FFD4EEE0'; // jaśniejszy zielony I
const COLOR_BLUE       = 'FFB7D4F0'; // pastelowy niebieski J–M
const COLOR_ORANGE     = 'FFFFE0B2'; // pastelowy pomarańczowy N–O

function applyHeaderCell(
  ws: ExcelJS.Worksheet,
  col: number,
  value: string,
  argb: string,
) {
  const cell = ws.getRow(1).getCell(col);
  cell.value = value;
  cell.font = { bold: true, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFAAAAAA' } },
    bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
    left:   { style: 'thin', color: { argb: 'FFAAAAAA' } },
    right:  { style: 'thin', color: { argb: 'FFAAAAAA' } },
  };
}

function applyDataCell(
  cell: ExcelJS.Cell,
  argb: string,
) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border = {
    top:    { style: 'hair', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
    left:   { style: 'hair', color: { argb: 'FFCCCCCC' } },
    right:  { style: 'hair', color: { argb: 'FFCCCCCC' } },
  };
}

const MAX_COLUMNS = 15; // Ile wierszy jest w nagłówkach

const HEADERS: [string, number][] = [
  ['Imię',                   14], // 0
  ['Nazwisko',               18], // 1
  ['PESEL',                  13], // 2
  ['Zamówienie voucherów',   22], // 3
  ['Email',                  28], // 4
  ['Ulica',                  26], // 5
  ['Kod pocztowy',           13], // 6
  ['Miasto',                 18], // 7
  ['Telefon',                14], // 8
  ['Dział',                  18], // 9
  ['Stanowisko',             22], // 10
  ['Typ umowy',              16], // 11
  ['Data zatrudnienia',      17], // 12
  ['IBAN',                   30], // 13
  ['Status IBAN',            16], // 14
];

export async function exportActiveEmployees(
  employees: ActiveEmployeeRow[],
  companyName: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EBS — Eliton Benefits System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Aktywni pracownicy', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Szerokości kolumn
  ws.columns = HEADERS.map(([, wch]) => ({ width: wch }));

  // Nagłówki
  HEADERS.forEach(([label], idx) => {
      let color = COLOR_GREEN;
      if (idx === 3) color = COLOR_GREEN_LITE;
      else if (idx >= 9 && idx <= 12) color = COLOR_BLUE;
      else if (idx >= 13) color = COLOR_ORANGE;

    applyHeaderCell(ws, idx + 1, label, color);
  });
  ws.getRow(1).height = 32;

  // Dane
  for (const e of employees) {
    const rowData = [
      e.firstName,
      e.lastName,
      e.pesel,
      e.amount || '', // Zamówienie voucherów
      e.email,
      e.street,
      e.zipCode,
      e.city,
      e.phoneNumber,
      e.department,
      e.position,
      e.contractType,
      e.hireDate,
      e.iban,
      e.ibanVerified,
    ];
    const exRow = ws.addRow(rowData);
    exRow.height = 18;
    rowData.forEach((_, idx) => {
      // Przypisz kolory w oparciu o kolumnę
      // Kolumny:
      // 0-4 (A-E): Imię, Nazwisko, PESEL, Kwota, Email (Zielone) 
      //    (Z czego indeks 3 czyli 'Kwota' jasnozielona)
      // 5-8 (F-I): Ulica, Kod, Miasto, Telefon (Zwykłe zielone z poprzedniego adresu)
      // 9-12 (J-M): Dział, Stanow., Umowa, Data (Niebieskie)
      // 13-14 (N-O): IBAN (Pomarańczowe)
      
      let color = COLOR_GREEN;
      if (idx === 3) color = COLOR_GREEN_LITE;
      else if (idx >= 9 && idx <= 12) color = COLOR_BLUE;
      else if (idx >= 13) color = COLOR_ORANGE;

      applyDataCell(exRow.getCell(idx + 1), color);
    });
  }

  // Autofiltr na wierszu nagłówkowym
  ws.autoFilter = { from: 'A1', to: 'O1' };

  const today = new Date().toISOString().slice(0, 10);
  const safeName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `aktywni_pracownicy_${safeName}_${today}.xlsx`;

  // Pobieranie w przeglądarce
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export interface EmployeeCredentialRow {
  name: string;
  email: string;
  tempPassword: string | null;
  pesel: string;
  department: string;
  position: string;
}

export function exportEmployeeCredentials(employees: EmployeeCredentialRow[], companyName: string): void {
  const header = ['Imię i Nazwisko', 'Login (e-mail)', 'Hasło tymczasowe', 'PESEL', 'Dział', 'Stanowisko'];
  const rows = employees.map(e => [
    e.name,
    e.email,
    e.tempPassword ?? '— brak (zresetuj ręcznie)',
    e.pesel,
    e.department,
    e.position,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 26 }, { wch: 14 }, { wch: 22 }, { wch: 26 }];

  for (let c = 0; c < header.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dostępy pracowników');

  const today = new Date().toISOString().slice(0, 10);
  const safeName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  XLSX.writeFile(wb, `dostepy_pracownicy_${safeName}_${today}.xlsx`);
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findHeaderIndex(headerRow: any[], candidates: string[]): number | undefined {
  const normalizedHeaders = headerRow.map((h) => normalizeHeader(String(h ?? '')));
  const normalizedCandidates = candidates.map(normalizeHeader);

  for (const candidate of normalizedCandidates) {
    const exact = normalizedHeaders.findIndex((h) => h === candidate);
    if (exact >= 0) return exact;

    const partial = normalizedHeaders.findIndex(
      (h) => h.includes(candidate) || candidate.includes(h),
    );
    if (partial >= 0) return partial;
  }

  return undefined;
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePeselValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toString().padStart(11, '0');
  }
  return String(value ?? '').replace(/\D+/g, '');
}

/**
 * Normalizuje datę z Excela do formatu YYYY-MM-DD akceptowanego przez PostgreSQL DATE.
 * Obsługuje:
 *  - liczby (seriale Excela: 1 = 1900-01-01)
 *  - "DD.MM.YYYY", "DD/MM/YYYY"
 *  - "YYYY-MM-DD" (już poprawny format)
 *  - ciągi liczbowe (serial jako string)
 * Zwraca pusty string jeśli nie udało się sparsować — wartość zostanie zapisana jako NULL.
 */
function normalizeHireDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  // Excel serial number (date stored as number)
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    // Excel epoch: Dec 30, 1899 in UTC
    const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  const str = String(value).trim();
  if (!str) return '';

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYY.MM.DD or YYYY/MM/DD (already handled above for YYYY-MM-DD)
  const ymd = str.match(/^(\d{4})[./](\d{2})[./](\d{2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m}-${d}`;
  }

  // Numeric string — treat as Excel serial
  const numVal = Number(str);
  if (Number.isFinite(numVal) && numVal > 0) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(numVal) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  return ''; // unparseable → will become NULL in DB
}

export async function parseExcelFile(file: File): Promise<HrExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerRow = raw[0] ?? [];
  const colIdx = {
    firstName: findHeaderIndex(headerRow, ['Imię', 'Imie']),
    lastName: findHeaderIndex(headerRow, ['Nazwisko']),
    pesel: findHeaderIndex(headerRow, ['PESEL']),
    amount: findHeaderIndex(headerRow, ['Zamówienie voucherów', 'Zamowienie voucherow', 'Kwota voucherów', 'Kwota voucherow']),
    email: findHeaderIndex(headerRow, ['Email', 'Email (wymagany)']),
    street: findHeaderIndex(headerRow, ['Ulica', 'Adres']),
    zipCode: findHeaderIndex(headerRow, ['Kod pocztowy', 'Kod']),
    city: findHeaderIndex(headerRow, ['Miasto']),
    phoneNumber: findHeaderIndex(headerRow, ['Telefon', 'Nr telefonu']),
    department: findHeaderIndex(headerRow, ['Dział', 'Dzial']),
    position: findHeaderIndex(headerRow, ['Stanowisko']),
    contractType: findHeaderIndex(headerRow, ['Typ umowy', 'Umowa']),
    hireDate: findHeaderIndex(headerRow, ['Data zatrudnienia']),
    iban: findHeaderIndex(headerRow, ['IBAN']),
    ibanVerified: findHeaderIndex(headerRow, ['Status IBAN']),
  };

  const pick = (row: any[], headerIndex: number | undefined, fallbackIndex: number) => {
    return row[headerIndex ?? fallbackIndex];
  };

  // Skip header row
  const dataRows = raw.slice(1).filter(r => r.some((cell: any) => cell !== ''));

  return dataRows.map((row, idx) => {
    const errors: string[] = [];
    const firstName = String(pick(row, colIdx.firstName, 0) ?? '').trim();
    const lastName = String(pick(row, colIdx.lastName, 1) ?? '').trim();
    const pesel = normalizePeselValue(pick(row, colIdx.pesel, 2)).trim();
    const amountRaw = pick(row, colIdx.amount, 3);
    const email = String(pick(row, colIdx.email, 4) ?? '').trim();
    const street = String(pick(row, colIdx.street, 5) ?? '').trim();
    const zipCode = String(pick(row, colIdx.zipCode, 6) ?? '').trim();
    const city = String(pick(row, colIdx.city, 7) ?? '').trim();
    const phoneNumber = String(pick(row, colIdx.phoneNumber, 8) ?? '').trim();
    const department = String(pick(row, colIdx.department, 9) ?? '').trim();
    const position = String(pick(row, colIdx.position, 10) ?? '').trim();
    const contractType = String(pick(row, colIdx.contractType, 11) ?? '').trim();
    const hireDate = normalizeHireDate(pick(row, colIdx.hireDate, 12));
    const iban = String(pick(row, colIdx.iban, 13) ?? '').trim();
    const ibanVerified = String(pick(row, colIdx.ibanVerified, 14) ?? '').trim();

    if (!firstName) errors.push('Brak imienia');
    if (!lastName) errors.push('Brak nazwiska');
    if (!pesel) {
      errors.push('Brak numeru PESEL');
    } else if (!validatePesel(pesel)) {
      errors.push('Nieprawidłowy PESEL (błędna cyfra kontrolna lub format)');
    }
    if (!email) {
      errors.push('Brak adresu email (pole wymagane)');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Nieprawidłowy format adresu email');
    }

    const amount = parseAmount(amountRaw);
    if (amount <= 0) errors.push('Kwota voucherów musi być większa od zera');

    if (iban && !isValidIBAN(normalizeIBAN(iban))) errors.push('Nieprawidłowy numer IBAN (weryfikacja mod-97)');

    return {
      rowIndex: idx + 2, // 1-indexed, skipping header
      firstName,
      lastName,
      pesel,
      amount: isNaN(amount) ? 0 : amount,
      email,
      department,
      position,
      iban,
      contractType,
      phoneNumber,
      street,
      zipCode,
      city,
      hireDate,
      errors,
      isValid: errors.length === 0,
    };
  });
}

// ── Parser szablonu kartoteki (14 kolumn, bez "Zamówienie voucherów") ─────────
export async function parseKartotekaFile(file: File): Promise<HrExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerRow = raw[0] ?? [];
  const colIdx = {
    firstName:    findHeaderIndex(headerRow, ['Imię', 'Imie']),
    lastName:     findHeaderIndex(headerRow, ['Nazwisko']),
    pesel:        findHeaderIndex(headerRow, ['PESEL']),
    email:        findHeaderIndex(headerRow, ['Email']),
    street:       findHeaderIndex(headerRow, ['Ulica', 'Adres']),
    zipCode:      findHeaderIndex(headerRow, ['Kod pocztowy']),
    city:         findHeaderIndex(headerRow, ['Miasto']),
    phoneNumber:  findHeaderIndex(headerRow, ['Telefon', 'Nr telefonu']),
    department:   findHeaderIndex(headerRow, ['Dział', 'Dzial']),
    position:     findHeaderIndex(headerRow, ['Stanowisko']),
    contractType: findHeaderIndex(headerRow, ['Typ umowy', 'Umowa']),
    hireDate:     findHeaderIndex(headerRow, ['Data zatrudnienia']),
    iban:         findHeaderIndex(headerRow, ['IBAN']),
  };

  const pick = (row: any[], headerIndex: number | undefined, fallback: number) =>
    row[headerIndex ?? fallback];

  const dataRows = raw.slice(1).filter(r => r.some((cell: any) => cell !== ''));

  return dataRows.map((row, idx) => {
    const errors: string[] = [];
    const firstName    = String(pick(row, colIdx.firstName,    0) ?? '').trim();
    const lastName     = String(pick(row, colIdx.lastName,     1) ?? '').trim();
    const pesel        = normalizePeselValue(pick(row, colIdx.pesel, 2)).trim();
    const email        = String(pick(row, colIdx.email,        3) ?? '').trim();
    const street       = String(pick(row, colIdx.street,       4) ?? '').trim();
    const zipCode      = String(pick(row, colIdx.zipCode,      5) ?? '').trim();
    const city         = String(pick(row, colIdx.city,         6) ?? '').trim();
    const phoneNumber  = String(pick(row, colIdx.phoneNumber,  7) ?? '').trim();
    const department   = String(pick(row, colIdx.department,   8) ?? '').trim();
    const position     = String(pick(row, colIdx.position,     9) ?? '').trim();
    const contractType = String(pick(row, colIdx.contractType,10) ?? '').trim();
    const hireDate     = normalizeHireDate(pick(row, colIdx.hireDate,    11));
    const iban         = String(pick(row, colIdx.iban,        12) ?? '').trim();

    if (!firstName) errors.push('Brak imienia');
    if (!lastName)  errors.push('Brak nazwiska');
    if (!pesel) {
      errors.push('Brak numeru PESEL');
    } else if (!validatePesel(pesel)) {
      errors.push('Nieprawidłowy PESEL (błędna cyfra kontrolna lub format)');
    }
    if (!email) {
      errors.push('Brak adresu email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Nieprawidłowy format adresu email');
    }

    if (iban && !isValidIBAN(normalizeIBAN(iban))) errors.push('Nieprawidłowy numer IBAN (weryfikacja mod-97)');

    return {
      rowIndex: idx + 2,
      firstName, lastName, pesel,
      amount: 0,
      email, street, zipCode, city, phoneNumber,
      department, position, contractType, hireDate, iban,
      errors,
      isValid: errors.length === 0,
    };
  });
}
