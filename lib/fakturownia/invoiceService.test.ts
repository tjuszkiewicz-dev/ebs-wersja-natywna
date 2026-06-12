import { describe, it, expect, vi } from 'vitest';
import { ensureClient } from './invoiceService';

function fakeSupabase(companyRow: any, updateSpy = vi.fn()) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        single: () => Promise.resolve({ data: companyRow }),
        update(payload: any) { updateSpy(payload); return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
}

describe('ensureClient', () => {
  it('returns cached fakturownia_client_id without calling FA', async () => {
    const fa = { findClientByNip: vi.fn(), createClient: vi.fn() };
    const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: 42 };
    const id = await ensureClient(fakeSupabase(company) as any, fa as any, company as any);
    expect(id).toBe(42);
    expect(fa.findClientByNip).not.toHaveBeenCalled();
  });

  it('finds by NIP, caches the id, and returns it', async () => {
    const fa = { findClientByNip: vi.fn().mockResolvedValue({ id: 7 }), createClient: vi.fn() };
    const updateSpy = vi.fn();
    const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: null,
      address_street: 'Junony 23', address_city: 'Gdańsk', address_zip: '80-299' };
    const id = await ensureClient(fakeSupabase(company, updateSpy) as any, fa as any, company as any);
    expect(id).toBe(7);
    expect(updateSpy).toHaveBeenCalledWith({ fakturownia_client_id: 7 });
  });

  it('creates a client when none exists', async () => {
    const fa = { findClientByNip: vi.fn().mockResolvedValue(null),
      createClient: vi.fn().mockResolvedValue({ id: 9 }) };
    const company = { id: 'c1', nip: '5842867357', name: 'X', fakturownia_client_id: null };
    const id = await ensureClient(fakeSupabase(company) as any, fa as any, company as any);
    expect(id).toBe(9);
    expect(fa.createClient).toHaveBeenCalled();
  });
});
