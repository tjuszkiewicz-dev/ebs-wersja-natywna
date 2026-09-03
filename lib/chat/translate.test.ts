import { describe, it, expect } from 'vitest';
import { normalizeLang } from './translate';

describe('normalizeLang — hr_employees.language (wolny tekst lub kod) → kod z LANGS', () => {
  it('kody ISO przechodzą wprost, z regionem i wielkością liter', () => {
    expect(normalizeLang('uk')).toBe('uk');
    expect(normalizeLang('UK')).toBe('uk');
    expect(normalizeLang('uk-UA')).toBe('uk');
    expect(normalizeLang('ru_RU')).toBe('ru');
    expect(normalizeLang('hi')).toBe('hi');
  });
  it('nazwy po polsku i angielsku', () => {
    expect(normalizeLang('ukraiński')).toBe('uk');
    expect(normalizeLang('Ukrainian')).toBe('uk');
    expect(normalizeLang('rosyjski')).toBe('ru');
    expect(normalizeLang('hindi')).toBe('hi');
    expect(normalizeLang('hiszpański')).toBe('es');
  });
  it('nieznane albo puste → null (brak automatu, nie błąd)', () => {
    expect(normalizeLang('')).toBeNull();
    expect(normalizeLang(null)).toBeNull();
    expect(normalizeLang('klingoński')).toBeNull();
    expect(normalizeLang('xx')).toBeNull();
  });
  it('nie zgaduje po zbyt krótkim prefiksie („ru" to kod, nie prefiks „rumuński")', () => {
    expect(normalizeLang('ru')).toBe('ru');
    expect(normalizeLang('rum')).toBeNull();
    expect(normalizeLang('rumu')).toBe('ro');
  });
});
