import { describe, it, expect } from 'vitest';
import { normTok, nameKey } from './nameMatch';

describe('normTok', () => {
  it('usuwa diakrytyki i zmienia na male litery', () => {
    expect(normTok('Łukasz')).toBe(normTok('lukasz'));
  });
  it('zrownuje koncowe s i z — CELOWO, przypadek produkcyjny VILCHES/VILCHEZ (swiadomy kompromis, nie regresja)', () => {
    // Reguła jest agresywna z rozmysłem: koszt fałszywego alarmu (dwie różne osoby
    // różniące się tylko ostatnią literą, np. Perez/Perex) jest akceptowany, bo
    // koszt przeoczonego duplikatu (ten sam człowiek zapisany raz jako VILCHES,
    // raz jako VILCHEZ) był wyższy. Ten test ma pozostać zielony — jeśli ktoś
    // "naprawi" regułę s/z, ten test musi się czerwienić.
    expect(normTok('VILCHES')).toBe(normTok('VILCHEZ'));
  });
  it('radzi sobie z pustymi wartosciami', () => {
    expect(normTok(null)).toBe('');
    expect(normTok(undefined)).toBe('');
  });
  it('transliteruje niemieckie Eszett (ß), nie usuwa go — Straße = Strasse', () => {
    expect(normTok('Straße')).toBe(normTok('Strasse'));
  });
  it('transliteruje skandynawskie o-z-kreska (ø), nie usuwa go — Møller = Moller', () => {
    expect(normTok('Møller')).toBe(normTok('Moller'));
  });
  it('transliteruje wietnamskie d-z-kreska (đ) i dekomponuje znaki tonalne — Đức = Duc', () => {
    expect(normTok('Đức')).toBe(normTok('Duc'));
  });
});

describe('nameKey', () => {
  it('jest niezalezny od kolejnosci imion i nazwisk', () => {
    const a = nameKey({ first_name: 'Juan', last_name: 'Vilches' });
    const b = nameKey({ first_name: 'Vilchez', last_name: 'Juan' });
    expect(a).toBe(b);
  });
  it('rozroznia rozne osoby', () => {
    expect(nameKey({ first_name: 'Anna', last_name: 'Kowalska' }))
      .not.toBe(nameKey({ first_name: 'Anna', last_name: 'Nowak' }));
  });
  it('ignoruje puste czlony', () => {
    expect(nameKey({ first_name: 'Ana', second_name: '', last_name: 'Ruiz' }))
      .toBe(nameKey({ first_name: 'Ana', last_name: 'Ruiz' }));
  });
});
