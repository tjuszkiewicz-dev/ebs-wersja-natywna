import { describe, it, expect } from 'vitest';
import { docCopies, isPelnomocnictwo, pelnomocnictwoFooter } from './docRules';

describe('docCopies', () => {
  it('umowa (PL i obca) → 2 egzemplarze', () => {
    expect(docCopies('Umowa o pracę')).toBe(2);
    expect(docCopies('umowa (wersja obcojęzyczna)')).toBe(2);
  });

  it('zaświadczenie / dekret → 2 egzemplarze', () => {
    expect(docCopies('Zaświadczenie Zakonu')).toBe(2);
    expect(docCopies('zaswiadczenie bez ogonkow')).toBe(2);
    expect(docCopies('Dekret powołania')).toBe(2);
  });

  it('oświadczenia / kwestionariusze / pełnomocnictwa → 1 egzemplarz', () => {
    expect(docCopies('Oświadczenie pracownika')).toBe(1);
    expect(docCopies('Kwestionariusz osobowy')).toBe(1);
    expect(docCopies('Pełnomocnictwo ogólne')).toBe(1);
  });

  it('brak / pusta nazwa → domyślnie 1', () => {
    expect(docCopies('')).toBe(1);
    expect(docCopies(undefined as unknown as string)).toBe(1);
  });
});

describe('isPelnomocnictwo', () => {
  it('rozpoznaje warianty pełnomocnictwa (z i bez ogonków, wielkość liter)', () => {
    expect(isPelnomocnictwo('Pełnomocnictwo ZUS')).toBe(true);
    expect(isPelnomocnictwo('pelnomocnictwo dwujęzyczne')).toBe(true);
    expect(isPelnomocnictwo('PELNMACIEJ')).toBe(true);
  });

  it('inne dokumenty → false', () => {
    expect(isPelnomocnictwo('Umowa o pracę')).toBe(false);
    expect(isPelnomocnictwo('')).toBe(false);
  });
});

describe('pelnomocnictwoFooter', () => {
  it('pelnmaciej → stała stopka P. Maciej Lisowski', () => {
    expect(pelnomocnictwoFooter('pelnmaciej_v2')).toBe('Pełnomocnictwo — P. Maciej Lisowski');
  });

  it('pelnpiotr → stała stopka mec. Piotr Rał', () => {
    expect(pelnomocnictwoFooter('pelnpiotr_v2')).toBe('Pełnomocnictwo — mec. Piotr Rał');
  });

  it('ogólne pełnomocnictwo → zwraca nazwę dokumentu (trim)', () => {
    expect(pelnomocnictwoFooter('  Pełnomocnictwo ogólne ZUS  ')).toBe('Pełnomocnictwo ogólne ZUS');
  });

  it('dokument nie będący pełnomocnictwem → null', () => {
    expect(pelnomocnictwoFooter('Umowa o pracę')).toBeNull();
    expect(pelnomocnictwoFooter('')).toBeNull();
  });
});
