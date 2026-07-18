// Checklist „gotowy do pracy" — czysta funkcja liczona z danych pracownika.
// Używana w UI (karta pracownika, lista kontraktów) i może być wołana serwerowo.
export type CheckStatus = 'ok' | 'missing' | 'expired';
export interface ReadinessCheck { key: string; label: string; status: CheckStatus; date?: string | null }
export interface Readiness { ready: boolean; done: number; total: number; checks: ReadinessCheck[] }

export interface ReadinessEmployee {
  pesel?: string | null;
  passport_number?: string | null; passport_expiry?: string | null;
  visa_expiry?: string | null;
  residence_card_number?: string | null; residence_card_expiry?: string | null;
  work_permit_number?: string | null; work_permit_expiry?: string | null;
  zus_registration_date?: string | null;
  medical_exam_expiry?: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

// dokument z datą ważności: brak → missing, wygasły → expired, ważny → ok
const byExpiry = (has: boolean, expiry?: string | null): CheckStatus => {
  if (!has && !expiry) return 'missing';
  if (expiry && expiry < today()) return 'expired';
  return 'ok';
};

export function computeReadiness(e: ReadinessEmployee): Readiness {
  const checks: ReadinessCheck[] = [];

  // paszport
  checks.push({ key: 'passport', label: 'Paszport', status: byExpiry(!!e.passport_number, e.passport_expiry), date: e.passport_expiry });

  // PESEL
  checks.push({ key: 'pesel', label: 'PESEL', status: e.pesel && String(e.pesel).trim() ? 'ok' : 'missing' });

  // podstawa pobytu/pracy: wystarczy JEDNA ważna (wiza / karta pobytu / pozwolenie)
  const bases = [
    { has: !!e.visa_expiry, exp: e.visa_expiry },
    { has: !!e.residence_card_number || !!e.residence_card_expiry, exp: e.residence_card_expiry },
    { has: !!e.work_permit_number || !!e.work_permit_expiry, exp: e.work_permit_expiry },
  ];
  const anyValid = bases.some(b => b.has && (!b.exp || b.exp >= today()));
  const anyPresent = bases.some(b => b.has);
  const soonest = bases.filter(b => b.exp).map(b => b.exp!).sort()[0] || null;
  checks.push({ key: 'legal', label: 'Podstawa pobytu/pracy', status: anyValid ? 'ok' : anyPresent ? 'expired' : 'missing', date: soonest });

  // ZUS
  checks.push({ key: 'zus', label: 'Zgłoszenie do ZUS', status: e.zus_registration_date ? 'ok' : 'missing', date: e.zus_registration_date });

  // badania lekarskie
  checks.push({ key: 'medical', label: 'Badania lekarskie', status: byExpiry(!!e.medical_exam_expiry, e.medical_exam_expiry), date: e.medical_exam_expiry });

  const done = checks.filter(c => c.status === 'ok').length;
  return { ready: done === checks.length, done, total: checks.length, checks };
}
