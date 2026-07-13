import { describe, it, expect } from 'vitest';
import { renderTemplate } from './templateEngine';

describe('renderTemplate', () => {
  it('podstawia pola', () => {
    const out = renderTemplate('Cześć {{imie_nazwisko}}, saldo {{liczba_voucherow}} szt.', {
      imie_nazwisko: 'Jan Kowalski', liczba_voucherow: 42,
    });
    expect(out).toBe('Cześć Jan Kowalski, saldo 42 szt.');
  });
  it('toleruje spacje w klamrach i puste wartości', () => {
    expect(renderTemplate('{{ iban_zbywajacego }}|{{email_zbywajacego}}', { iban_zbywajacego: 'PL61', email_zbywajacego: undefined }))
      .toBe('PL61|');
  });
  it('nie rusza nieznanych kluczy', () => {
    expect(renderTemplate('{{znane}} {{obce}}', { znane: 'X' })).toBe('X {{obce}}');
  });
});
