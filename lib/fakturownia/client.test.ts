import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakturowniaClient } from './client';

const OK = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe('FakturowniaClient', () => {
  const fetchMock = vi.fn();
  const client = new FakturowniaClient('demo', 'TOKEN', fetchMock as unknown as typeof fetch);

  beforeEach(() => fetchMock.mockReset());

  it('finds a client by NIP, returning null when none match', async () => {
    fetchMock.mockReturnValueOnce(OK([]));
    const result = await client.findClientByNip('5842867357');
    expect(result).toBeNull();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('https://demo.fakturownia.pl/clients.json');
    expect(url).toContain('tax_no=5842867357');
    expect(url).toContain('api_token=TOKEN');
  });

  it('returns the first client when NIP matches', async () => {
    fetchMock.mockReturnValueOnce(OK([{ id: 7, name: 'X', tax_no: '5842867357' }]));
    const result = await client.findClientByNip('5842867357');
    expect(result).toEqual({ id: 7, name: 'X', tax_no: '5842867357' });
  });

  it('creates an invoice via POST /invoices.json', async () => {
    fetchMock.mockReturnValueOnce(OK({ id: 99, number: 'FV/2026/1', token: 'abc', status: 'issued' }));
    const inv = await client.createInvoice({
      kind: 'vat', client_id: 7, issue_date: '2026-06-12',
      positions: [{ name: 'Fee', quantity: 1, price_net: 100, tax: 23 }],
    });
    expect(inv.id).toBe(99);
    expect(inv.token).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://demo.fakturownia.pl/invoices.json');
    expect((init as RequestInit).method).toBe('POST');
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.api_token).toBe('TOKEN');
    expect(sent.invoice.kind).toBe('vat');
  });

  it('throws on non-OK HTTP response', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 422, text: () => Promise.resolve('bad') } as Response),
    );
    await expect(client.getInvoice(1)).rejects.toThrow(/422/);
  });
});
