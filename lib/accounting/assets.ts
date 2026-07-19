// Amortyzacja liniowa środków trwałych (server-only, wspólne dla API i bilansu).
import { r2 } from '@/lib/accounting/access';

// Odpis miesięczny = wartość początkowa × stawka% / 12
export const monthlyWrite = (a: { initial_value: number; amortization_rate: number }) =>
  r2(Number(a.initial_value) * Number(a.amortization_rate) / 100 / 12);

// Liczba PEŁNYCH miesięcy amortyzacji do danego okresu włącznie
// (odpisy zaczynają się od miesiąca NASTĘPNEGO po zakupie — zasada polska).
export function monthsAmortized(purchaseDate: string, period: string): number {
  const [py, pm] = String(purchaseDate).slice(0, 7).split('-').map(Number);
  const [y, m] = period.split('-').map(Number);
  return Math.max(0, (y - py) * 12 + (m - pm));
}

// Stan środka na koniec okresu + odpis W TYM okresie (0 gdy już w pełni umorzony)
export function assetState(a: any, period: string) {
  const write = monthlyWrite(a);
  const months = monthsAmortized(a.purchase_date, period);
  const grossSoFar = r2(write * months);
  const writtenOff = Math.min(Number(a.initial_value), grossSoFar);
  const prevWritten = Math.min(Number(a.initial_value), r2(write * Math.max(0, months - 1)));
  const thisPeriodWrite = a.status === 'active' ? r2(writtenOff - prevWritten) : 0;
  return {
    monthly_write: write,
    months_amortized: months,
    written_off: writtenOff,
    remaining: r2(Number(a.initial_value) - writtenOff),
    period_write: thisPeriodWrite,
    fully_amortized: writtenOff >= Number(a.initial_value),
  };
}
