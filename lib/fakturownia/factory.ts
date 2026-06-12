import { FakturowniaClient } from './client';

/** Returns a configured client, or null when env is not set (integration disabled). */
export function getFakturowniaClient(): FakturowniaClient | null {
  const token = process.env.FAKTUROWNIA_API_TOKEN;
  const domain = process.env.FAKTUROWNIA_DOMAIN;
  if (!token || !domain) return null;
  return new FakturowniaClient(domain, token);
}
