import { describe, it, expect } from 'vitest';
import { buildElixir0 } from './elixir0';

describe('buildElixir0', () => {
  const sender = { name: 'Stratton Prime Sp. z o.o.', iban: 'PL66116022020000000666194064' };
  it('buduje rekord 110 z kwotą w groszach i datą YYYYMMDD', () => {
    const out = buildElixir0(
      [{ recipientName: 'Jan Kowalski', recipientIban: 'PL61109010140000071219812874', amountPln: 12.50, title: 'Odkup EBS' }],
      sender, new Date('2026-07-13T00:00:00Z'),
    );
    const line = out.trim().split('\n')[0];
    expect(line.startsWith('110,20260713,1250,')).toBe(true);
    expect(line).toContain('"Jan Kowalski"');
    expect(line).toContain('61109010140000071219812874');
    expect(line).toContain('"Odkup EBS"');
  });
  it('pusta lista → pusty string', () => {
    expect(buildElixir0([], sender, new Date())).toBe('');
  });
});
