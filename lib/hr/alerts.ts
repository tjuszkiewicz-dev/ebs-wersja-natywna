// Wspólny moduł alarmów agencji ("Dokumenty wymagające uwagi") — używany
// ZARÓWNO przez ekran (filtrowanie na liście), JAK I przez raport PDF, żeby
// jedno i drugie liczyło dokładnie to samo (bez rozjazdu reguł między
// frontem a serwerem/raportem).
//
// Port z BBS-Unified `lib/hr/alerts.ts` (commity 29119b4, 69cc0fd), z
// adaptacjami pod EBS:
// - moduł jest CZYSTY: żadnych zapytań do bazy, żadnego fetch, żadnych
//   efektów ubocznych — dostaje dane jako argumenty, zwraca dane;
// - brak importów z `@/lib/crm/*` (CRM jest w EBS świadomie wykluczony)
//   i z `@/lib/audit` (audyt w EBS robią triggery bazodanowe, nie logEvent);
// - `buildAlerts`/`daysUntil` przyjmują dodatkowy, ostatni, opcjonalny
//   parametr `today` (domyślnie `new Date()`), żeby liczenie "dziś" dało się
//   ustalić deterministycznie w testach (BBS liczy `new Date()` w środku).

export type AlertKind = 'expiry' | 'zus' | 'pesel' | 'lease' | 'medical' | 'fleet';

export interface AlertItem {
  id: string;
  kind: AlertKind;
  label: string;
  person: string;
  contract: string | null;
  date: string | null;
  days: number | null;
  employeeId: string | null;
}

const MS_PER_DAY = 86400000;

function toUTCDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Liczba dni od `today` do `date` (ujemna dla dat w przeszłości). `null`,
// gdy brak daty albo data nie parsuje się poprawnie.
export function daysUntil(date: string | null | undefined, today: Date = new Date()): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.round((toUTCDay(d) - toUTCDay(today)) / MS_PER_DAY);
}

// Termin na złożenie wniosku o kartę pobytu = 90 dni od wjazdu do strefy
// Schengen (jak w `components/agencja/expiry.ts`, zduplikowane lokalnie,
// żeby moduł alarmów nie zależał od komponentów UI).
const SCHENGEN_DAYS = 90;
function schengenDeadline(entryDate?: string | null): string | null {
  if (!entryDate) return null;
  const d = new Date(entryDate);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + SCHENGEN_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
}

