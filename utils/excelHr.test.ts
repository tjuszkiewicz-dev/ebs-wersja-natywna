import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseKartotekaFile, readSheetAsRows } from './excelHr';

// Testy powstały razem z przejściem z SheetJS na ExcelJS (02.09.2026, usunięcie
// niezałatanego `xlsx`). Chodzi o dowód, że parser czyta PRAWDZIWY plik .xlsx —
// nie atrapę tablicy — bo cała klasa błędów przy takiej podmianie siedzi
// w tym, co biblioteka zwraca dla dat, formuł i pustych komórek.

const NAGLOWEK = [
  'Imię', 'Nazwisko', 'PESEL', 'Email', 'Ulica', 'Kod pocztowy', 'Miasto',
  'Telefon', 'Dział', 'Stanowisko', 'Typ umowy', 'Data zatrudnienia', 'IBAN',
];

// PESEL 44051401359 — poprawna cyfra kontrolna (suma ważona 101 → 9).
const PESEL_OK = '44051401359';

async function zbudujPlik(
  wiersze: any[][],
  nazwa = 'kartoteka.xlsx',
): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Arkusz1');
  for (const w of wiersze) ws.addRow(w);
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], nazwa, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('excelHr — odczyt prawdziwego pliku .xlsx przez ExcelJS', () => {
  it('round-trip: zapisany plik wraca jako poprawnie zmapowane wiersze', async () => {
    const plik = await zbudujPlik([
      NAGLOWEK,
      ['Anna', 'Kowalska', PESEL_OK, 'anna@example.com', 'Polna 1', '00-001',
       'Warszawa', '600100200', 'Kadry', 'Specjalista', 'UoP', '2024-03-15', ''],
    ]);

    const wiersze = await parseKartotekaFile(plik);

    expect(wiersze).toHaveLength(1);
    expect(wiersze[0].firstName).toBe('Anna');
    expect(wiersze[0].lastName).toBe('Kowalska');
    expect(wiersze[0].pesel).toBe(PESEL_OK);
    expect(wiersze[0].email).toBe('anna@example.com');
    expect(wiersze[0].isValid).toBe(true);
    expect(wiersze[0].errors).toEqual([]);
  });

  it('komórka z prawdziwą datą (Date, nie tekst) daje hireDate w formacie ISO', async () => {
    // To jest różnica między bibliotekami: SheetJS oddawał serial excelowy,
    // ExcelJS oddaje obiekt Date. Gdyby normalizacja tego nie łapała,
    // data cicho zamieniłaby się w bezsensowny ciąg.
    const plik = await zbudujPlik([
      NAGLOWEK,
      ['Jan', 'Nowak', PESEL_OK, 'jan@example.com', '', '', '', '', '', '', '',
       new Date(Date.UTC(2023, 10, 7)), ''],
    ]);

    const wiersze = await parseKartotekaFile(plik);
    expect(wiersze[0].hireDate).toBe('2023-11-07');
  });

  it('pusty wiersz w środku nie przesuwa nagłówka ani nie tworzy pustego rekordu', async () => {
    const plik = await zbudujPlik([
      NAGLOWEK,
      ['Ewa', 'Wójcik', PESEL_OK, 'ewa@example.com', '', '', '', '', '', '', '', '', ''],
      [],
      ['Piotr', 'Zieliński', PESEL_OK, 'piotr@example.com', '', '', '', '', '', '', '', '', ''],
    ]);

    const wiersze = await parseKartotekaFile(plik);
    expect(wiersze.map(w => w.firstName)).toEqual(['Ewa', 'Piotr']);
  });

  it('pusta komórka wraca jako pusty ciąg, nie undefined', async () => {
    const plik = await zbudujPlik([
      NAGLOWEK,
      ['Zofia', 'Dąb', PESEL_OK, 'zofia@example.com', '', '', '', '', '', '', '', '', ''],
    ]);

    const raw = await readSheetAsRows(plik);
    expect(raw[1][4]).toBe('');
    expect(raw[1][4]).not.toBeUndefined();
  });

  it('komórka z formułą oddaje wynik, nie zapis formuły', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Arkusz1');
    ws.addRow(['a', 'b']);
    ws.getCell('A2').value = { formula: 'CONCATENATE("Ku","ba")', result: 'Kuba' } as any;
    const buf = await wb.xlsx.writeBuffer();
    const plik = new File([buf], 'formula.xlsx');

    const raw = await readSheetAsRows(plik);
    expect(raw[1][0]).toBe('Kuba');
  });

  it('stary format .xls jest odrzucany komunikatem, który mówi co zrobić', async () => {
    const plik = await zbudujPlik([NAGLOWEK], 'stary.xls');
    await expect(readSheetAsRows(plik)).rejects.toThrow(/\.xlsx/);
  });
});
