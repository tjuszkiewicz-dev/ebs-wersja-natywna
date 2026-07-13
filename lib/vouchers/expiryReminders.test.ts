import { describe, it, expect } from 'vitest';
import { groupExpiringByOwner } from './expiryReminders';

describe('groupExpiringByOwner', () => {
  it('agreguje po właścicielu i liczy sztuki', () => {
    const m = groupExpiringByOwner([
      { current_owner_id: 'u1', owner_email: 'a@x.pl', owner_name: 'A' },
      { current_owner_id: 'u1', owner_email: 'a@x.pl', owner_name: 'A' },
      { current_owner_id: 'u2', owner_email: null, owner_name: 'B' },
    ]);
    expect(m.get('u1')).toEqual({ email: 'a@x.pl', name: 'A', count: 2 });
    expect(m.get('u2')?.count).toBe(1);
    expect(m.size).toBe(2);
  });
});
