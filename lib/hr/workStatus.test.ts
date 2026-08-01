import { describe, it, expect } from 'vitest';
import { workStatusDef, isWorkStatusId, WORK_STATUSES, DEFAULT_WORK_STATUS } from './workStatus';

describe('workStatus', () => {
  it('zwraca definicję dla znanego statusu', () => {
    expect(workStatusDef('urlop').label).toBe('Urlop');
  });

  it('robi fallback do pracuje dla nieznanego statusu', () => {
    expect(workStatusDef('kosmita').id).toBe('pracuje');
  });

  it('robi fallback dla null i undefined', () => {
    expect(workStatusDef(null).id).toBe(DEFAULT_WORK_STATUS);
    expect(workStatusDef(undefined).id).toBe(DEFAULT_WORK_STATUS);
  });

  it('ma dokładnie 4 statusy z unikalnymi id', () => {
    expect(WORK_STATUSES).toHaveLength(4);
    expect(new Set(WORK_STATUSES.map(s => s.id)).size).toBe(4);
  });

  it('isWorkStatusId waliduje poprawnie', () => {
    expect(isWorkStatusId('zwolniony')).toBe(true);
    expect(isWorkStatusId('cokolwiek')).toBe(false);
  });
});
