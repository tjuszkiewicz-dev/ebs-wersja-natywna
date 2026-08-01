import { describe, it, expect } from 'vitest';
import { fullName, fillPlaceholders, displayName, buildDocData } from './docPlaceholders';

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

describe('displayName', () => {
  it('skleja imię i nazwisko', () => {
    expect(displayName({ first_name: 'Jan', last_name: 'Kowalski' })).toBe('Jan Kowalski');
  });

  it('skleja dwa imiona i dwa nazwiska (konwencja latynoska)', () => {
    const name = displayName({ first_name: 'Maria', second_name: 'Fernanda', last_name: 'Garcia', second_last_name: 'Lopez' });
    expect(name).toBe('Maria Fernanda Garcia Lopez');
  });

  it('pomija puste/brakujące pola', () => {
    expect(displayName({ first_name: 'Jan', second_name: null, last_name: 'Kowalski', second_last_name: undefined })).toBe('Jan Kowalski');
  });

  it('przycina białe znaki wokół wartości', () => {
    expect(displayName({ first_name: '  Jan  ', last_name: ' Kowalski ' })).toBe('Jan Kowalski');
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

describe('buildDocData — dzis_plus_miesiac', () => {
  it('zwraca datę przesuniętą o miesiąc (format jak {{dzis}})', () => {
    const d = buildDocData({}, null, new Date(2026, 7, 1)); // 01.08.2026
    expect(d.dzis_plus_miesiac).toBe('1.09.2026');
  });

  it('31 stycznia + miesiąc — zachowanie natywnego JS Date (przewija do marca)', () => {
    const d = buildDocData({}, null, new Date(2026, 0, 31)); // 31.01.2026
    expect(d.dzis_plus_miesiac).toBe('3.03.2026');
  });

  it('29 lutego roku przestępnego + miesiąc — przewija do 29 marca', () => {
    const d = buildDocData({}, null, new Date(2024, 1, 29)); // 29.02.2024 (przestępny)
    expect(d.dzis_plus_miesiac).toBe('29.03.2024');
  });
});

describe('buildDocData — kontrakt_adres / miejsce_szkolenia', () => {
  it('kontrakt_adres bierze adres z kontraktu', () => {
    const d = buildDocData({ contract: { name: 'K', address: 'ul. Testowa 1, Gdańsk' } });
    expect(d.kontrakt_adres).toBe('ul. Testowa 1, Gdańsk');
  });

  it('kontrakt_adres jest pusty gdy kontrakt nie ma adresu', () => {
    const d = buildDocData({ contract: { name: 'K' } });
    expect(d.kontrakt_adres).toBe('');
  });

  it('kontrakt_adres jest pusty gdy brak kontraktu', () => {
    const d = buildDocData({});
    expect(d.kontrakt_adres).toBe('');
  });

  it('miejsce_szkolenia bierze adres z kontraktu', () => {
    const d = buildDocData({ contract: { name: 'K', address: 'ul. Testowa 1, Gdańsk' } });
    expect(d.miejsce_szkolenia).toContain('Testowa');
  });

  it('miejsce_szkolenia jest puste gdy kontrakt nie ma adresu', () => {
    const d = buildDocData({ contract: { name: 'K' } });
    expect(d.miejsce_szkolenia).toBe('');
  });
});
