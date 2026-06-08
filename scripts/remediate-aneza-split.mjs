// Jednorazowa remediacja: odtworzenie rekordów pracowników Anezy po tym, jak import
// do Hapag-Lloyd nadpisał ich company_id. Istniejące konta ZOSTAJĄ w Hapag (z saldem),
// tworzymy nowe rekordy w Anezie (alias e-mail) i przenosimy do nich wygasłe vouchery
// + pozycje dystrybucji należące do Anezy. Zero ruchu salda (vouchery Anezy są expired).
//
// Idempotentne: jeśli rekord Anezy dla danego PESEL już istnieje, pomija tworzenie.

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── wczytaj .env.local ręcznie (bez dotenv) ───────────────────────────────────
const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PESEL_KEY = env.EBS_PESEL_KEY;
const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ANEZA = '8dbe726e-84fc-4d80-ab3d-89db8387e679';
const HAPAG = '03'; // (nieużywane — informacyjnie)

const PEOPLE = [
  { oldId: '90aa9199-851c-42f2-b67b-9c90675a7b24', pesel: '86102810806', name: 'JOANNA DROBNIKOWSKA-BAZYLUK' },
  { oldId: 'ef6863ac-a1e0-47a2-a8b7-d627f7374bd5', pesel: '80122200047', name: 'KATARZYNA CYGAN' },
  { oldId: '4daa1e76-2a94-48cb-9092-3bae762e946e', pesel: '93011609126', name: 'AGNIESZKA PASEK' },
];

const now = new Date().toISOString();
const tag = ANEZA.replace(/-/g, '').slice(0, 8);
const tmpPass = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!';

function alias(realEmail) {
  const [l, d] = realEmail.split('@');
  return `${l || 'user'}+c${tag}@${d || 'ebs.local'}`.toLowerCase();
}

const log = [];

for (const person of PEOPLE) {
  console.log(`\n=== ${person.name} ===`);

  // 0) idempotencja — czy Aneza już ma rekord z tym PESEL?
  const { data: existing } = await db
    .from('user_profiles')
    .select('id')
    .eq('company_id', ANEZA).eq('role', 'pracownik').eq('pesel', person.pesel);
  if (existing && existing.length) {
    console.log('  POMINIĘTO — rekord Anezy już istnieje:', existing[0].id);
    continue;
  }

  // 1) źródłowy profil + e-mail kontaktowy
  const { data: src, error: srcErr } = await db
    .from('user_profiles').select('*').eq('id', person.oldId).single();
  if (srcErr || !src) { console.log('  BŁĄD: brak profilu źródłowego', srcErr?.message); continue; }

  const { data: oldAuth } = await db.auth.admin.getUserById(person.oldId);
  const realEmail = (src.contact_email || oldAuth?.user?.email || '').toLowerCase();
  const loginEmail = alias(realEmail);
  console.log('  realEmail:', realEmail, '→ aliasLogin:', loginEmail);

  // backfill contact_email na istniejącym koncie Hapag (żeby kartoteka pokazywała realny mail)
  if (!src.contact_email && realEmail) {
    await db.from('user_profiles').update({ contact_email: realEmail }).eq('id', person.oldId);
  }

  // 2) nowe konto auth (alias)
  const pass = tmpPass();
  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email: loginEmail, password: pass, email_confirm: true,
  });
  if (cErr || !created?.user) { console.log('  BŁĄD createUser:', cErr?.message); continue; }
  const newId = created.user.id;
  console.log('  nowe konto:', newId);

  // 3) zaszyfruj PESEL
  let peselEnc = null;
  if (src.pesel && PESEL_KEY) {
    const { data: enc } = await db.rpc('encrypt_pesel', { p_pesel: src.pesel, p_key: PESEL_KEY });
    peselEnc = enc ?? null;
  }

  // 4) profil w Anezie (kopia danych osobowych, status active)
  const { error: pErr } = await db.from('user_profiles').insert({
    id: newId, role: 'pracownik', full_name: src.full_name, company_id: ANEZA,
    contact_email: realEmail || null, pesel: src.pesel, pesel_encrypted: peselEnc,
    phone_number: src.phone_number, department: src.department, position: src.position,
    address_street: src.address_street, address_zip: src.address_zip, address_city: src.address_city,
    iban: src.iban, iban_verified: src.iban_verified, iban_verified_at: src.iban_verified_at,
    contract_type: src.contract_type ?? 'UOP', hire_date: src.hire_date,
    status: 'active', terms_accepted: true, terms_accepted_at: now, temp_password: pass,
  });
  if (pErr) { console.log('  BŁĄD insert profilu:', pErr.message); await db.auth.admin.deleteUser(newId); continue; }

  // 5) konto voucherowe (saldo 0 — vouchery Anezy są wygasłe)
  await db.from('voucher_accounts').upsert({ user_id: newId, balance: 0 }, { onConflict: 'user_id' });

  // 6) przenieś vouchery Anezy ze starego konta na nowe
  const { data: movedV, error: vErr } = await db.from('vouchers')
    .update({ current_owner_id: newId })
    .eq('current_owner_id', person.oldId).eq('company_id', ANEZA).select('id');
  if (vErr) console.log('  BŁĄD przenoszenia voucherów:', vErr.message);
  console.log('  przeniesione vouchery Anezy:', movedV?.length ?? 0);

  // 7) przenieś pozycje dystrybucji Anezy
  const { data: anezaBatches } = await db.from('distribution_batches').select('id').eq('company_id', ANEZA);
  const batchIds = (anezaBatches ?? []).map(b => b.id);
  let movedD = 0;
  if (batchIds.length) {
    const { data: md, error: dErr } = await db.from('distribution_batch_items')
      .update({ user_id: newId })
      .eq('user_id', person.oldId).in('batch_id', batchIds).select('id');
    if (dErr) console.log('  BŁĄD przenoszenia dystrybucji:', dErr.message);
    movedD = md?.length ?? 0;
  }
  console.log('  przeniesione pozycje dystrybucji Anezy:', movedD);

  log.push({ name: person.name, newId, loginEmail, tempPassword: pass, vouchersMoved: movedV?.length ?? 0, distMoved: movedD });
}

console.log('\n===== PODSUMOWANIE (dane logowania nowych rekordów Anezy) =====');
console.table(log.map(l => ({ name: l.name, login: l.loginEmail, haslo: l.tempPassword, vouchery: l.vouchersMoved, dystryb: l.distMoved })));
