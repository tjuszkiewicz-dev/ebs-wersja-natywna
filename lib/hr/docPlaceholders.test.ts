import { describe, it, expect } from 'vitest';
import { fullName, fillPlaceholders } from './docPlaceholders';

describe('fullName', () => {
  it('zawiera imię i nazwisko', () => {
    const name = fullName({ first_name: 'Jan', last_name: 'Kowalski' });
    expect(name).toContain('Jan');
    expect(name).toContain('Kowalski');
  });

  it('pomija puste pola (drugie imię/nazwisko)', () => {
    const name = fullName({ first_name: 'Jan', last_name: 'Kowalski' });
    expect(name).toBe('Jan Kowalski');
  });
});

describe('fillPlaceholders', () => {
  it('podstawia wartość istniejącego placeholdera', () => {
    const { html, missing } = fillPlaceholders('X {{imie_nazwisko}}', { imie_nazwisko: 'Jan Kowalski' });
    expect(html).toBe('X Jan Kowalski');
    expect(missing).toEqual([]);
  });

  it('brakujący placeholder → kropkowana linia + wpis w missing[]', () => {
    const { html, missing } = fillPlaceholders('X {{pesel}}', { pesel: null });
    expect(html).toBe('X ……………………');
    expect(missing).toEqual(['pesel']);
  });

  it('nie duplikuje wpisu w missing[] gdy placeholder powtórzony', () => {
    const { missing } = fillPlaceholders('{{pesel}} i {{pesel}}', { pesel: null });
    expect(missing).toEqual(['pesel']);
  });
});
