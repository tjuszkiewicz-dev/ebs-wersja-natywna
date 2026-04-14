// Excel utilities for HR panel — uses SheetJS (npm: xlsx)
import * as XLSX from 'xlsx';

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
  email: string;
  phoneNumber: string;
  department: string;
  position: string;
  contractType: string;
  iban: string;
}

export function exportActiveEmployees(employees: ActiveEmployeeRow[], companyName: string): void {
  const header = ['Imię', 'Nazwisko', 'PESEL', 'Zamówienie voucherów', 'Email', 'Telefon', 'Dział', 'Stanowisko', 'Typ umowy', 'IBAN'];
  const rows = employees.map(e => [
    e.firstName,
    e.lastName,
    e.pesel,
    '',              // Zamówienie voucherów — do uzupełnienia przez HR
    e.email,
    e.phoneNumber,
    e.department,
    e.position,
    e.contractType,
    e.iban,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 32 }];

  // Bold header row
  for (let c = 0; c < header.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aktywni pracownicy');

  const today = new Date().toISOString().slice(0, 10);
  const safeName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  XLSX.writeFile(wb, `aktywni_pracownicy_${safeName}_${today}.xlsx`);
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
