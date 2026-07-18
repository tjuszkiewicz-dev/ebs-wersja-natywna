// ── Geokodowanie adresów + odległość/czas dojazdu (nocleg → magazyn projektu) ──
// Nominatim (OpenStreetMap) — bez klucza; wołane rzadko (przy zapisie adresu),
// wynik cache'owany w kolumnach lat/lng/geocoded_at. Czas dojazdu = szacunek
// (odległość w linii prostej × 1.3 drogi, średnio 60 km/h).

export interface GeoPoint { lat: number; lng: number }

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pl&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'EBS-Stratton-Prime/1.0 (eliton-benefits.com)' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) return null;
    const lat = Number(data[0].lat), lng = Number(data[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch { return null; }
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Szacunek jazdy: droga ≈ 1.3 × linia prosta, średnia 60 km/h
export function driveEstimate(a: GeoPoint, b: GeoPoint): { distance_km: number; drive_min: number } {
  const roadKm = haversineKm(a, b) * 1.3;
  return { distance_km: Math.round(roadKm * 10) / 10, drive_min: Math.round((roadKm / 60) * 60) };
}
