// Run migration 019: voucher individual-record lifecycle (distribute_to_employee, etc.)
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();

if (!url || !svc) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(url, svc);

const sql = readFileSync('./supabase/migrations/019_voucher_lifecycle.sql', 'utf8');

const { error } = await supabase.rpc('exec_sql', { query: sql });
if (error) {
  console.error('Migration 019 FAILED:', error.message);
  process.exit(1);
} else {
  console.log('Migration 019 applied successfully.');
}
