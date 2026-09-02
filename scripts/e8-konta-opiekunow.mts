/**
 * E8 — konta EBS dla opiekunów przeniesionych ze Stratton CRM.
 *
 * Uruchom:
 *   npx tsx --env-file=.env.local scripts/e8-konta-opiekunow.mts            # podgląd
 *   npx tsx --env-file=.env.local scripts/e8-konta-opiekunow.mts --wykonaj  # zakłada konta
 *
 * Konta powstają z hasłem tymczasowym w `user_profiles.temp_password` (konwencja EBS).
 * Supabase NIE wysyła przy tym żadnego maila — poświadczenia rozdaje właściciel.
 * Skrypt jest idempotentny: istniejącego konta nie rusza (nie nadpisuje roli ani hasła).
 *
 * KOGO NIE ZAKŁADAMY I DLACZEGO (obie sprawy wymagają decyzji właściciela):
 *  · `m.hagno@stratton-prime.pl` — MA JUŻ konto w EBS w roli `pracodawca` (klient benefitowy
 *    Stratton Prime). W Stratton CRM jest DIRECTOR-em sprzedaży. Zmiana roli odcięłaby mu
 *    dostęp pracodawcy, a doklejenie uprawnień CRM do roli `pracodawca` i tak nie pokaże mu
 *    menu CRM (rola ma w `Sidebar` menu statyczne, bez sekcji CRM). To wybór: druga rola,
 *    drugie konto, albo zostawić jak jest.
 *  · `biuro@stratton-prime.pl` — wspólna skrzynka biura z rolą ADMIN w Strattonie.
 *    Nie prowadzi żadnego klienta (0 profili, 1 aktywność). Nadanie skrzynce współdzielonej
 *    uprawnień administratora w EBS to decyzja bezpieczeństwa, nie szczegół migracji.
 */
import { createClient } from '@supabase/supabase-js';

const WYKONAJ = process.argv.includes('--wykonaj');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Brak zmiennych Supabase — użyj --env-file=.env.local');
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Konto właściciela w EBS — przełożony dla struktury pod TEA003/TJ001. */
const WLASCICIEL = 'afea23e4-62bc-4449-923c-c9aa5fdca7ab';

/** Rola w Stratton CRM → rola EBS. Hierarchia z `users.hierarchical_id`. */
const OSOBY = [
  { email: 't.gorski@stratton-prime.pl',       full_name: 'Tomasz Górski',        role: 'dyrektor',  manager_id: null,        zrodlo: 'DIRECTOR, TEA002/TG001 — własne poddrzewo' },
  { email: 'm.szarolkiewicz@stratton-prime.pl', full_name: 'Marzanna Szarolkiewicz', role: 'partner', manager_id: null,        zrodlo: 'Sales, TEA001/JA001/UD001/MS001 — przełożonych z tej gałęzi nie ma w EBS' },
  { email: 'p.marszalek@stratton-prime.pl',    full_name: 'Paweł Marszałek',      role: 'leadowiec', manager_id: WLASCICIEL,  zrodlo: 'Leadowiec, TEA003/TJ001/PM001 — pod właścicielem' },
];

function hasloTymczasowe(): string {
  return (
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    Math.random().toString(36).slice(2, 6) +
    Math.floor(10 + Math.random() * 90) +
    '!'
  );
}

async function main() {
  console.log(WYKONAJ ? 'TRYB: ZAPIS\n' : 'TRYB: PODGLĄD (dodaj --wykonaj)\n');

  const { data: lista, error: bladListy } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (bladListy) throw new Error(bladListy.message);
  const poEmailu = new Map(
    (lista?.users ?? []).map(u => [String(u.email ?? '').toLowerCase(), u.id])
  );

  const utworzone: { email: string; role: string; haslo: string }[] = [];

  for (const o of OSOBY) {
    const istnieje = poEmailu.get(o.email);
    if (istnieje) {
      console.log(`· ${o.email} — konto już istnieje (${istnieje}), pomijam`);
      continue;
    }
    console.log(`+ ${o.email} → rola ${o.role}   [${o.zrodlo}]`);
    if (!WYKONAJ) continue;

    const haslo = hasloTymczasowe();
    const { data: nowy, error: bladAuth } = await sb.auth.admin.createUser({
      email: o.email,
      password: haslo,
      email_confirm: true,
    });
    if (bladAuth || !nowy?.user) throw new Error(`${o.email}: ${bladAuth?.message ?? 'brak użytkownika'}`);

    const { error: bladProfilu } = await sb.from('user_profiles').upsert(
      {
        id: nowy.user.id,
        full_name: o.full_name,
        role: o.role,
        manager_id: o.manager_id,
        temp_password: haslo,
      },
      { onConflict: 'id' }
    );
    if (bladProfilu) throw new Error(`${o.email} (profil): ${bladProfilu.message}`);

    utworzone.push({ email: o.email, role: o.role, haslo });
  }

  if (utworzone.length) {
    console.log('\n─── HASŁA TYMCZASOWE (do przekazania osobiście, zmiana przy 1. logowaniu) ───');
    for (const u of utworzone) console.log(`${u.email.padEnd(36)} ${u.role.padEnd(11)} ${u.haslo}`);
  }
  console.log(`\nzałożonych kont: ${utworzone.length}`);
}

main().catch(e => {
  console.error('BŁĄD:', e instanceof Error ? e.message : e);
  process.exit(1);
});
