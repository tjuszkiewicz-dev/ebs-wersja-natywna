/**
 * E8 — import danych CRM ze Stratton Prime CRM do EBS.
 *
 * Uruchom:
 *   npx tsx --env-file=.env.local scripts/import-stratton-crm.mts            # podgląd (nic nie zapisuje)
 *   npx tsx --env-file=.env.local scripts/import-stratton-crm.mts --wykonaj  # zapis do EBS
 *
 * ŹRÓDŁO: baza Stratton CRM (Supabase `zgqvyjifoqhyfrwtdpct`). Łączymy się WPROST po
 * Postgresie poświadczeniami z `Desktop/Stratton Prime/php-api/.env` (rola `postgres`),
 * bo token MCP tamtego konta jest tylko do odczytu przez API, a PostgREST jest tam
 * zamknięty (audyt RLS, Krok 2). Ścieżkę do pliku można nadpisać `STRATTON_ENV`.
 *
 * CEL: EBS (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` z `.env.local`).
 *
 * KIERUNEK JEST JEDNOSTRONNY. Skrypt niczego nie zapisuje w Stratton CRM — tamten system
 * pozostaje źródłem prawdy do czasu przełączenia. Kolumny `companies.ebs_company_id`
 * i `ebs_synced_at` w Strattonie celowo zostają puste; powiązanie trzymamy u siebie
 * w `leads.external_id` (migracja 060).
 *
 * IDEMPOTENCJA: `ON CONFLICT (external_source, external_id) DO NOTHING`. Ponowne
 * uruchomienie nie zdubluje ani leadów, ani aktywności — dociąga tylko to, czego nie ma.
 *
 * MAPOWANIE (pełne uzasadnienie w CLAUDE.md, sekcja E8):
 *   companies + crm_client_profiles  → leads      (klucz: companies.id; NIP jest unikalny)
 *   client_contacts                  → leads.contacts (jsonb)
 *   crm_client_activities            → crm_activities (CALL/MEETING/NOTE mapują się 1:1)
 *   users                            → NIE migrowane (zakładanie kont to osobna decyzja)
 *   offers                           → NIE migrowane (oferta kwotowa ≠ snapshot kalkulatora)
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const WYKONAJ = process.argv.includes('--wykonaj');
const STRATTON_ENV =
  process.env.STRATTON_ENV ?? 'C:/Users/Użytkownik/Desktop/Stratton Prime/php-api/.env';

/** Opiekunów dopasowujemy po ADRESIE E-MAIL, nie po id: `users.supabase_id` w Strattonie
 *  pochodzi z TAMTEJSZEGO projektu Supabase, więc w EBS te UUID-y nie istnieją.
 *  Mapa poniżej obsługuje wyłącznie przypadki, gdy ta sama osoba ma w obu systemach
 *  INNY adres. Kto nie ma konta w EBS, ten zostaje bez przypisania — lead trafia do puli
 *  nieprzypisanych (widzi ją superadmin/owner), a e-mail pierwotnego opiekuna ląduje
 *  w `notes`, więc informacja nie ginie. Konta zakłada osobny skrypt
 *  `scripts/e8-konta-opiekunow.mts`; po jego uruchomieniu wystarczy powtórzyć import. */
const INNY_ADRES_W_EBS: Record<string, string> = {
  't.juszkiewicz@stratton-prime.pl': 't.juszkiewicz@gmail.com',
};

