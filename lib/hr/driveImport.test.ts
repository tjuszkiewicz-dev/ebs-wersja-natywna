import { describe, it, expect } from 'vitest';
import { guessNameFromFolder, buildImportPatch } from './driveImport';

describe('guessNameFromFolder', () => {
  it('pierwsze słowo = nazwisko, reszta = imię/imiona', () => {
    expect(guessNameFromFolder('Gonzalez Paula Andrea')).toEqual({ last: 'Gonzalez', first: 'Paula Andrea' });
  });

  it('jedno słowo → tylko nazwisko, imię puste-placeholder', () => {
    expect(guessNameFromFolder('Gonzalez')).toEqual({ last: 'Gonzalez', first: '—' });
  });
});

describe('buildImportPatch — OCR musi wygrywać z nazwą folderu, folder tylko jako fallback', () => {
  it('OCR zwraca komplet danych → patch bierze WSZYSTKO z OCR, nazwa folderu ignorowana', () => {
    const agg = {
      first_name: 'Paula', last_name: 'Gonzalez', passport_number: 'AB1234567', nationality: 'Kolumbia',
    };
    const guess = { first: 'Rodriguez Maria', last: 'Perez' }; // celowo inna osoba — nie powinno przeciekać
    const patch = buildImportPatch(agg as any, guess);
    expect(patch.first_name).toBe('Paula');
    expect(patch.last_name).toBe('Gonzalez');
    expect(patch.passport_number).toBe('AB1234567');
  });

  it('OCR zwraca tylko nazwisko → imię z folderu, nazwisko z OCR, BEZ odwrócenia', () => {
    const agg = { last_name: 'Gonzalez' };
    const guess = { first: 'Paula Andrea', last: 'Gonzalez' };
    const patch = buildImportPatch(agg as any, guess);
    expect(patch.first_name).toBe('Paula Andrea'); // z folderu, bo OCR nic nie dał
    expect(patch.last_name).toBe('Gonzalez'); // z OCR, nie nadpisane folderem
  });

  it('OCR zwraca tylko imię → nazwisko z folderu, imię z OCR, BEZ odwrócenia', () => {
    const agg = { first_name: 'Paula' };
    const guess = { first: 'Paula Andrea', last: 'Gonzalez' };
    const patch = buildImportPatch(agg as any, guess);
    expect(patch.first_name).toBe('Paula'); // z OCR
    expect(patch.last_name).toBe('Gonzalez'); // fallback z folderu
  });

  it('OCR nie zwraca nic → pełny fallback z nazwy folderu', () => {
    const patch = buildImportPatch({} as any, { first: 'Paula Andrea', last: 'Gonzalez' });
    expect(patch.first_name).toBe('Paula Andrea');
    expect(patch.last_name).toBe('Gonzalez');
    expect(patch.passport_number).toBeUndefined();
  });

  it('OCR zwraca wartości puste/whitespace → traktowane jak brak, fallback z folderu', () => {
    const agg = { first_name: '   ', last_name: '', passport_number: '  ' };
    const patch = buildImportPatch(agg as any, { first: 'Paula', last: 'Gonzalez' });
    expect(patch.first_name).toBe('Paula');
    expect(patch.last_name).toBe('Gonzalez');
    expect(patch.passport_number).toBeUndefined();
  });

  it('mapuje pola dokumentowe (paszport, PESEL, karta pobytu…) 1:1 z OCR_TO_EMPLOYEE', () => {
    const agg = { pesel: '12345678901', residence_card_number: 'XYZ999', work_permit_expiry: '2027-01-01' };
    const patch = buildImportPatch(agg as any, { first: '—', last: '(import Drive)' });
    expect(patch.pesel).toBe('12345678901');
    expect(patch.residence_card_number).toBe('XYZ999');
    expect(patch.work_permit_expiry).toBe('2027-01-01');
  });

  it('ustawia language z obywatelstwa tylko gdy jeszcze nie ustawione i rozpoznane', () => {
    const patch = buildImportPatch({ nationality: 'Kolumbia' } as any, { first: '—', last: '(import Drive)' });
    expect(patch.language).toBe('es');
  });
});
