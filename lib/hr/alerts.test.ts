import { describe, it, expect } from 'vitest';
import { buildAlerts, filterAlerts, groupOf, daysUntil } from './alerts';

const TODAY = new Date('2026-08-01T00:00:00Z');
const inDays = (n: number) => new Date(Date.UTC(2026, 7, 1 + n)).toISOString().slice(0, 10);

const emp = (over: Record<string, unknown> = {}) => ({
  id: 'e1', first_name: 'Jan', last_name: 'Testowy', status: 'active',
  contract: { name: 'Kontrakt A' }, pesel: '00000000000',
  zus_registration_date: '2026-01-01', ...over,
});

describe('daysUntil', () => {
  it('liczy dni do daty', () => expect(daysUntil(inDays(10), TODAY)).toBe(10));
  it('zwraca ujemne dla przeszlosci', () => expect(daysUntil(inDays(-5), TODAY)).toBe(-5));
  it('zwraca null dla braku daty', () => { expect(daysUntil(null, TODAY)).toBeNull(); });
});

describe('buildAlerts', () => {
  it('zglasza paszport wygasajacy w progu 60 dni', () => {
    const out = buildAlerts([emp({ passport_expiry: inDays(30) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'expiry')).toBe(true);
  });

  it('NIE zglasza paszportu poza progiem 60 dni', () => {
    const out = buildAlerts([emp({ passport_expiry: inDays(90) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'expiry')).toBe(false);
  });

  it('zglasza TLC tak samo jak inne dokumenty', () => {
    const out = buildAlerts([emp({ tlc: true, tlc_expiry: inDays(20) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'expiry' && /TLC/i.test(a.label))).toBe(true);
  });

  it('zglasza badania lekarskie w progu 60 dni', () => {
    const out = buildAlerts([emp({ medical_exam_expiry: inDays(15) })], [], [], TODAY);
    expect(out.some(a => a.kind === 'medical')).toBe(true);
  });

  it('zglasza brak numeru PESEL', () => {
    const out = buildAlerts([emp({ pesel: null })], [], [], TODAY);
    expect(out.some(a => a.kind === 'pesel')).toBe(true);
  });

  it('pomija pracownikow nieaktywnych', () => {
    const out = buildAlerts([emp({ status: 'inactive', passport_expiry: inDays(5) })], [], [], TODAY);
    expect(out).toHaveLength(0);
  });

  it('zglasza flote w progu 30 dni i pomija wycofane pojazdy', () => {
    const v = { id: 'v1', registration: 'GD123', status: 'aktywny', insurance_until: inDays(10) };
    expect(buildAlerts([], [], [v], TODAY).some(a => a.kind === 'fleet')).toBe(true);
    expect(buildAlerts([], [], [{ ...v, status: 'wycofany' }], TODAY)).toHaveLength(0);
  });

  it('zglasza koniec najmu w progu 3 dni', () => {
    const acc = { id: 'a1', name: 'Lokal 1', lease_end_date: inDays(2) };
    expect(buildAlerts([], [acc], [], TODAY).some(a => a.kind === 'lease')).toBe(true);
  });
});

describe('groupOf', () => {
  it('kwalifikuje przeterminowane jako expired', () => {
    const [a] = buildAlerts([emp({ passport_expiry: inDays(-1) })], [], [], TODAY);
    expect(groupOf(a)).toBe('expired');
  });
  it('kwalifikuje 31-60 dni jako warn', () => {
    const [a] = buildAlerts([emp({ passport_expiry: inDays(45) })], [], [], TODAY);
    expect(groupOf(a)).toBe('warn');
  });
});

describe('filterAlerts', () => {
  const items = buildAlerts(
    [emp({ passport_expiry: inDays(10) }), emp({ id: 'e2', last_name: 'Inny', pesel: null })],
    [], [], TODAY,
  );

  it('filtruje po rodzaju', () => {
    expect(filterAlerts(items, { kinds: ['pesel'] }).every(a => a.kind === 'pesel')).toBe(true);
  });
  it('filtruje po frazie w nazwisku', () => {
    expect(filterAlerts(items, { search: 'inny' }).length).toBeGreaterThan(0);
  });
  it('filtruje po maxDays', () => {
    expect(filterAlerts(items, { maxDays: 5 }).every(a => a.days === null || a.days <= 5)).toBe(true);
  });
  it('pusty filtr zwraca wszystko', () => {
    expect(filterAlerts(items, {})).toHaveLength(items.length);
  });
});
