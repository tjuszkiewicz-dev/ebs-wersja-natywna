import { describe, it, expect } from 'vitest';
import { buildMillenniumCsv } from './millenniumCsv';

describe('buildMillenniumCsv', () => {
  const sender = { name: 'Stratton', iban: 'PL66116022020000000666194064' };
  it('nagłówek + wiersz z kwotą 12,50', () => {
    const out = buildMillenniumCsv(
      [{ recipientName: 'Jan Kowalski', recipientIban: 'PL61109010140000071219812874', amountPln: 12.5, title: 'Odkup EBS' }],
      sender, new Date('2026-07-13T00:00:00Z'),
    );
    const [head, row] = out.trim().split('\n');
    expect(head).toBe('Data;Rachunek nadawcy;Rachunek odbiorcy;Nazwa odbiorcy;Kwota;Tytuł');
    expect(row).toContain('2026-07-13;PL66116022020000000666194064;PL61109010140000071219812874;Jan Kowalski;12,50;Odkup EBS');
  });
});
