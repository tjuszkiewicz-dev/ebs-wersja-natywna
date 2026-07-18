/**
 * Jednorazowy import szablonów dokumentów HR z bazy BBS do EBS (E2c).
 * Kopiuje hr_doc_templates: name/content_html/has_letterhead/sort/category/kind.
 * NIE kopiuje id (EBS generuje własne) ani created_by (userzy różnią się między systemami).
 * Upsert po `name` (natural key) — bezpieczny rerun, nie duplikuje przy powtórnym uruchomieniu.
 * W content_html podmienia odwołania do starego logo BBS (znmp-logo) na nowe EBS
 * (ebs-neon-no-bg), zarówno .png jak i .jpg.
 *
 * Uruchom:  npx tsx --env-file=.env.local scripts/import-bbs-doc-templates.mts
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

function swapLogo(html: string): string {
  return html
    .replace(/znmp-logo\.png/g, 'ebs-neon-no-bg.png')
    .replace(/znmp-logo\.jpg/g, 'ebs-neon-no-bg.jpg')
    .replace(/znmp-logo/g, 'ebs-neon-no-bg');
}

const bbsEnv = parseEnvFile(BBS_ENV_PATH);
const src = createClient(bbsEnv.NEXT_PUBLIC_SUPABASE_URL ?? '', bbsEnv.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } });
const dst = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } });

if (!bbsEnv.NEXT_PUBLIC_SUPABASE_URL || !bbsEnv.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Brak kredencjałów BBS (BBS-Unified/.env.local)'); process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Brak kredencjałów EBS (.env.local — uruchom z --env-file=.env.local)'); process.exit(1);
}

const { data: templates, error: srcErr } = await src.from('hr_doc_templates').select('*');
if (srcErr) { console.error('BBS hr_doc_templates:', srcErr.message); process.exit(1); }

if (!templates || templates.length === 0) {
  console.log('BBS hr_doc_templates: brak wierszy — nic do skopiowania.');
  process.exit(0);
}

// Brak unikalnego constraintu na `name` w hr_doc_templates -> nie można użyć
// .upsert(..., { onConflict: 'name' }) (Postgres wymaga unique/exclusion
// constraint na kolumnie konfliktu). Zamiast tego: ręczny insert-lub-update po
// nazwie, żeby rerun był bezpieczny (bez duplikatów).
const { data: existing, error: existErr } = await dst.from('hr_doc_templates').select('id, name');
if (existErr) { console.error('EBS hr_doc_templates (odczyt):', existErr.message); process.exit(1); }
const existingByName = new Map((existing ?? []).map((r: any) => [r.name, r.id]));

let copied = 0, updated = 0, failed = 0;
for (const t of templates as any[]) {
  const row = {
    name: t.name,
    content_html: swapLogo(t.content_html ?? ''),
    has_letterhead: t.has_letterhead ?? false,
    sort: t.sort ?? 0,
    category: t.category ?? 'pracownicze',
    kind: t.kind ?? 'html',
  };
  const existingId = existingByName.get(t.name);
  if (existingId) {
    const { error } = await dst.from('hr_doc_templates').update(row).eq('id', existingId);
    if (error) { failed++; console.error(`✗ ${t.name}: ${error.message}`); }
    else { updated++; console.log(`↻ zaktualizowano: ${t.name}`); }
  } else {
    const { error } = await dst.from('hr_doc_templates').insert(row);
    if (error) { failed++; console.error(`✗ ${t.name}: ${error.message}`); }
    else { copied++; console.log(`✓ skopiowano: ${t.name}`); }
  }
}

console.log(`\nGotowe. Nowe: ${copied}, zaktualizowane: ${updated}, błędy: ${failed} (z ${templates.length} w BBS).`);
