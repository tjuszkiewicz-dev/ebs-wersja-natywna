// STUB E2b — realne geokodowanie (Nominatim) wchodzi w E2d; sygnatury 1:1 z BBS.
// ── Geokodowanie adresów + odległość/czas dojazdu (nocleg → magazyn projektu) ──
// BBS: Nominatim (OpenStreetMap), wynik cache'owany w lat/lng/geocoded_at, czas dojazdu
// szacowany (odległość w linii prostej × 1.3 drogi, średnio 60 km/h). Tu: geocodeAddress
// zawsze zwraca null (brak wywołań sieciowych w E2b); haversineKm zostaje czystą funkcją.

export interface GeoPoint { lat: number; lng: number }

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  void address;
  return null;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Szacunek jazdy: droga ≈ 1.3 × linia prosta, średnia 60 km/h
export function driveEstimate(a: GeoPoint, b: GeoPoint): { distance_km: number; drive_min: number } | null {
  void a;
  void b;
  return null;
}
