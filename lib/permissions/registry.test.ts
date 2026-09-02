import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLE_PERMS, AGENCJA_TABS, PERMISSION_MENU } from './registry';

describe('permissions registry (EBS E1)', () => {
  it('klucze unikalne', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });
  // CRM był wykluczony do E6; od E7 wchodzi do zakresu (decyzja usera 2026-08-31).
  it('grupa CRM ma komplet kluczy etapów E7a–E7e + rezerwację poczty dla E6d', () => {
    const group = PERMISSION_GROUPS.find(g => g.name === 'CRM');
    expect(group).toBeDefined();
    expect(group!.perms.map(p => p.key)).toEqual([
      'crm.pipeline', 'crm.kontakty', 'crm.kalendarz', 'crm.kalkulator',
      'crm.leaderboard', 'crm.org-chart', 'crm.notatki', 'crm.poczta', 'crm.delete',
    ]);
  });
  it('DEFAULT_ROLE_PERMS odwołuje się tylko do istniejących kluczy', () => {
    const all = new Set(ALL_PERMISSIONS);
    for (const perms of Object.values(DEFAULT_ROLE_PERMS)) {
      for (const p of perms) expect(all.has(p)).toBe(true);
    }
  });
  it('grupy: Panel systemowy, Benefity, Księgowość, Agencja Pracy i CRM', () => {
    expect(PERMISSION_GROUPS.map(g => g.name)).toEqual(['Panel systemowy', 'Benefity', 'Księgowość', 'Agencja Pracy', 'CRM']);
  });
  it('grupa Księgowość ma klucze ksiegowosc.faktury i ksiegowosc.bilans, oba w ALL_PERMISSIONS', () => {
    const group = PERMISSION_GROUPS.find(g => g.name === 'Księgowość');
    expect(group).toBeDefined();
    expect(group!.perms.map(p => p.key)).toEqual(['ksiegowosc.faktury', 'ksiegowosc.bilans']);
    expect(ALL_PERMISSIONS).toContain('ksiegowosc.faktury');
    expect(ALL_PERMISSIONS).toContain('ksiegowosc.bilans');
  });
  it('AGENCJA_TABS = 14 kluczy tab (bez mapa i delete)', () => {
    expect(AGENCJA_TABS).toHaveLength(14);
    expect(AGENCJA_TABS.every(k => k.startsWith('agencja.'))).toBe(true);
    expect(AGENCJA_TABS).not.toContain('agencja.mapa');
    expect(AGENCJA_TABS).not.toContain('agencja.delete');
  });
  it('koordynator domyślnie: AGENCJA_TABS + mapa + ksiegowosc.faktury; pracodawca/hr NIC z agencji (EBS-adaptacja)', () => {
    expect(DEFAULT_ROLE_PERMS['koordynator']).toEqual([...AGENCJA_TABS, 'agencja.mapa', 'ksiegowosc.faktury']);
    for (const r of ['pracodawca', 'hr']) {
      expect((DEFAULT_ROLE_PERMS[r] ?? []).some(k => k.startsWith('agencja.'))).toBe(false);
    }
  });
  it('dyrektor domyślnie ma pełną Księgowość i CRM, ale nic z agencji', () => {
    expect(DEFAULT_ROLE_PERMS['dyrektor']).toEqual([
      'ksiegowosc.faktury', 'ksiegowosc.bilans',
      'crm.pipeline', 'crm.kontakty', 'crm.kalendarz',
      'crm.kalkulator', 'crm.leaderboard', 'crm.org-chart', 'crm.notatki',
    ]);
    expect((DEFAULT_ROLE_PERMS['dyrektor'] ?? []).some(k => k.startsWith('agencja.'))).toBe(false);
  });

  it('PERMISSION_MENU: sekcja CRM pokrywa całą falę E7 (pipeline → notatki)', () => {
    const crm = PERMISSION_MENU.filter(m => m.section === 'CRM').map(m => m.view);
    expect(crm).toEqual([
      'crm-pipeline', 'crm-kontakty', 'crm-kalendarz',
      'crm-kalkulator', 'crm-leaderboard', 'crm-org-chart', 'crm-notatki',
    ]);
  });

  it('role sprzedażowe dostają pipeline CRM domyślnie, a pracodawca/pracownik nie', () => {
    for (const r of ['partner', 'menedzer', 'dyrektor']) {
      expect(DEFAULT_ROLE_PERMS[r]).toContain('crm.pipeline');
    }
    for (const r of ['pracodawca', 'pracownik', 'hr', 'platnik', 'pracownik_tymczasowy']) {
      expect((DEFAULT_ROLE_PERMS[r] ?? []).some(k => k.startsWith('crm.'))).toBe(false);
    }
  });
  it('PERMISSION_MENU: sekcja Agencja Pracy pokrywa hr-pracownicy i hr-flota', () => {
    const views = PERMISSION_MENU.map(m => m.view);
    expect(views).toContain('hr-pracownicy');
    expect(views).toContain('hr-flota');
    for (const m of PERMISSION_MENU) {
      expect(m.anyOf.length).toBeGreaterThan(0);
      for (const p of m.anyOf) expect(ALL_PERMISSIONS).toContain(p);
    }
  });
});
