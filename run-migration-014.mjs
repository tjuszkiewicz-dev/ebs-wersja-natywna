// Run migration 014: krs/regon on companies, umowa_pdf_url on voucher_orders
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();

if (!url || !svc) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(url, svc);

const queries = [
  "ALTER TABLE companies ADD COLUMN IF NOT EXISTS krs TEXT;",
  "ALTER TABLE companies ADD COLUMN IF NOT EXISTS regon TEXT;",
  "ALTER TABLE voucher_orders ADD COLUMN IF NOT EXISTS umowa_pdf_url TEXT;",
];

for (const query of queries) {
  const { error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    console.error(`FAILED: ${query}\n  ${error.message}`);
  } else {
    console.log(`OK: ${query}`);
  }
}
