// test-exec-sql.mjs — sprawdza czy exec_sql RPC istnieje, jeśli tak — czyści dane
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();
const supabase = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

// Test: czy exec_sql istnieje?
const testResp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': svc,
    'Authorization': `Bearer ${svc}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: 'SELECT 1 AS ok' }),
});
console.log('exec_sql status:', testResp.status, await testResp.text());
