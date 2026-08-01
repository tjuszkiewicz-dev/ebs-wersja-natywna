// ─────────────────────────────────────────────────────────────────────────────
// Usuwanie konta użytkownika — CZYSTA LOGIKA DECYZYJNA (bez I/O).
//
// Endpoint `app/api/users/[id]/purge/route.ts` używa tego modułu do ustalenia
// TRYBU operacji i planu kroków. Trzymamy to osobno, bo operacja jest
// nieodwracalna i musi być pokryta testami jednostkowymi — samego route'a nie
// da się przetestować bez mockowania całego Supabase.
//
// DLACZEGO DWA TRYBY (a nie „skasuj i tyle", jak w BBS):
// Migracja 001 EBS wiąże konto logowania (auth.users) z księgą voucherową
// przez FK z `ON DELETE RESTRICT`, a `voucher_transactions` ma dodatkowo
// trigger `enforce_ledger_immutability` blokujący UPDATE/DELETE. To obszar
// regulowany (bony MPV, dyrektywa UE 2016/1065, retencja księgowa).
// Kasowanie konta z historią finansową jest w tej bazie FIZYCZNIE NIEMOŻLIWE —
// baza odrzuci DELETE. Dlatego:
//   • ślad finansowy PUSTY   → PURGE       (realne usunięcie konta i profilu)
//   • ślad finansowy NIEPUSTY → ANONIMIZACJA (rekord zostaje, PII wymazane,
//                                             logowanie zablokowane, księga nietknięta)
// ─────────────────────────────────────────────────────────────────────────────

export type PurgeMode = 'purge' | 'anonymize';

