import type { TransferItem, SenderInfo } from './elixir0';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const clean = (s: string) => (s || '').replace(/[;\r\n]/g, ' ').trim();
const amt = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',');

/** Prosty CSV importu przelewów Millennium (średnik). */
export function buildMillenniumCsv(items: TransferItem[], sender: SenderInfo, date: Date): string {
  const head = 'Data;Rachunek nadawcy;Rachunek odbiorcy;Nazwa odbiorcy;Kwota;Tytuł';
  const rows = items.map(it =>
    [iso(date), sender.iban.replace(/\s+/g, ''), it.recipientIban.replace(/\s+/g, ''), clean(it.recipientName), amt(it.amountPln), clean(it.title)].join(';'),
  );
  return [head, ...rows].join('\n') + '\n';
}
