import { describe, expect, it } from 'vitest';
import { driveEstimate, geocodeAddress, haversineKm } from './geo';

describe('lib/hr/geo (Nominatim, E2d)', () => {
  it('geocodeAddress zwraca null dla pustego inputu bez rzucania (bez wywołania sieciowego)', async () => {
    await expect(geocodeAddress('')).resolves.toBeNull();
    await expect(geocodeAddress('   ')).resolves.toBeNull();
  });

  it('haversineKm: ten sam punkt → 0', () => {
    const distance = haversineKm({ lat: 54.35, lng: 18.65 }, { lat: 54.35, lng: 18.65 });
    expect(distance).toBe(0);
  });

  it('haversineKm: Gdańsk → Warszawa ≈ 284 km (±10 km, linia prosta)', () => {
    // Gdańsk: 54.352, 18.6466 / Warszawa: 52.2297, 21.0122
    const distance = haversineKm({ lat: 54.352, lng: 18.6466 }, { lat: 52.2297, lng: 21.0122 });
    expect(distance).toBeGreaterThan(274);
    expect(distance).toBeLessThan(294);
  });

  it('driveEstimate: czysta funkcja na haversineKm (droga = 1.3× linia prosta, 60 km/h)', () => {
    const a = { lat: 54.35, lng: 18.65 };
    const b = { lat: 54.4, lng: 18.7 };
    const result = driveEstimate(a, b);
    const roadKm = haversineKm(a, b) * 1.3;
    expect(result.distance_km).toBeCloseTo(Math.round(roadKm * 10) / 10, 5);
    expect(result.drive_min).toBe(Math.round((roadKm / 60) * 60));
  });
});