export interface TableRef {
  /** nazwa tabeli w bazie */
  table: string;
  /** kolumna wskazująca na użytkownika */
  column: string;
  /** opis dla właściciela w modalu potwierdzenia */
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ŚLAD FINANSOWY — zweryfikowany w migracjach, nie „na oko".
//
// Każda pozycja to powiązanie, które BLOKUJE usunięcie wiersza z auth.users
// (FK `ON DELETE RESTRICT` albo brak klauzuli ON DELETE = NO ACTION) ORAZ
// stanowi ślad finansowy podlegający retencji. Niepuste = tryb ANONIMIZACJA.
//
// Źródła (zweryfikowane w plikach migracji):
//   001_initial_schema.sql:137  vouchers.current_owner_id            RESTRICT
//   001_initial_schema.sql:154  vouchers.redeemed_by_user_id         SET NULL (nie blokuje,
//                               ale to realizacja bonu = ślad finansowy → liczymy)
//   001_initial_schema.sql:176  voucher_transactions.from_user_id    RESTRICT
//   001_initial_schema.sql:177  voucher_transactions.to_user_id      RESTRICT
//   001_initial_schema.sql:214  commissions.agent_id                 RESTRICT
//   001_initial_schema.sql:245  distribution_batch_items.user_id     RESTRICT
//   001_initial_schema.sql:256  buyback_agreements.user_id           RESTRICT
//   001_initial_schema.sql:291  support_tickets.creator_id           RESTRICT
//   001_initial_schema.sql:303  ticket_messages.sender_id            RESTRICT
//   017_buyback_batches.sql:6   buyback_batches.created_by      → user_profiles(id), NO ACTION
//   017_buyback_batches.sql:19  buyback_batch_items.employee_id → user_profiles(id), NO ACTION
//
// Dwie ostatnie pozycji NIE MA w briefie zadania — wykryte przy weryfikacji
// migracji. Bez nich PURGE wywaliłby się na poziomie bazy dla każdego konta,
// które kiedykolwiek trafiło do paczki przelewów odkupowych (user_profiles
// kasuje się kaskadowo z auth.users, a te FK są NO ACTION = blokują).
//
// `financial_documents` ŚWIADOMIE POMINIĘTE: tabela nie ma żadnej kolumny
// wiążącej użytkownika (006_admin_panel_tables.sql:25 — wiąże firmę i
// zamówienie), więc nie da się jej odpytać po użytkowniku.
// ─────────────────────────────────────────────────────────────────────────────
export const FINANCIAL_FOOTPRINT: readonly TableRef[] = [
  { table: 'vouchers',                 column: 'current_owner_id',    label: 'vouchery na koncie' },
  { table: 'vouchers',                 column: 'redeemed_by_user_id', label: 'vouchery zrealizowane przez tę osobę' },
  { table: 'voucher_transactions',     column: 'from_user_id',        label: 'transakcje wychodzące (księga)' },
  { table: 'voucher_transactions',     column: 'to_user_id',          label: 'transakcje przychodzące (księga)' },
  { table: 'commissions',              column: 'agent_id',            label: 'naliczone prowizje' },
  { table: 'distribution_batch_items', column: 'user_id',             label: 'pozycje w paczkach dystrybucji' },
  { table: 'buyback_agreements',       column: 'user_id',             label: 'umowy odkupu' },
  { table: 'buyback_batches',          column: 'created_by',          label: 'paczki przelewów utworzone przez tę osobę' },
  { table: 'buyback_batch_items',      column: 'employee_id',         label: 'pozycje w paczkach przelewów' },
  { table: 'support_tickets',          column: 'creator_id',          label: 'zgłoszenia do BOK' },
  { table: 'ticket_messages',          column: 'sender_id',           label: 'wiadomości w zgłoszeniach' },
];

// ─────────────────────────────────────────────────────────────────────────────
// RZECZY PRYWATNE KONTA — kasowane w OBU trybach.
// Nie mają wartości księgowej, a zostawienie ich przy koncie martwym
// (zanonimizowanym) oznaczałoby żywe uprawnienia bez właściciela.
//
// TODO E6: BBS kasuje tu dodatkowo `mail_account_users`, `chat_push_subscriptions`,
//          `chat_participants`, `chat_reactions` — tych tabel w EBS jeszcze NIE MA
//          (komunikator i poczta przyjdą z falą E6). Przy E6 dopisać je do tej listy.
// ─────────────────────────────────────────────────────────────────────────────
export const OWNED_TABLES: readonly TableRef[] = [
  { table: 'user_permissions',         column: 'user_id',        label: 'wyjątki uprawnień' },
  { table: 'user_app_entitlements',    column: 'user_id',        label: 'wyjątki dostępu do aplikacji' },
  { table: 'acc_company_members',      column: 'user_id',        label: 'członkostwo w firmach księgowych' },
  { table: 'hr_coordinator_contracts', column: 'coordinator_id', label: 'przypisane kontrakty (koordynator)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// POWIĄZANIA ODPINANE (`set null`) — dane firmowe zostają, znika tylko autor.
// Kartoteki pracowników i dokumenty HR to historia firmy, nie własność konta.
//
// `user_app_entitlements.granted_by` (044_shell_entitlements.sql:7) to FK do
// auth.users BEZ klauzuli ON DELETE (= NO ACTION) — bez odpięcia PURGE
// wywaliłby się na poziomie bazy. Nie jest to jednak ślad finansowy, więc
// odpinamy, zamiast wymuszać anonimizację.
// ─────────────────────────────────────────────────────────────────────────────
export const DETACH_TABLES: readonly TableRef[] = [
  { table: 'user_app_entitlements', column: 'granted_by',     label: 'nadane wyjątki dostępu (autor)' },
  { table: 'hr_employees',          column: 'coordinator_id', label: 'pracownicy z tym koordynatorem' },
  { table: 'hr_employees',          column: 'created_by',     label: 'kartoteki założone przez tę osobę' },
  { table: 'hr_employees',          column: 'user_id',        label: 'powiązanie z portalem pracownika' },
  { table: 'hr_contracts',          column: 'created_by',     label: 'kontrakty założone przez tę osobę' },
  { table: 'hr_documents',          column: 'uploaded_by',    label: 'dokumenty wgrane przez tę osobę' },
];

/**
 * Powiązania, które baza odpina albo kasuje SAMA (ON DELETE SET NULL / CASCADE).
 * Nie robimy z nimi nic — lista istnieje po to, żeby modal mógł uczciwie
 * pokazać właścicielowi, co jeszcze zniknie razem z kontem.
 */
export const DB_HANDLED: readonly string[] = [
  'voucher_accounts (kaskada)',
  'employee_vouchers (kaskada)',
  'employee_purchases (kaskada)',
  'notifications (kaskada)',
  'iban_change_requests (kaskada)',
  'companies.advisor_id / manager_id / director_id (odpięcie)',
  'voucher_orders.hr_user_id (odpięcie)',
  'distribution_batches.hr_user_id (odpięcie)',
  'import_history.hr_user_id (odpięcie)',
  'audit_log.changed_by (odpięcie)',
];

/** Suma wszystkich liczników śladu finansowego. */
export function footprintTotal(footprint: Record<string, number>): number {
  return Object.values(footprint).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
}

/**
 * Serce decyzji: pusty ślad finansowy → wolno skasować konto na amen.
 * Cokolwiek niepustego → konto MUSI zostać jako rekord (księga go trzyma),
 * więc jedyne, co możemy zrobić, to wymazać dane osobowe i odciąć logowanie.
 */
export function decideMode(footprint: Record<string, number>): PurgeMode {
  return footprintTotal(footprint) === 0 ? 'purge' : 'anonymize';
}

/** Pozycje śladu z licznikiem > 0 — to, co modal pokazuje jako „dlaczego anonimizacja". */
export function nonEmptyFootprint(
  footprint: Record<string, number>
): { key: string; count: number }[] {
  return Object.entries(footprint)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count }));
}