// Progi (zachowane 1:1 z BBS): dokumenty i badania lekarskie ≤60 dni (lub
// wygasłe), Schengen ≤30 dni, flota (OC / przegląd / prawo jazdy) ≤30 dni,
// najem ≤3 dni.
export function buildAlerts(
  employees: any[],
  accommodations: any[],
  vehicles: any[] = [],
  today: Date = new Date(),
): AlertItem[] {
  const out: AlertItem[] = [];
  const name = (e: any) =>
    [e.first_name, e.second_name, e.last_name, e.second_last_name].filter(Boolean).join(' ');

  for (const e of employees || []) {
    // `status` (active/inactive) filtruje alarmy; `work_status`
    // (pracuje/oczekuje/urlop/zwolniony) jest czysto prezentacyjne i tu się
    // nie liczy — celowo nie jest sprawdzane.
    if (e.status !== 'active') continue;
    const contract = e.contract?.name ?? null;
    const person = name(e);

    for (const c of [
      { label: 'Paszport', date: e.passport_expiry },
      { label: 'Karta pobytu', date: e.residence_card_expiry },
      { label: 'Pozwolenie na pracę', date: e.work_permit_expiry },
      { label: 'Wiza', date: e.visa_expiry },
      { label: 'TLC — karta pobytu', date: e.tlc ? e.tlc_expiry : null },
    ]) {
      const days = daysUntil(c.date, today);
      if (days !== null && days <= 60) {
        out.push({
          id: `${e.id}-${c.label}`,
          kind: 'expiry',
          label: c.label,
          person,
          contract,
          date: c.date ?? null,
          days,
          employeeId: e.id,
        });
      }
    }

    const schDate = schengenDeadline(e.schengen_entry_date);
    const schDays = daysUntil(schDate, today);
    if (schDays !== null && schDays <= 30) {
      out.push({
        id: `${e.id}-schengen`,
        kind: 'expiry',
        label: 'Karta pobytu — 90 dni od wjazdu Schengen',
        person,
        contract,
        date: schDate,
        days: schDays,
        employeeId: e.id,
      });
    }

    // badania lekarskie (medycyna pracy) — wygasłe blokują dopuszczenie do pracy
    const medDays = daysUntil(e.medical_exam_expiry, today);
    if (medDays !== null && medDays <= 60) {
      out.push({
        id: `${e.id}-medical`,
        kind: 'medical',
        label: 'Badania lekarskie',
        person,
        contract,
        date: e.medical_exam_expiry ?? null,
        days: medDays,
        employeeId: e.id,
      });
    }

    if (!e.zus_registration_date) {
      out.push({
        id: `${e.id}-zus`,
        kind: 'zus',
        label: 'Zgłoszenie do ZUS',
        person,
        contract,
        date: null,
        days: null,
        employeeId: e.id,
      });
    }

    if (!e.pesel) {
      out.push({
        id: `${e.id}-pesel`,
        kind: 'pesel',
        label: 'Numer PESEL',
        person,
        contract,
        date: null,
        days: null,
        employeeId: e.id,
      });
    }
  }

  // FLOTA: OC, przegląd techniczny, prawo jazdy kierowcy (te same progi co digest e-mail)
  for (const v of vehicles || []) {
    if (v.status === 'wycofany') continue;
    const label = [v.make, v.model].filter(Boolean).join(' ') + (v.registration ? ` (${v.registration})` : '');
    for (const c of [
      { label: 'Ubezpieczenie OC', date: v.insurance_until },
      { label: 'Przegląd techniczny', date: v.inspection_until },
      { label: `Prawo jazdy${v.license_name ? ` — ${v.license_name}` : ''}`, date: v.license_expiry },
    ]) {
      const days = daysUntil(c.date, today);
      if (days !== null && days <= 30) {
        out.push({
          id: `${v.id}-${c.label}`,
          kind: 'fleet',
          label: c.label,
          person: label || 'Pojazd',
          contract: v.contract?.name ?? null,
          date: c.date ?? null,
          days,
          employeeId: null,
        });
      }
    }
  }

  for (const a of accommodations || []) {
    const days = daysUntil(a.lease_end_date, today);
    if (days !== null && days <= 3) {
      out.push({
        id: `${a.id}-lease`,
        kind: 'lease',
        label: `Koniec najmu · ${a.assigned_count ?? 0} prac.`,
        person: a.name,
        contract: a.contract?.name ?? null,
        date: a.lease_end_date ?? null,
        days,
        employeeId: null,
      });
    }
  }

  out.sort((x, y) => (x.days ?? 500) - (y.days ?? 500) || x.person.localeCompare(y.person, 'pl'));
  return out;
}

// ── grupowanie i filtry (te same nazwy używa ekran i raport PDF) ──

export const ALERT_GROUPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'expired', label: 'Wygasłe' },
  { id: 'soon', label: 'Wygasają ≤30 dni' },
  { id: 'warn', label: 'Wygasają 31–60 dni' },
  { id: 'medical', label: 'Badania lekarskie' },
  { id: 'fleet', label: 'Flota (OC / przegląd / prawo jazdy)' },
  { id: 'lease', label: 'Koniec najmu' },
  { id: 'zus', label: 'Bez zgłoszenia do ZUS' },
  { id: 'pesel', label: 'Bez numeru PESEL' },
];

// "Wygasłe / ≤30 dni / 31–60 dni" to grupy wg PILNOŚCI (dokumenty
// pracownika), a badania/flota/najem/ZUS/PESEL — wg RODZAJU.
export function groupOf(item: AlertItem): string {
  if (item.kind === 'zus' || item.kind === 'pesel') return item.kind;
  if (item.kind === 'lease') return 'lease';
  if (item.kind === 'medical') return 'medical';
  if (item.kind === 'fleet') return 'fleet';
  const days = item.days ?? 0;
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  return 'warn';
}

export interface AlertFilterParams {
  kinds?: string[];
  contract?: string;
  search?: string;
  maxDays?: number;
}

export function filterAlerts(items: AlertItem[], p: AlertFilterParams): AlertItem[] {
  const q = (p.search || '').trim().toLowerCase();
  return items.filter((i) => {
    if (p.kinds?.length && !p.kinds.includes(groupOf(i))) return false;
    if (p.contract && (i.contract || '') !== p.contract) return false;
    if (q && !`${i.person} ${i.label}`.toLowerCase().includes(q)) return false;
    if (p.maxDays != null && i.days != null && i.days > p.maxDays) return false;
    return true;
  });
}
