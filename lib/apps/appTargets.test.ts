import { describe, it, expect } from 'vitest';
import { Role } from '@/types/enums';
import { existingAppTarget } from './appTargets';
import { resolvePostLogin } from '@/lib/auth/postLoginRedirect';

// Decyzja właściciela z 2026-09-15: „Benefity" = aplikacja pracownicza dla każdej roli,
// panel administratora ma własny kafelek „Administracja".
describe('existingAppTarget — kafelek Benefity prowadzi do portalu pracownika', () => {
  it('EMPLOYEE → portal pracownika', () => {
    expect(existingAppTarget('benefity', Role.EMPLOYEE)).toBe('/dashboard/employee');
  });

  it('HR (pracodawca) → panel pracodawcy', () => {
    expect(existingAppTarget('benefity', Role.HR)).toBe('/dashboard/employer');
  });

  it('SUPERADMIN (i owner, znormalizowany do superadmina) → portal pracownika, nie panel admina', () => {
    expect(existingAppTarget('benefity', Role.SUPERADMIN)).toBe('/dashboard/employee');
  });

  it('Administracja → panel admina tylko dla superadmina', () => {
    expect(existingAppTarget('administracja', Role.SUPERADMIN)).toBe('/dashboard/admin');
    expect(existingAppTarget('administracja', Role.EMPLOYEE)).toBeNull();
    expect(existingAppTarget('administracja', Role.COORDINATOR)).toBeNull();
  });

  it('Agencja Pracy: superadmin → panel admina od razu na sekcji agencji, koordynator/płatnik → panel admina, pracownik tymczasowy → własny portal', () => {
    expect(existingAppTarget('agencja', Role.SUPERADMIN)).toBe('/dashboard/admin?view=hr-pracownicy');
    expect(existingAppTarget('agencja', Role.COORDINATOR)).toBe('/dashboard/admin');
    expect(existingAppTarget('agencja', Role.TEMP_WORKER)).toBe('/dashboard/agencja');
  });
});

describe('resolvePostLogin — logowanie nie zmienia się przez nowy kafelek', () => {
  it('pracownik z jedną appką ląduje od razu w portalu', () => {
    expect(resolvePostLogin(Role.EMPLOYEE, ['benefity'])).toBe('/dashboard/employee');
  });

  it('superadmin z trzema appkami ląduje w launcherze', () => {
    expect(resolvePostLogin(Role.SUPERADMIN, ['benefity', 'agencja', 'administracja'])).toBe('/launcher');
  });
});
