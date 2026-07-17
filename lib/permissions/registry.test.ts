import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLE_PERMS, AGENCJA_TABS } from './registry';

describe('permissions registry (EBS E1)', () => {
  it('klucze unikalne', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });
  it('bez kluczy CRM (wykluczony moduł)', () => {
    expect(ALL_PERMISSIONS.some(k => k.startsWith('crm.'))).toBe(false);
  });
  it('DEFAULT_ROLE_PERMS odwołuje się tylko do istniejących kluczy', () => {
    const all = new Set(ALL_PERMISSIONS);
    for (const perms of Object.values(DEFAULT_ROLE_PERMS)) {
      for (const p of perms) expect(all.has(p)).toBe(true);
    }
  });
  it('grupy: Panel systemowy, Benefity i Agencja Pracy', () => {
    expect(PERMISSION_GROUPS.map(g => g.name)).toEqual(['Panel systemowy', 'Benefity', 'Agencja Pracy']);
  });
  it('AGENCJA_TABS = 14 kluczy tab (bez mapa i delete)', () => {
    expect(AGENCJA_TABS).toHaveLength(14);
    expect(AGENCJA_TABS.every(k => k.startsWith('agencja.'))).toBe(true);
    expect(AGENCJA_TABS).not.toContain('agencja.mapa');
    expect(AGENCJA_TABS).not.toContain('agencja.delete');
  });
  it('koordynator domyślnie: AGENCJA_TABS + mapa; pracodawca/dyrektor/hr NIC z agencji (EBS-adaptacja)', () => {
    expect(DEFAULT_ROLE_PERMS['koordynator']).toEqual([...AGENCJA_TABS, 'agencja.mapa']);
    for (const r of ['pracodawca', 'dyrektor', 'hr']) {
      expect((DEFAULT_ROLE_PERMS[r] ?? []).some(k => k.startsWith('agencja.'))).toBe(false);
    }
  });
});
