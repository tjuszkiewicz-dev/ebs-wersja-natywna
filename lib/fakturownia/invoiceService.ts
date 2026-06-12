import type { SupabaseClient } from '@supabase/supabase-js';
import type { FakturowniaClient } from './client';

export interface CompanyForInvoice {
  id: string;
  nip: string;
  name: string;
  fakturownia_client_id: number | null;
  address_street?: string | null;
  address_city?: string | null;
  address_zip?: string | null;
}

export async function ensureClient(
  supabase: SupabaseClient,
  fa: FakturowniaClient,
  company: CompanyForInvoice,
): Promise<number> {
  if (company.fakturownia_client_id) return company.fakturownia_client_id;

  const found = await fa.findClientByNip(company.nip);
  const client = found ?? (await fa.createClient({
    name: company.name,
    tax_no: company.nip,
    street: company.address_street ?? undefined,
    city: company.address_city ?? undefined,
    post_code: company.address_zip ?? undefined,
  }));

  await supabase.from('companies').update({ fakturownia_client_id: client.id }).eq('id', company.id);
  return client.id;
}
