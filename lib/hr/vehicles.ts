// Wspólna logika Floty: sanityzacja pól pojazdu + kategorie kosztów
// (koszt pojazdu ZAWSZE księguje się w bilansie — reguła zliczania).

export const VEHICLE_FIELDS = ['make', 'model', 'registration', 'vin', 'year', 'mileage', 'status', 'driver_name', 'contract_id', 'insurance_until', 'inspection_until', 'seats', 'notes',
  // główny użytkownik (dowolna rola systemu lub pracownik z kartoteki) + prawo jazdy (OCR lub ręcznie)
  'main_user_kind', 'main_user_id', 'main_user_name', 'license_name', 'license_number', 'license_categories', 'license_expiry'];
const NUM_FIELDS = ['year', 'mileage', 'seats'];
export const VEHICLE_STATUSES: [string, string][] = [['aktywny', 'Aktywny'], ['serwis', 'W serwisie'], ['wycofany', 'Wycofany']];

export const COST_KINDS: Record<string, { label: string; accCategory: string }> = {
  paliwo:        { label: 'Paliwo',        accCategory: 'flota_paliwo' },
  serwis:        { label: 'Serwis/naprawa', accCategory: 'flota_serwis' },
  ubezpieczenie: { label: 'Ubezpieczenie', accCategory: 'flota_ubezpieczenie' },
  oplaty:        { label: 'Opłaty (winiety, parking, myjnia)', accCategory: 'flota_oplaty' },
  inne:          { label: 'Inne',          accCategory: 'flota_inne' },
};

export function buildVehicleRow(b: any, row: any) {
  for (const f of VEHICLE_FIELDS) {
    if (!(f in b)) continue;
    if (NUM_FIELDS.includes(f)) row[f] = b[f] === '' || b[f] == null ? null : Number(b[f]);
    else if (f === 'contract_id' || f === 'main_user_id') row[f] = b[f] || null;
    else if (f === 'main_user_kind') row[f] = ['user', 'employee'].includes(b[f]) ? b[f] : null;
    else if (f === 'status') row[f] = VEHICLE_STATUSES.some(([v]) => v === b[f]) ? b[f] : 'aktywny';
    else row[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : (b[f] ?? null);
  }
  return row;
}