function wczytajEnv(sciezka: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linia of readFileSync(sciezka, 'utf8').split(/\r?\n/)) {
    const m = linia.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const src = wczytajEnv(STRATTON_ENV);
for (const k of ['DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD']) {
  if (!src[k]) throw new Error(`Brak ${k} w ${STRATTON_ENV}`);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — użyj --env-file=.env.local');
}

const ebs = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stratton = new pg.Client({
  host: src.DB_HOST, port: Number(src.DB_PORT), database: src.DB_DATABASE,
  user: src.DB_USERNAME, password: src.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, statement_timeout: 60000,
});

const ZERO_LUB_NULL = (v: unknown) => v === null || v === undefined || Number(v) === 0;

/** e-mail (jak w Strattonie) → id konta w EBS, rozwiązywane na żywo z auth.users. */
async function zbudujMapeOpiekunow(): Promise<Map<string, string>> {
  const { data, error } = await ebs.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`odczyt kont EBS: ${error.message}`);
  const poEmailu = new Map(
    (data?.users ?? []).map(u => [String(u.email ?? '').toLowerCase(), u.id])
  );
  const mapa = new Map<string, string>();
  for (const [email, id] of poEmailu) mapa.set(email, id);
  for (const [wStrattonie, wEbs] of Object.entries(INNY_ADRES_W_EBS)) {
    const id = poEmailu.get(wEbs);
    if (id) mapa.set(wStrattonie, id);
  }
  return mapa;
}

