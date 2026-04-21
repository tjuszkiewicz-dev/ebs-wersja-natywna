// Excel utilities for HR panel
// Szablon (generateExcelTemplate) + eksport pracowników (exportActiveEmployees)
// używają ExcelJS dla pełnej obsługi kolorów/stylów.
// Parse pliku wejściowego nadal przez SheetJS (lżejszy, tylko odczyt).
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export interface HrExcelRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  pesel: string;
  amount: number;
  email: string;
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

export function generateExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Imię', 'Nazwisko', 'PESEL', 'Zamówienie voucherów', 'Email (wymagany)'],
    ['Jan', 'Kowalski', '90051209876', 100, 'jan.kowalski@firma.pl'],
    ['Anna', 'Nowak', '85030312345', 150, 'anna.nowak@firma.pl'],
  ]);
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lista pracowników');
  XLSX.writeFile(wb, 'szablon_lista_pracownikow.xlsx');
}

export interface ActiveEmployeeRow {
  firstName: string;
  lastName: string;
  pesel: string;
  // adres — kolumny D, E, F
  street: string;
  zipCode: string;
  city: string;
  // kontakt — kolumny G, H
  email: string;
  phoneNumber: string;
  // voucher — kolumna I (wyróżniona)
  // (puste — do uzupełnienia przez HR)
  // zatrudnienie — kolumny J–M
  department: string;
  position: string;
  contractType: string;
  hireDate: string;
  // finanse — kolumny N, O
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

// Mapowanie kolumna → kolor grupy
const COL_COLOR: Record<number, string> = {
  1: COLOR_GREEN,       // A  Imię
  2: COLOR_GREEN,       // B  Nazwisko
  3: COLOR_GREEN,       // C  PESEL
  4: COLOR_GREEN,       // D  Ulica
  5: COLOR_GREEN,       // E  Kod pocztowy
  6: COLOR_GREEN,       // F  Miasto
  7: COLOR_GREEN,       // G  Email
  8: COLOR_GREEN,       // H  Telefon
  9: COLOR_GREEN_LITE,  // I  Zamówienie voucherów
  10: COLOR_BLUE,       // J  Dział
  11: COLOR_BLUE,       // K  Stanowisko
  12: COLOR_BLUE,       // L  Typ umowy
  13: COLOR_BLUE,       // M  Data zatrudnienia
  14: COLOR_ORANGE,     // N  IBAN
  15: COLOR_ORANGE,     // O  Status IBAN
};

const HEADERS: [string, number][] = [
  ['Imię',                   14],
  ['Nazwisko',               18],
  ['PESEL',                  13],
  ['Ulica',                  26],
  ['Kod pocztowy',           13],
  ['Miasto',                 18],
  ['Email',                  28],
  ['Telefon',                14],
  ['Zamówienie voucherów',   22], // I — do uzupełnienia przez HR
  ['Dział',                  18],
  ['Stanowisko',             22],
  ['Typ umowy',              16],
  ['Data zatrudnienia',      17],
  ['IBAN',                   30],
  ['Status IBAN',            16],
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
    applyHeaderCell(ws, idx + 1, label, COL_COLOR[idx + 1]);
  });
  ws.getRow(1).height = 32;

  // Dane
  for (const e of employees) {
    const rowData = [
      e.firstName,
      e.lastName,
      e.pesel,
      e.street,
      e.zipCode,
      e.city,
      e.email,
      e.phoneNumber,
      '',               // I — Zamówienie voucherów (do uzupełnienia)
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
      applyDataCell(exRow.getCell(idx + 1), COL_COLOR[idx + 1]);
    });
    // Kolumna I (voucher) — wyróżnij jako "do wypełnienia"
    const voucherCell = exRow.getCell(9);
    voucherCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GREEN_LITE } };
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

export async function parseExcelFile(file: File): Promise<HrExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Skip header row
  const dataRows = raw.slice(1).filter(r => r.some((cell: any) => cell !== ''));

  return dataRows.map((row, idx) => {
    const errors: string[] = [];
    const firstName = String(row[0] ?? '').trim();
    const lastName = String(row[1] ?? '').trim();
    const pesel = String(row[2] ?? '').trim().replace(/\s/g, '');
    const amountRaw = row[3];
    const email = String(row[4] ?? '').trim();

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

    const amount = Number(amountRaw) || 0;
    if (amount <= 0) errors.push('Kwota voucherów musi być większa od zera');

    return {
      rowIndex: idx + 2, // 1-indexed, skipping header
      firstName,
      lastName,
      pesel,
      amount: isNaN(amount) ? 0 : amount,
      email,
      errors,
      isValid: errors.length === 0,
    };
  });
}
