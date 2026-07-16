/**
 * Jednorazowy import definicji ról i uprawnień z bazy BBS do EBS (decyzja E1).
 * Kopiuje: app_roles (role własne, customized) + role_permissions BEZ kluczy crm.*
 * (CRM wykluczony; klucze agencja.* / ksiegowosc.* zostają — użyją ich E2/E4).
 * NIE kopiuje user_permissions (ID userów różnią się między systemami)
 * ani admin_view_config (katalogi widoków BBS ≠ EBS).
 *
 * Uruchom:  npx tsx --env-file=.env.local scripts/import-bbs-permissions.mts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const BBS_ENV_PATH = 'C:/Users/Użytkownik/Desktop/BBS-Unified/.env.local';

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '').trim();
  }
  return out;
}

const bbsEnv = parseEnvFile(BBS_ENV_PATH);
const src = createClient(bbsEnv.NEXT_PUBLIC_SUPABASE_URL ?? '', bbsEnv.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } });
const dst = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } });

if (!bbsEnv.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('Brak kredencjałów (BBS .env.local lub EBS .env.local)'); process.exit(1);
}

// 1) app_roles — tylko role własne (customized) + systemowe nieznane w EBS pomijamy
const { data: roles, error: rolesErr } = await src.from('app_roles').select('*');
if (rolesErr) { console.error('BBS app_roles:', rolesErr.message); process.exit(1); }
const customRoles = (roles ?? []).filter((r: any) => r.customized && r.role !== 'owner');
for (const r of customRoles) {
  const { error } = await dst.from('app_roles')
    .upsert({ role: r.role, label: r.label, is_system: false, customized: true }, { onConflict: 'role' });
  console.log(error ? `✗ rola ${r.role}: ${error.message}` : `✓ rola ${r.role} (${r.label})`);
}

// 2) role_permissions — dla przeniesionych ról, bez kluczy crm.*
const roleKeys = customRoles.map((r: any) => r.role);
if (roleKeys.length) {
  const { data: perms, error: permsErr } = await src.from('role_permissions').select('*').in('role', roleKeys);
  if (permsErr) { console.error('BBS role_permissions:', permsErr.message); process.exit(1); }
  const filtered = (perms ?? []).filter((p: any) => !String(p.permission).startsWith('crm.'));
  let ok = 0, fail = 0;
  for (const p of filtered) {
    const { error } = await dst.from('role_permissions')
      .upsert({ role: p.role, permission: p.permission }, { onConflict: 'role,permission' });
    if (error) { fail++; console.error(`✗ ${p.role}/${p.permission}:`, error.message); } else ok++;
  }
  console.log(`role_permissions: ${ok} skopiowane, ${fail} błędów (crm.* odfiltrowane: ${(perms ?? []).length - filtered.length})`);
} else {
  console.log('Brak ról własnych w BBS — nic do skopiowania.');
}
console.log('Gotowe.');
