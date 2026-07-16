import { describe, it, expect } from 'vitest';
import { resolveEntitlementWrite } from './setEntitlement';
import { Role } from '@/types/enums';

describe('resolveEntitlementWrite', () => {
  it('odbierz domyślną → upsert revoke', () => {
    expect(resolveEntitlementWrite(Role.EMPLOYEE, [], 'benefity', false))
      .toEqual({ op: 'upsert', effect: 'revoke' });
  });
  it('dodaj obcą → upsert grant', () => {
    expect(resolveEntitlementWrite(Role.ADVISOR, [], 'benefity', true))
      .toEqual({ op: 'upsert', effect: 'grant' });
  });
  it('przywróć domyślną → delete (wpis zbędny)', () => {
    expect(resolveEntitlementWrite(Role.EMPLOYEE, [{ app_id: 'benefity', effect: 'revoke' }], 'benefity', true))
      .toEqual({ op: 'delete' });
  });
  it('ukryj obcą → delete', () => {
    expect(resolveEntitlementWrite(Role.ADVISOR, [{ app_id: 'benefity', effect: 'grant' }], 'benefity', false))
      .toEqual({ op: 'delete' });
  });
});
