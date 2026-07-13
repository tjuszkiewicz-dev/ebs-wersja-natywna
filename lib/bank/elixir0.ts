// Generator Elixir-0 (KIR) — krajowe przelewy uznaniowe (rekord typu 110).
// UWAGA: format bankowo-specyficzny. Kwoty w groszach, data YYYYMMDD, kodowanie docelowe Windows-1250.
// Przed pierwszym realnym użyciem ZWERYFIKOWAĆ testowym importem w banku (Millennium).
export interface TransferItem { recipientName: string; recipientIban: string; amountPln: number; title: string; }
export interface SenderInfo { name: string; iban: string; }

const nrb = (iban: string) => iban.replace(/\s+/g, '').toUpperCase().replace(/^PL/, '');
const q = (s: string) => `"${(s || '').replace(/"/g, "'").slice(0, 140)}"`;
const bankId = (iban: string) => nrb(iban).slice(0, 8);
const yyyymmdd = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

export function buildElixir0(items: TransferItem[], sender: SenderInfo, date: Date): string {
  if (!items.length) return '';
  const dateStr = yyyymmdd(date);
  const senderNrb = nrb(sender.iban);
  const senderBank = bankId(sender.iban);
  return items.map(it => {
    const grosze = Math.round((Number(it.amountPln) || 0) * 100);
    const recNrb = nrb(it.recipientIban);
    return [
      '110', dateStr, String(grosze), '0', senderBank, '""',
      senderNrb, recNrb, q(sender.name), q(it.recipientName),
      bankId(it.recipientIban), '0', q(it.title), '""', '""', '51', '""',
    ].join(',');
  }).join('\r\n') + '\r\n';
}
