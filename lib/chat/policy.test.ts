import { describe, it, expect } from 'vitest';
import { canConverse, isStaff, isExternal, isTempWorker, pairKey, EXTERNAL_ROLES } from './policy';

const STAFF = ['superadmin', 'owner', 'dyrektor', 'menedzer', 'partner', 'leadowiec', 'hr', 'koordynator', 'szef_koordynatorow', 'platnik', 'ksiegowa_wlasna'];

describe('klasyfikacja ról (D6: „cała firma ma, tylko obcy nie")', () => {
  it('pracodawca i pracownik są zewnętrzni', () => {
    expect(EXTERNAL_ROLES).toEqual(['pracodawca', 'pracownik']);
    for (const r of EXTERNAL_ROLES) { expect(isExternal(r)).toBe(true); expect(isStaff(r)).toBe(false); }
  });
  it('każda inna rola — także własna spoza listy i leadowiec bez wpisu w app_roles — jest personelem', () => {
    for (const r of STAFF) expect(isStaff(r)).toBe(true);
  });
  it('pracownik tymczasowy nie jest personelem ani zewnętrznym', () => {
    expect(isTempWorker('pracownik_tymczasowy')).toBe(true);
    expect(isStaff('pracownik_tymczasowy')).toBe(false);
    expect(isExternal('pracownik_tymczasowy')).toBe(false);
  });
  it('pusta rola nie jest personelem', () => {
    expect(isStaff('')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
  it('pairKey sortuje alfabetycznie', () => {
    expect(pairKey('partner', 'dyrektor')).toEqual(['dyrektor', 'partner']);
    expect(pairKey('a', 'a')).toEqual(['a', 'a']);
  });
});

describe('canConverse — personel', () => {
  it('personel ↔ personel: dozwolone dla każdej pary', () => {
    for (const a of STAFF) for (const b of STAFF) expect(canConverse(a, b).ok).toBe(true);
  });
  it('para zablokowana w chat_policy → odmowa, symetrycznie', () => {
    const blocked = new Set(['dyrektor|partner']);
    expect(canConverse('partner', 'dyrektor', { blocked }).ok).toBe(false);
    expect(canConverse('dyrektor', 'partner', { blocked }).ok).toBe(false);
    expect(canConverse('partner', 'menedzer', { blocked }).ok).toBe(true);
  });
  it('blokada nie działa na superadmina', () => {
    const blocked = new Set(['partner|superadmin']);
    expect(canConverse('partner', 'superadmin', { blocked }).ok).toBe(true);
  });
});

describe('canConverse — role zewnętrzne (pracodawca, pracownik)', () => {
  it('nie rozmawiają z nikim, także z personelem', () => {
    for (const ext of EXTERNAL_ROLES) for (const s of ['dyrektor', 'koordynator', 'hr']) {
      expect(canConverse(ext, s).ok).toBe(false);
      expect(canConverse(s, ext).ok).toBe(false);
    }
    expect(canConverse('pracodawca', 'pracownik').ok).toBe(false);
  });
  it('wyjątek: superadmin/owner może pisać do każdego (interwencja)', () => {
    expect(canConverse('superadmin', 'pracodawca').ok).toBe(true);
    expect(canConverse('owner', 'pracownik').ok).toBe(true);
  });
});

describe('canConverse — pracownik tymczasowy (D3)', () => {
  const W = 'pracownik_tymczasowy';
  it('ze SWOIM koordynatorem: dozwolone, w obie strony', () => {
    expect(canConverse(W, 'koordynator', { idA: 'w1', idB: 'k1', coordinatorOfA: 'k1' }).ok).toBe(true);
    expect(canConverse('koordynator', W, { idA: 'k1', idB: 'w1', coordinatorOfB: 'k1' }).ok).toBe(true);
  });
  it('z CUDZYM koordynatorem: odmowa', () => {
    expect(canConverse(W, 'koordynator', { idA: 'w1', idB: 'k2', coordinatorOfA: 'k1' }).ok).toBe(false);
  });
  it('z personelem niebędącym koordynatorem (dyrektor, hr): odmowa', () => {
    expect(canConverse(W, 'dyrektor', { idA: 'w1', idB: 'd1', coordinatorOfA: 'k1' }).ok).toBe(false);
    expect(canConverse('hr', W, { idA: 'h1', idB: 'w1', coordinatorOfB: 'k1' }).ok).toBe(false);
  });
  it('bez przypisanego koordynatora: odmowa z czytelnym powodem', () => {
    const v = canConverse(W, 'koordynator', { idA: 'w1', idB: 'k1', coordinatorOfA: null });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/koordynatora/);
  });
  it('dwóch pracowników tymczasowych: odmowa', () => {
    expect(canConverse(W, W, { idA: 'w1', idB: 'w2', coordinatorOfA: 'k1', coordinatorOfB: 'k1' }).ok).toBe(false);
  });
  it('superadmin z pracownikiem tymczasowym: dozwolone (bez kontekstu)', () => {
    expect(canConverse('superadmin', W).ok).toBe(true);
  });
});

describe('symetria', () => {
  it('wynik nie zależy od kolejności stron', () => {
    const cases: [string, string][] = [['partner', 'dyrektor'], ['pracodawca', 'hr'], ['superadmin', 'pracownik'], ['hr', 'koordynator']];
    for (const [a, b] of cases) expect(canConverse(a, b).ok).toBe(canConverse(b, a).ok);
  });
});
