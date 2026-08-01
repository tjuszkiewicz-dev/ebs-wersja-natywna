import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { fillPeselForm, peselMissingFields } from './peselForm';

// Wypełnia formularz i zwraca WARTOŚĆ pola odczytaną z wygenerowanego PDF-a (nie tylko
// sprawdzamy brak wyjątku — dokładnie to przegapiła wcześniejsza weryfikacja "tylko wizualna").
async function fillAndReadField(blank: Uint8Array, emp: any, docDate: string | null, opts: { signCity?: string } | undefined, fieldName: string): Promise<string> {
  const bytes = await fillPeselForm(blank, emp, docDate, opts);
  const pdf = await PDFDocument.load(bytes);
  return pdf.getForm().getTextField(fieldName).getText() ?? '';
}

const baseEmp = {
  first_name: 'Jan',
  last_name: 'Kowalski',
  birth_date: '1990-05-12',
  gender: 'M',
  country_of_origin: 'Ukraina',
  passport_number: 'AB1234567',
  passport_expiry: '2028-01-01',
  accommodation: { street: 'Krótka', house_no: '5', postal_code: '58-100', city: 'Świdnica' },
};

describe('fillPeselForm — pkt 8 (Podpisy, miejscowość)', () => {
  let blank: Uint8Array;
  beforeAll(async () => {
    blank = new Uint8Array(await readFile(path.join(process.cwd(), 'public', 'templates', 'pesel-elw1.pdf')));
  });

  it('brak signCity → fallback jak dotąd: miejscowość z adresu noclegu', async () => {
    const v = await fillAndReadField(blank, baseEmp, '2026-08-01', undefined, 'podpisy miejscowość');
    expect(v).toBe('Swidnica'); // transliteracja Ś→S jak w reszcie formularza (wa(), bez uppercase)
  });

  it('signCity podane → nadpisuje adres noclegu', async () => {
    const v = await fillAndReadField(blank, baseEmp, '2026-08-01', { signCity: 'Wrocław' }, 'podpisy miejscowość');
    expect(v).toBe('Wroclaw');
  });

  it('signCity z samymi spacjami → traktowane jak brak (fallback do adresu)', async () => {
    const v = await fillAndReadField(blank, baseEmp, '2026-08-01', { signCity: '   ' }, 'podpisy miejscowość');
    expect(v).toBe('Swidnica');
  });

  it('signCity z cyrylicą → transliterowane, POLE NIE ZOSTAJE PUSTE', async () => {
    const v = await fillAndReadField(blank, baseEmp, '2026-08-01', { signCity: 'Москва' }, 'podpisy miejscowość');
    expect(v).not.toBe('');
    expect(v).toBe('Moskva');
  });

  it('signCity z typograficznym myślnikiem i cudzysłowem → normalizowane do ASCII, pole niepuste', async () => {
    const v = await fillAndReadField(blank, baseEmp, '2026-08-01', { signCity: 'Bielsko—Biała „Nowa"' }, 'podpisy miejscowość');
    expect(v).not.toBe('');
    expect(v).toBe('Bielsko-Biala "Nowa"');
  });

  it('signCity ze znakiem spoza WinAnsi (emoji/CJK) → zastąpiony "?", pole NIE JEST PUSTE (nie ma cichego wyjątku)', async () => {
    const v = await fillAndReadField(blank, baseEmp, '2026-08-01', { signCity: 'Wrocław🙂市' }, 'podpisy miejscowość');
    expect(v).not.toBe('');
    expect(v.startsWith('Wroclaw')).toBe(true);
    expect(v).not.toMatch(/[🙂市]/);
  });

  it('długa wartość (60 znaków) — pole niepuste, bez wyjątku (auto-skalowanie czcionki pdf-lib chroni przed przepełnieniem szerokości)', async () => {
    const long = 'A'.repeat(60);
    const v = await fillAndReadField(blank, baseEmp, '2026-08-01', { signCity: long }, 'podpisy miejscowość');
    expect(v.length).toBeGreaterThan(0);
    expect(v.length).toBeLessThanOrEqual(60);
  });
});

describe('peselMissingFields', () => {
  it('zwraca puste braki dla kompletnej kartoteki', () => {
    expect(peselMissingFields(baseEmp)).toEqual([]);
  });

  it('zgłasza brak imienia', () => {
    expect(peselMissingFields({ ...baseEmp, first_name: '' })).toContain('imię');
  });
});
