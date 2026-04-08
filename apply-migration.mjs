// apply-migration.mjs — wgrywa dowolny plik SQL do Supabase
// Próbuje: 1) Management API (api.supabase.com)  2) bezpośredni pg przez pooler
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();

const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
const sqlFile = process.argv[2] ?? 'supabase/migrations/011_dev_cleanup_proc.sql';
const sql = readFileSync(sqlFile, 'utf8');

console.log(`Projekt: ${projectRef}`);
console.log(`Plik SQL: ${sqlFile}\n`);

// Próba 1: Supabase Management API (wymaga access tokena = svc key tu nie działa, ale spróbujmy)
console.log('Próba 1: Supabase Management API...');
const mgmtResp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${svc}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});
const mgmtText = await mgmtResp.text();
console.log(`Status: ${mgmtResp.status}`);
console.log(`Odpowiedź: ${mgmtText.slice(0, 300)}`);

if (mgmtResp.ok) {
  console.log('\n✅ Migracja wgrana przez Management API!');
  process.exit(0);
}

// Próba 2: REST RPC (jeśli exec_sql istnieje)
console.log('\nPróba 2: REST RPC exec_sql...');
const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': svc,
    'Authorization': `Bearer ${svc}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});
const rpcText = await rpcResp.text();
console.log(`Status: ${rpcResp.status}`);
console.log(`Odpowiedź: ${rpcText.slice(0, 300)}`);

if (rpcResp.ok) {
  console.log('\n✅ Migracja wgrana przez exec_sql RPC!');
  process.exit(0);
}

console.log('\n❌ Żadna metoda nie zadziałała.');
console.log('\n📋 Wklej ręcznie w Supabase Dashboard → SQL Editor:');
console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
process.exit(1);