async function main() {
  await stratton.connect();
  console.log(`źródło: ${src.DB_HOST} · cel: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(WYKONAJ ? 'TRYB: ZAPIS\n' : 'TRYB: PODGLĄD (dodaj --wykonaj, żeby zapisać)\n');

  const opiekunowie = await zbudujMapeOpiekunow();

  // ── 1. Leady ───────────────────────────────────────────────────────────────
  const { rows: firmy } = await stratton.query(`
    SELECT c.id, c.name, c.nip, c.city, c.notes, c.phone, c.email, c.website,
           c.industry, c.accountant_name, c.accountant_email, c.created_at,
           p.contact_name, p.contact_phone, p.contact_email, p.status, p.source,
           p.employees_total, p.service_fee_percent, p.industry AS profil_branza,
           p.contact_position, p.has_external_accounting, p.reservation_end_date,
           lower(u.email) AS opiekun_email,
           COALESCE((SELECT json_agg(json_build_object('name',k.name,'position',k.position,
                       'phone',k.phone,'email',k.email,'is_decision_maker',k.is_decision_maker))
                     FROM client_contacts k WHERE k.client_id=c.id), '[]'::json) AS kontakty
    FROM companies c
    LEFT JOIN crm_client_profiles p ON p.client_id = c.id
    LEFT JOIN users u ON u.id = p.owner_user_id
    ORDER BY c.id`);

  const leady = firmy.map(f => ({
    external_source: 'stratton-crm',
    external_id: String(f.id),
    name: f.name,
    nip: f.nip || null,
    city: f.city || null,
    contact_person: f.contact_name || null,
    phone: f.contact_phone || f.phone || null,
    email: f.contact_email || f.email || null,
    status: f.status || 'NEW',
    source: f.source || 'Stratton CRM',
    notes: [
      f.notes || null,
      `Import ze Stratton CRM (companies.id=${f.id})`,
      f.opiekun_email ? `Opiekun w Stratton CRM: ${f.opiekun_email}` : null,
      // analityka profilu jest w źródle wyzerowana — nie zaśmiecamy nią notatki
      ZERO_LUB_NULL(f.employees_total) ? null : `Pracownicy: ${f.employees_total}`,
      ZERO_LUB_NULL(f.service_fee_percent) ? null : `Prowizja: ${f.service_fee_percent}%`,
      (f.profil_branza || f.industry) ? `Branża: ${f.profil_branza || f.industry}` : null,
      f.contact_position ? `Stanowisko kontaktu: ${f.contact_position}` : null,
      f.has_external_accounting ? 'Księgowość zewnętrzna: tak' : null,
      f.website ? `WWW: ${f.website}` : null,
      f.accountant_email ? `Księgowa: ${f.accountant_name ?? ''} ${f.accountant_email}`.trim() : null,
      f.reservation_end_date ? `Rezerwacja do: ${String(f.reservation_end_date).slice(0, 10)}` : null,
    ].filter(Boolean).join('\n') || null,
    contacts: f.kontakty,
    assigned_to: opiekunowie.get(f.opiekun_email) ?? null,
    created_at: new Date(f.created_at).toISOString(),
  }));

  console.log(`leady do przeniesienia: ${leady.length} (z opiekunem: ${leady.filter(l => l.assigned_to).length})`);

  if (WYKONAJ) {
    const { error } = await ebs.from('leads').upsert(leady, {
      onConflict: 'external_source,external_id',
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`leads: ${error.message}`);
  }

  // mapowanie companies.id → leads.id (potrzebne do aktywności)
  const { data: wEbs, error: bladOdczytu } = await ebs
    .from('leads').select('id, external_id, assigned_to').eq('external_source', 'stratton-crm');
  if (bladOdczytu) throw new Error(`odczyt leadów: ${bladOdczytu.message}`);
  const naLead = new Map((wEbs ?? []).map(l => [String(l.external_id), l.id as string]));

  // ── 1b. Uzupełnienie opiekuna ──────────────────────────────────────────────
  // `ignoreDuplicates` nie rusza istniejących wierszy, więc leady zaimportowane
  // ZANIM powstało konto opiekuna zostałyby na zawsze nieprzypisane. Uzupełniamy je
  // tutaj — ale WYŁĄCZNIE tam, gdzie `assigned_to` jest puste, żeby nie deptać
  // przypisań zmienionych ręcznie w panelu.
  const doUzupelnienia = (wEbs ?? [])
    .filter(l => !l.assigned_to)
    .map(l => ({ lead: l, opiekun: leady.find(n => n.external_id === String(l.external_id))?.assigned_to }))
    .filter((x): x is { lead: typeof wEbs[number]; opiekun: string } => Boolean(x.opiekun));

  if (doUzupelnienia.length) {
    console.log(`leady bez opiekuna, dla których konto już istnieje: ${doUzupelnienia.length}`);
    if (WYKONAJ) {
      for (const { lead, opiekun } of doUzupelnienia) {
        const { error } = await ebs.from('leads').update({ assigned_to: opiekun }).eq('id', lead.id);
        if (error) throw new Error(`uzupełnienie opiekuna (${lead.id}): ${error.message}`);
      }
    }
  }

  // ── 2. Aktywności ──────────────────────────────────────────────────────────
  const { rows: akt } = await stratton.query(`
    SELECT a.id, a.client_id, a.type, a.description, a.occurred_at, a.created_at,
           COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) AS autor,
           lower(u.email) AS autor_email
    FROM crm_client_activities a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id`);

  const TYPY_EBS = new Set(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'SYSTEM']);
  const aktywnosci = akt
    .filter(a => naLead.has(String(a.client_id)))
    .map(a => ({
      external_source: 'stratton-crm',
      external_id: String(a.id),
      lead_id: naLead.get(String(a.client_id))!,
      type: TYPY_EBS.has(a.type) ? a.type : 'NOTE',
      body: a.description ?? '',
      author_id: opiekunowie.get(a.autor_email) ?? null,
      author_name: a.autor ?? null,
      is_system: false,
      created_at: new Date(a.occurred_at ?? a.created_at).toISOString(),
    }));

  const osierocone = akt.length - aktywnosci.length;
  console.log(`aktywności do przeniesienia: ${aktywnosci.length}${osierocone ? ` (pominięte, bo wskazują na nieistniejącego klienta: ${osierocone})` : ''}`);

  if (WYKONAJ && aktywnosci.length) {
    const { error } = await ebs.from('crm_activities').upsert(aktywnosci, {
      onConflict: 'external_source,external_id',
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`crm_activities: ${error.message}`);
  }

  // ── 3. Podsumowanie ────────────────────────────────────────────────────────
  if (WYKONAJ) {
    const { count: ileLeadow } = await ebs.from('leads')
      .select('*', { count: 'exact', head: true }).eq('external_source', 'stratton-crm');
    const { count: ileAkt } = await ebs.from('crm_activities')
      .select('*', { count: 'exact', head: true }).eq('external_source', 'stratton-crm');
    console.log(`\nw EBS po imporcie: leadów ${ileLeadow}, aktywności ${ileAkt}`);
  }

  await stratton.end();
}

main().catch(async e => {
  console.error('BŁĄD:', e instanceof Error ? e.message : e);
  await stratton.end().catch(() => {});
  process.exit(1);
});
