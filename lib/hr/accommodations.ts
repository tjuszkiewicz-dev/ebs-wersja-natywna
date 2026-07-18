// Wspólna logika zapisu bazy noclegowej (POST i PATCH):
// sanityzacja pól, czynsz z rozbicia (cena/os. × wynajęte miejsca), geokodowanie.
import { geocodeAddress } from '@/lib/hr/geo';

export const ACC_FIELDS = ['name', 'type', 'address', 'street', 'house_no', 'apartment_no', 'postal_code', 'city', 'voivodeship', 'county', 'commune', 'post_office', 'capacity', 'description', 'phone', 'contact_person', 'notes', 'available_from', 'lease_end_date', 'monthly_rent', 'deposit', 'deposit_returned', 'rented_spots', 'price_per_person', 'vat_rate', 'media_included', 'contract_id'];
const NUM_FIELDS = ['capacity', 'monthly_rent', 'deposit', 'rented_spots', 'price_per_person', 'vat_rate'];

export function buildAccRow(b: any, row: any) {
  for (const f of ACC_FIELDS) {
    if (!(f in b)) continue;
    if (NUM_FIELDS.includes(f)) row[f] = b[f] === '' || b[f] == null ? null : Number(b[f]);
    else if (f === 'deposit_returned' || f === 'media_included') row[f] = !!b[f];
    else if (f === 'contract_id') row[f] = b[f] || null;
    else row[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : (b[f] ?? null);
  }
  if ('contacts' in b) {
    // lista osób kontaktowych: {name, phone, role} — np. właściciel + koordynator budynku
    row.contacts = Array.isArray(b.contacts)
      ? b.contacts
          .filter((c: any) => c && (String(c.name || '').trim() || String(c.phone || '').trim()))
          .map((c: any) => ({ name: String(c.name || '').trim(), phone: String(c.phone || '').trim(), role: String(c.role || '').trim() }))
          .slice(0, 10)
      : null;
  }
  return row;
}

// Złożony adres z pól strukturalnych: „Ulica 12/3, 00-000 Miasto".
// Gdy podano jakiekolwiek pole strukturalne, address = złożony string
// (mapy, geokodowanie, dokumenty); bez pól — address zostaje jak wpisany.
export function composeAccAddress(row: any) {
  const street = [row.street, row.house_no ? String(row.house_no) + (row.apartment_no ? `/${row.apartment_no}` : '') : null].filter(Boolean).join(' ').trim();
  const cityPart = [row.postal_code, row.city].filter(Boolean).join(' ').trim();
  const composed = [street, cityPart].filter(Boolean).join(', ');
  if (composed) row.address = composed;
  return row;
}

// czynsz z rozbicia: cena/os. (NETTO) × wynajęte miejsca — monthly_rent trzyma NETTO,
// żeby bilans Księgowości dalej zliczał spójnie; brutto wylicza UI z vat_rate
export function computeAccRent(row: any) {
  const price = Number(row.price_per_person || 0);
  const spots = Number(row.rented_spots || 0);
  if (price > 0 && spots > 0) row.monthly_rent = Math.round(price * spots * 100) / 100;
  return row;
}

// geokodowanie best-effort — brak wyniku nie blokuje zapisu
export async function withAccGeo(row: any, prevAddress?: string | null) {
  if (row.address && row.address !== prevAddress) {
    const pt = await geocodeAddress(row.address);
    if (pt) { row.lat = pt.lat; row.lng = pt.lng; row.geocoded_at = new Date().toISOString(); }
  }
  return row;
}