/**
 * Fraza, którą właściciel musi przepisać, żeby potwierdzić operację.
 * Gdy konto nie ma nazwy (full_name NULL/puste), frazą jest jego identyfikator —
 * inaczej puste `confirm` przechodziłoby walidację i bramka byłaby pozorna.
 */
export function expectedConfirmation(profile: { id: string; full_name?: string | null }): string {
  const name = (profile.full_name ?? '').trim();
  return name.length > 0 ? name : profile.id;
}

/** Porównanie potwierdzenia po przycięciu białych znaków (dokładne, bez ignorowania wielkości liter). */
export function confirmationMatches(
  input: unknown,
  profile: { id: string; full_name?: string | null }
): boolean {
  if (typeof input !== 'string') return false;
  return input.trim() === expectedConfirmation(profile);
}

export interface OperationPlan {
  mode: PurgeMode;
  /** tabele, z których wiersze użytkownika znikną */
  deletes: string[];
  /** powiązania odpinane na NULL */
  detaches: string[];
  /** co zostaje nietknięte */
  keeps: string[];
}

/**
 * Plan operacji do pokazania w modalu i do wpisu audytowego.
 * Kolejność w `deletes`/`detaches` jest tą samą, w której endpoint wykonuje kroki:
 * od najmniej do najbardziej niszczącej (kod nie jest transakcyjny — Supabase REST —
 * więc przerwanie w połowie musi zostawiać stan możliwie nieszkodliwy).
 */
export function buildPlan(mode: PurgeMode): OperationPlan {
  const deletes = OWNED_TABLES.map((t) => `${t.table}.${t.column}`);
  const detaches = DETACH_TABLES.map((t) => `${t.table}.${t.column}`);

  if (mode === 'purge') {
    return {
      mode,
      deletes: [...deletes, 'auth.users (konto logowania)', 'user_profiles (profil)'],
      detaches,
      keeps: [],
    };
  }

  return {
    mode,
    deletes,
    detaches,
    // W anonimizacji księga i dokumenty finansowe są nietykalne — to nie jest
    // uprzejmość wobec danych, tylko wymóg retencji i trigger w bazie.
    keeps: FINANCIAL_FOOTPRINT.map((t) => `${t.table}.${t.column}`),
  };
}

/** Zastępczy adres logowania dla konta zanonimizowanego (domena `.invalid` z RFC 2606). */
export function anonymizedEmail(id: string): string {
  return `usuniete+${id}@invalid.local`;
}

/**
 * Nadpisanie danych osobowych w `user_profiles`.
 * Pola wyliczone z faktycznego schematu (001 + 004 + 012 + 024 + 031 + 037) —
 * EBS nie ma kolumn `address` ani `date_of_birth`; ma `address_street/city/zip`
 * i `phone_number`, a PESEL w dwóch wariantach (`pesel` TEXT i `pesel_encrypted`).
 */
export function anonymizedProfilePatch(now: string): Record<string, unknown> {
  return {
    full_name:       'Konto usunięte',
    company_name:    null,
    contact_email:   null,
    pesel:           null,
    pesel_encrypted: null,
    phone_number:    null,
    iban:            null,
    iban_verified:   false,
    iban_verified_at: null,
    address_street:  null,
    address_city:    null,
    address_zip:     null,
    department:      null,
    position:        null,
    temp_password:   null,
    status:          'anonymized',
    anonymized_at:   now,
    updated_at:      now,
  };
}

/**
 * Czy błąd z `auth.admin.deleteUser` oznacza „konta i tak już nie ma".
 * Taki błąd tolerujemy — krok ma być idempotentny (kod nie jest transakcyjny,
 * więc ponowienie operacji po awarii musi dojść do końca).
 */
export function isMissingAuthUserError(message: unknown): boolean {
  return typeof message === 'string' && /not\s*found|does not exist/i.test(message);
}
