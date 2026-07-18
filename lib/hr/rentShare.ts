// Udział pracownika w czynszu noclegu = czynsz lokalu ÷ liczba miejsc.
// Reguła (user 2026-07-06): każdy pracownik ma przypisany nocleg; koszt najmu
// dzielimy na CAŁKOWITĄ liczbę miejsc w lokalu (nawet niezajętych — pracownik nie
// odpowiada za to, że nie wynajęliśmy wszystkich miejsc) i doliczamy jako jego koszt.

// Liczba miejsc do podziału: całkowite w lokalu (fallback: wynajęte przez nas).
export function accommodationSpots(acc: any): number {
  const cap = Number(acc?.capacity || 0);
  if (cap > 0) return cap;
  const rented = Number(acc?.rented_spots || 0);
  return rented > 0 ? rented : 0;
}

// Czy lokal generuje czynsz w okresie [from, to)? Start najmu = „lokal dostępny od"
// (available_from), fallback data dodania do systemu (created_at — jak dotąd).
export function rentActiveInPeriod(a: any, from: string, to: string): boolean {
  if (!(Number(a?.monthly_rent) > 0)) return false;
  const start = a?.available_from || String(a?.created_at || '').slice(0, 10);
  if (!start || start >= to) return false;
  return !a?.lease_end_date || a.lease_end_date >= from;
}

// Udział jednego pracownika w miesięcznym czynszu (NETTO — jak monthly_rent i bilans).
// 0 gdy brak czynszu lub brak miejsc.
export function rentSharePerPerson(acc: any): number {
  const spots = accommodationSpots(acc);
  const rent = Number(acc?.monthly_rent || 0);
  if (spots <= 0 || rent <= 0) return 0;
  return Math.round((rent / spots) * 100) / 100;
}
