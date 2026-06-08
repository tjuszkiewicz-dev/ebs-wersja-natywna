// Zamiana e-maili logowania: rekord ANEZA ma mieć realny e-mail, rekord HAPAG alias.
// Stan voucherów/sald/company_id jest już poprawny — zmieniamy WYŁĄCZNIE auth.email.
// Kolejność: najpierw konto Hapag (real -> alias) zwalnia realny e-mail, potem Aneza (alias -> real).

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const HAPAG_TAG = 'f03ed36e';

// hapagId = konto w Hapag (ma teraz realny e-mail), anezaId = konto w Anezie (ma alias)
const PAIRS = [
  { name: 'KATARZYNA CYGAN',            real: 'katarzynacygan@op.pl',            hapagId: 'ef6863ac-a1e0-47a2-a8b7-d627f7374bd5', anezaId: 'b5d73832-2517-4ab7-8274-2f2ea196b6ee' },
  { name: 'JOANNA DROBNIKOWSKA-BAZYLUK', real: 'j.drobnikowska.bazyluk@gmail.com', hapagId: '90aa9199-851c-42f2-b67b-9c90675a7b24', anezaId: 'e4348595-89e8-458b-a761-d7f9b9b6c700' },
  { name: 'AGNIESZKA PASEK',            real: 'pasek.agnieszka@wp.pl',           hapagId: '4daa1e76-2a94-48cb-9092-3bae762e946e', anezaId: 'a197d2e2-c968-446f-a28e-50e4af6a474d' },
];

const aliasFor = (real) => {
  const [l, d] = real.split('@');
  return `${l}+c${HAPAG_TAG}@${d}`.toLowerCase();
};

for (const p of PAIRS) {
  console.log(`\n=== ${p.name} ===`);
  const hapagAlias = aliasFor(p.real);

  // 1) Hapag: real -> alias (zwolnij realny e-mail)
  const r1 = await db.auth.admin.updateUserById(p.hapagId, { email: hapagAlias, email_confirm: true });
  if (r1.error) { console.log('  BŁĄD Hapag->alias:', r1.error.message); continue; }
  console.log('  Hapag login:', hapagAlias);

  // 2) Aneza: alias -> real
  const r2 = await db.auth.admin.updateUserById(p.anezaId, { email: p.real, email_confirm: true });
  if (r2.error) { console.log('  BŁĄD Aneza->real:', r2.error.message, '(cofam Hapag)');
    await db.auth.admin.updateUserById(p.hapagId, { email: p.real, email_confirm: true });
    continue;
  }
  console.log('  Aneza login:', p.real);

  // 3) contact_email = realny na obu (dla wyświetlania w kartotece)
  await db.from('user_profiles').update({ contact_email: p.real }).in('id', [p.hapagId, p.anezaId]);
}

console.log('\nGotowe. Weryfikacja:');
const ids = PAIRS.flatMap(p => [p.hapagId, p.anezaId]);
for (const id of ids) {
  const { data } = await db.auth.admin.getUserById(id);
  console.log(' ', id, '->', data?.user?.email);
}
