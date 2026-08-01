import { describe, it, expect } from 'vitest';
import { normalizeDocNumber, resolveOcrType, sniffOcrType, mergeIntoEmployee, aggregateResults } from './ocr';

describe('normalizeDocNumber', () => {
  it('usuwa spacje, myślniki i kropki', () => {
    expect(normalizeDocNumber('AB-123 456')).toBe('ab123456');
  });

  it('ujednolica wielkość liter, żeby numery z różnym zapisem były równe', () => {
    expect(normalizeDocNumber('cx1234567')).toBe(normalizeDocNumber('CX 1234567'));
  });

  it('zwraca pusty string dla null/undefined (bez rzucania wyjątku)', () => {
    expect(normalizeDocNumber(null)).toBe('');
    expect(normalizeDocNumber(undefined)).toBe('');
  });
});

describe('resolveOcrType + sniffOcrType (import z Drive: octet-stream)', () => {
  it('resolveOcrType odrzuca application/octet-stream (dalej trzeba sniffować bajty)', () => {
    expect(resolveOcrType('application/octet-stream', 'skan')).toBeNull();
  });

  it('sniffOcrType rozpoznaje PDF po sygnaturze bajtów mimo braku rozszerzenia/typu', () => {
    const buf = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(10)]);
    expect(sniffOcrType(buf)).toBe('application/pdf');
  });

  it('sniffOcrType rozpoznaje JPEG po sygnaturze bajtów', () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(10)]);
    expect(sniffOcrType(buf)).toBe('image/jpeg');
  });

  it('resolveOcrType ?? sniffOcrType — wzorzec z importu Drive dla pliku bez rozpoznanego typu', () => {
    const buf = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(10)]);
    const type = resolveOcrType('application/octet-stream', 'plik_bez_rozszerzenia') ?? sniffOcrType(buf);
    expect(type).toBe('application/pdf');
  });
});

describe('mergeIntoEmployee — OCR musi wygrywać z placeholderami importu', () => {
  it('nadpisuje placeholder "—" / "(import: …)" gdy OCR odczytał imię i nazwisko', () => {
    const employeeSkeleton = { first_name: '—', last_name: '(import: Gonzalez Rodriguez Paula)' };
    const agg = aggregateResults([{ doc_type: 'passport', first_name: 'Paula', last_name: 'Gonzalez' }]);
    const { applied, conflicts } = mergeIntoEmployee(employeeSkeleton, agg);
    // mergeIntoEmployee samo w sobie traktuje placeholder jak "pole już ustawione" (nie jest
    // puste), więc zgłasza konflikt zamiast applied — dlatego route.ts wymusza nadpisanie
    // first_name/last_name z OCR NIEZALEŻNIE od tego wyniku (patrz komentarz w route.ts).
    expect(conflicts.some(c => c.field === 'first_name')).toBe(true);
    expect(conflicts.some(c => c.field === 'last_name')).toBe(true);
    expect(applied.first_name).toBeUndefined();
  });

  it('wypełnia puste pola (np. numer paszportu) bezpośrednio, bez konfliktu', () => {
    const employee = { first_name: null, last_name: null, passport_number: null };
    const agg = aggregateResults([{ doc_type: 'passport', passport_number: 'AB1234567' }]);
    const { applied, conflicts } = mergeIntoEmployee(employee, agg);
    expect(applied.passport_number).toBe('AB1234567');
    expect(conflicts).toHaveLength(0);
  });
});
