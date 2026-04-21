// Run migration 020: Fix voucher valid_until timing bug + auto-expire cron support
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envRaw = readFileSync('.env.local', 'utf8').replace(/\r/g, '');

// Handle multi-line values (key=value may wrap across lines without \n)
const lines = envRaw.split('\n');
const mergedLines = lines.reduce((acc, l) => {
  if (/^[A-Z_]+=/.test(l)) acc.push(l);
  else if (acc.length) acc[acc.length - 1] += l.trim();
  return acc;
}, []);
const env = Object.fromEntries(mergedLines.map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const svc = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !svc) { console.error('Brakuje NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local'); process.exit(1); }

const supabase = createClient(url, svc);
const sql = readFileSync('./supabase/migrations/020_fix_valid_until_timing.sql', 'utf8');

console.log('Próba aplikacji migracji 020...');
const { error } = await supabase.rpc('exec_sql', { query: sql });
if (error) {
  console.error('exec_sql nie działa:', error.message);
  console.log('\n─────────────────────────────────────────────────────────');
  console.log('Wklej SQL ręcznie w Supabase Dashboard → SQL Editor:');
  console.log('https://supabase.com/dashboard/project/ramedybmybcpqvelsmxd/sql/new');
  console.log('Plik: supabase/migrations/020_fix_valid_until_timing.sql');
  console.log('─────────────────────────────────────────────────────────');
  process.exit(1);
} else {
  console.log('✅ Migracja 020 zaaplikowana pomyślnie.');
}
