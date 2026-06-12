import type { FaClient, FaInvoice, FaInvoiceInput } from './types';

export class FakturowniaClient {
  private base: string;
  constructor(
    domain: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.base = `https://${domain}.fakturownia.pl`;
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Fakturownia ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async findClientByNip(nip: string): Promise<FaClient | null> {
    const list = await this.req<FaClient[]>(
      `/clients.json?tax_no=${encodeURIComponent(nip)}&api_token=${this.token}`,
    );
    return list[0] ?? null;
  }

  async createClient(data: { name: string; tax_no: string; street?: string; city?: string; post_code?: string }): Promise<FaClient> {
    return this.req<FaClient>('/clients.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_token: this.token, client: { country: 'PL', ...data } }),
    });
  }

  async createInvoice(invoice: FaInvoiceInput): Promise<FaInvoice> {
    return this.req<FaInvoice>('/invoices.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_token: this.token, invoice }),
    });
  }

  async getInvoice(id: number): Promise<FaInvoice> {
    return this.req<FaInvoice>(`/invoices/${id}.json?api_token=${this.token}`);
  }

  /** Public links (token-based). Pay button shows if a gateway is configured on the account. */
  invoiceUrl(token: string): string { return `${this.base}/invoice/${token}`; }
  invoicePdfUrl(token: string): string { return `${this.base}/invoice/${token}.pdf`; }
}
