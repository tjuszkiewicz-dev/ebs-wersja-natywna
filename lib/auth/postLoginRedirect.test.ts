import { describe, it, expect } from 'vitest';
import { Role } from '@/types/enums';
import { postLoginRedirect, resolvePostLogin } from './postLoginRedirect';
import { existingAppTarget } from '@/lib/apps/appTargets';

describe('postLoginRedirect', () => {
  it('1 appka → jej route', () =>
    expect(postLoginRedirect(['benefity'])).toBe('/app/benefity'));
  it('>1 → launcher', () =>
    expect(postLoginRedirect(['benefity', 'agencja'])).toBe('/launcher'));
  it('0 → launcher', () => expect(postLoginRedirect([])).toBe('/launcher'));
});

describe('existingAppTarget (benefity → dashboardy EBS)', () => {
  it('EMPLOYEE → /dashboard/employee', () =>
    expect(existingAppTarget('benefity', Role.EMPLOYEE)).toBe('/dashboard/employee'));
  it('HR → /dashboard/employer', () =>
    expect(existingAppTarget('benefity', Role.HR)).toBe('/dashboard/employer'));
  it('SUPERADMIN → /dashboard/admin', () =>
    expect(existingAppTarget('benefity', Role.SUPERADMIN)).toBe('/dashboard/admin'));
  it('rola sieciowa → null (brak dashboardu benefitów)', () =>
    expect(existingAppTarget('benefity', Role.ADVISOR)).toBe(null));
});

describe('existingAppTarget (agencja → dashboardy EBS)', () => {
  it('TEMP_WORKER → /dashboard/agencja', () =>
    expect(existingAppTarget('agencja', Role.TEMP_WORKER)).toBe('/dashboard/agencja'));
  it('COORDINATOR → /dashboard/admin', () =>
    expect(existingAppTarget('agencja', Role.COORDINATOR)).toBe('/dashboard/admin'));
  it('PAYROLL → /dashboard/admin', () =>
    expect(existingAppTarget('agencja', Role.PAYROLL)).toBe('/dashboard/admin'));
  it('SUPERADMIN → /dashboard/admin', () =>
    expect(existingAppTarget('agencja', Role.SUPERADMIN)).toBe('/dashboard/admin'));
  it('EMPLOYEE → null (brak dostępu do agencji)', () =>
    expect(existingAppTarget('agencja', Role.EMPLOYEE)).toBe(null));
});

describe('resolvePostLogin (final URL po zalogowaniu)', () => {
  it('EMPLOYEE z samymi benefitami → od razu dashboard (bez hopu przez /app)', () =>
    expect(resolvePostLogin(Role.EMPLOYEE, ['benefity'])).toBe('/dashboard/employee'));
  it('SUPERADMIN z 1 appką → od razu /dashboard/admin', () =>
    expect(resolvePostLogin(Role.SUPERADMIN, ['benefity'])).toBe('/dashboard/admin'));
  it('wiele appek → /launcher', () =>
    expect(resolvePostLogin(Role.SUPERADMIN, ['benefity', 'agencja'])).toBe('/launcher'));
  it('0 appek → /launcher (komunikat o braku dostępu)', () =>
    expect(resolvePostLogin(Role.ADVISOR, [])).toBe('/launcher'));
});
