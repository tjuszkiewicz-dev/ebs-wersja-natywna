import { describe, it, expect } from 'vitest';
import { normTok, nameKey } from './nameMatch';

describe('normTok', () => {
  it('usuwa diakrytyki i zmienia na male litery', () => {
    expect(normTok('Łukasz')).toBe(normTok('lukasz'));
  });
  it('zrownuje koncowe s i z', () => {
    expect(normTok('VILCHES')).toBe(normTok('VILCHEZ'));
  });
  it('radzi sobie z pustymi wartosciami', () => {
    expect(normTok(null)).toBe('');
    expect(normTok(undefined)).toBe('');
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
