import { describe, it, expect } from 'vitest';
import { previewOf, tDay, fmtDur, initials, hue, roleLabel } from './format';

describe('previewOf', () => {
  it('tekst przycina do limitu', () => {
    expect(previewOf({ kind: 'text', content: 'a'.repeat(100) }, 10)).toBe('a'.repeat(10));
  });
  it('rodzaje nietekstowe mają stałe etykiety', () => {
    expect(previewOf({ kind: 'audio' })).toBe('🎤 Głosówka');
    expect(previewOf({ kind: 'image' })).toBe('📷 Zdjęcie');
    expect(previewOf({ kind: 'recording' })).toBe('⏺️ Nagranie spotkania');
    expect(previewOf({ kind: 'file', file_name: 'umowa.pdf' })).toBe('📎 umowa.pdf');
    expect(previewOf({ kind: 'file' })).toBe('📎 Plik');
  });
  it('usunięta wiadomość — niezależnie od rodzaju', () => {
    expect(previewOf({ kind: 'text', content: 'x', deleted_at: '2026-01-01' })).toBe('wiadomość usunięta');
    expect(previewOf({ kind: 'image', deleted: true })).toBe('wiadomość usunięta');
  });
  it('brak wiadomości → null', () => {
    expect(previewOf(null)).toBeNull();
  });
});

describe('tDay (deterministyczne przez `now`)', () => {
  const now = new Date('2026-09-03T12:00:00');
  it('dzisiaj / wczoraj / data', () => {
    expect(tDay('2026-09-03T08:00:00', now)).toBe('Dzisiaj');
    expect(tDay('2026-09-02T23:59:00', now)).toBe('Wczoraj');
    expect(tDay('2026-08-30T10:00:00', now)).toBe(new Date('2026-08-30T10:00:00').toLocaleDateString('pl-PL'));
  });
});

describe('fmtDur', () => {
  it('sekundy → m:ss', () => {
    expect(fmtDur(0)).toBe('0:00');
    expect(fmtDur(65)).toBe('1:05');
    expect(fmtDur(3599.6)).toBe('60:00');
    expect(fmtDur(null)).toBe('0:00');
  });
});

describe('initials / hue / roleLabel', () => {
  it('inicjały z dwóch pierwszych słów', () => {
    expect(initials('Marzanna Szarolkiewicz')).toBe('MS');
    expect(initials('Jan Maria Rokita')).toBe('JM');
    expect(initials('X')).toBe('X');
  });
  it('hue deterministyczne i w zakresie 0–359', () => {
    expect(hue('Tomasz')).toBe(hue('Tomasz'));
    expect(hue('Tomasz')).toBeGreaterThanOrEqual(0);
    expect(hue('Tomasz')).toBeLessThan(360);
  });
  it('etykieta roli z fallbackiem na surową nazwę', () => {
    expect(roleLabel('partner')).toBe('Doradca');
    expect(roleLabel('rola_wlasna')).toBe('rola_wlasna');
    expect(roleLabel(null)).toBe('');
  });
});
