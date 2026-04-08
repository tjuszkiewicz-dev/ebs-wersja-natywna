// Uruchamia migrację 008 bezpośrednio przez Supabase Management API
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();

if (!url || !svc) {
  console.error('Brak zmiennych środowiskowych');
  process.exit(1);
}

// Używamy Supabase pg-meta endpoint (dostępny tylko w self-hosted)
// Fallback: tworzymy API route w Next.js do wykonania SQL
const sql = readFileSync('./supabase/migrations/008_fix_voucher_trigger.sql', 'utf8');

// Próba przez REST - exec endpoint Supabase
const resp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': svc,
    'Authorization': `Bearer ${svc}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

console.log('Status:', resp.status);
const data = await resp.text();
console.log('Response:', data.slice(0, 500));
