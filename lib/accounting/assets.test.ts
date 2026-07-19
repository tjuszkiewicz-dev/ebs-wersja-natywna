import { describe, it, expect } from 'vitest';
import { assetState, monthlyWrite, monthsAmortized } from './assets';

interface Asset {
  initial_value: number;
  amortization_rate: number;
  purchase_date: string;
  status: 'active' | 'sold' | 'liquidated';
}

const asset100pct: Asset = {
  initial_value: 1200,
  amortization_rate: 100, // 100%/rok → w pełni umorzony po 12 miesiącach
  purchase_date: '2024-01-15',
  status: 'active',
};

describe('monthlyWrite', () => {
  it('computes the monthly write as initial_value * rate% / 12', () => {
    expect(monthlyWrite(asset100pct)).toBe(100);
    expect(monthlyWrite({ initial_value: 1200, amortization_rate: 20 })).toBe(20);
  });
});

describe('monthsAmortized', () => {
  it('counts full months starting the month AFTER purchase (Polish rule)', () => {
    // zakup w styczniu 2024 → w styczniu 2024 jeszcze 0 miesięcy odpisanych
    expect(monthsAmortized('2024-01-15', '2024-01')).toBe(0);
    expect(monthsAmortized('2024-01-15', '2024-02')).toBe(1);
    expect(monthsAmortized('2024-01-15', '2025-01')).toBe(12);
  });

  it('never goes negative for a period before the purchase date', () => {
    expect(monthsAmortized('2024-06-01', '2024-01')).toBe(0);
  });
});

describe('assetState', () => {
  it('is fully written off exactly at the end of the amortization period (written_off = initial_value)', () => {
    const state = assetState(asset100pct, '2025-01');
    expect(state.months_amortized).toBe(12);
    expect(state.written_off).toBe(1200);
    expect(state.written_off).toBe(asset100pct.initial_value);
    expect(state.remaining).toBe(0);
    expect(state.fully_amortized).toBe(true);
  });

  it('writes off proportionally mid-period (half the months → half the value)', () => {
    const state = assetState(asset100pct, '2024-07'); // 6 miesięcy odpisane z 12
    expect(state.months_amortized).toBe(6);
    expect(state.written_off).toBe(600);
    expect(state.written_off).toBe(asset100pct.initial_value / 2);
    expect(state.remaining).toBe(600);
    expect(state.fully_amortized).toBe(false);
  });

  it('never exceeds initial_value even long after full amortization', () => {
    const state = assetState(asset100pct, '2027-06'); // dużo więcej niż 12 miesięcy
    expect(state.months_amortized).toBeGreaterThan(12);
    expect(state.written_off).toBe(1200);
    expect(state.written_off).toBeLessThanOrEqual(asset100pct.initial_value);
    expect(state.remaining).toBe(0);
    expect(state.period_write).toBe(0); // już w pełni umorzony → brak dalszego odpisu
    expect(state.fully_amortized).toBe(true);
  });

  it('period_write equals the monthly write while still amortizing, and stops once fully written off', () => {
    const midState = assetState(asset100pct, '2024-07');
    expect(midState.period_write).toBe(100); // jeszcze w trakcie → pełny odpis miesięczny

    const lastState = assetState(asset100pct, '2025-01'); // ostatni miesiąc odpisu
    expect(lastState.period_write).toBe(100);

    const afterFull = assetState(asset100pct, '2025-02'); // już w pełni umorzony wcześniej
    expect(afterFull.period_write).toBe(0);
  });

  it('reports zero period_write for a non-active asset even mid-amortization', () => {
    const sold: Asset = { ...asset100pct, status: 'sold' };
    const state = assetState(sold, '2024-07');
    expect(state.period_write).toBe(0);
    // written_off/remaining liczą się niezależnie od statusu (informacja o stanie bilansowym)
    expect(state.written_off).toBe(600);
  });
});
