import { describe, expect, it } from 'vitest';
import { driveEstimate, geocodeAddress, haversineKm } from './geo';

describe('lib/hr/geo (STUB E2b)', () => {
  it('geocodeAddress resolves null (nie rzuca)', async () => {
    await expect(geocodeAddress('Gdańsk, Długa 1')).resolves.toBeNull();
  });

  it('driveEstimate resolves null (stub)', () => {
    expect(driveEstimate({ lat: 54.35, lng: 18.65 }, { lat: 54.4, lng: 18.7 })).toBeNull();
  });

  it('haversineKm liczy odległość (czysta funkcja, skopiowana z BBS)', () => {
    const distance = haversineKm({ lat: 54.35, lng: 18.65 }, { lat: 54.35, lng: 18.65 });
    expect(distance).toBe(0);
  });
});
