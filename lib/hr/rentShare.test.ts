import { describe, it, expect } from 'vitest';
import { rentSharePerPerson, accommodationSpots } from './rentShare';

describe('rentSharePerPerson', () => {
  it('suma udziałów wszystkich miejsc == czynsz (inwariant)', () => {
    const acc = { capacity: 4, monthly_rent: 1000 };
    const share = rentSharePerPerson(acc);
    const spots = accommodationSpots(acc);
    expect(Math.round(share * spots * 100) / 100).toBe(1000);
  });

  it('0 mieszkańców (brak capacity/rented_spots) nie rzuca i zwraca 0', () => {
    expect(() => rentSharePerPerson({ monthly_rent: 1000 })).not.toThrow();
    expect(rentSharePerPerson({ monthly_rent: 1000 })).toBe(0);
  });

  it('brak czynszu → 0 mimo dostępnych miejsc', () => {
    expect(rentSharePerPerson({ capacity: 3, monthly_rent: 0 })).toBe(0);
  });

  it('fallback na rented_spots gdy brak capacity', () => {
    const acc = { rented_spots: 2, monthly_rent: 500 };
    expect(rentSharePerPerson(acc)).toBe(250);
  });
});
