import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLE_PERMS } from './registry';

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
  it('grupy: Panel systemowy i Benefity', () => {
    expect(PERMISSION_GROUPS.map(g => g.name)).toEqual(['Panel systemowy', 'Benefity']);
  });
});
