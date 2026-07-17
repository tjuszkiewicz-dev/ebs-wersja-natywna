import { describe, it, expect } from 'vitest';
import { Role } from '@/types/enums';
import { appsForUser, canAccessApp } from './access';

describe('appsForUser (EBS E1: tylko benefity w rejestrze)', () => {
  it('EMPLOYEE → benefity', () => {
    expect(appsForUser(Role.EMPLOYEE, [])).toEqual(['benefity']);
  });

  it('HR → benefity', () => {
    expect(appsForUser(Role.HR, [])).toEqual(['benefity']);
  });

  it('SUPERADMIN → wszystkie zarejestrowane', () => {
    expect(appsForUser(Role.SUPERADMIN, []).sort()).toEqual(['agencja', 'benefity']);
  });

  it('SUPERADMIN: revoke ignorowany', () => {
    expect(appsForUser(Role.SUPERADMIN, [{ app_id: 'benefity', effect: 'revoke' }]).sort())
      .toEqual(['agencja', 'benefity']);
  });

  it('COORDINATOR → agencja; TEMP_WORKER → agencja; EMPLOYEE bez agencji', () => {
    expect(appsForUser(Role.COORDINATOR, [])).toEqual(['agencja']);
    expect(appsForUser(Role.TEMP_WORKER, [])).toEqual(['agencja']);
    expect(appsForUser(Role.EMPLOYEE, [])).toEqual(['benefity']);
  });

  it('ADVISOR bez defaultów → pusto', () => {
    expect(appsForUser(Role.ADVISOR, [])).toEqual([]);
  });

  it('grant dodaje appkę spoza defaultów roli', () => {
    expect(appsForUser(Role.ADVISOR, [{ app_id: 'benefity', effect: 'grant' }]))
      .toEqual(['benefity']);
  });

  it('revoke zabiera domyślną', () => {
    expect(appsForUser(Role.EMPLOYEE, [{ app_id: 'benefity', effect: 'revoke' }]))
      .toEqual([]);
  });

  it('canAccessApp spójny z appsForUser', () => {
    expect(canAccessApp(Role.EMPLOYEE, [], 'benefity')).toBe(true);
    expect(canAccessApp(Role.EMPLOYEE, [{ app_id: 'benefity', effect: 'revoke' }], 'benefity')).toBe(false);
  });
});
