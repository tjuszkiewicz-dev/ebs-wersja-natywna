// ─────────────────────────────────────────────────────────────────────────────
// Usuwanie konta użytkownika — CZYSTA LOGIKA DECYZYJNA (bez I/O).
//
// Endpoint `app/api/users/[id]/purge/route.ts` używa tego modułu do ustalenia
// TRYBU operacji i planu kroków. Trzymamy to osobno, bo operacja jest
// nieodwracalna i musi być pokryta testami jednostkowymi.
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

export interface DetachRef extends TableRef {
  /**
   * Odpinaj TYLKO w trybie PURGE. Dotyczy powiązań, które przy anonimizacji
   * mają wartość: konto nadal istnieje, więc wskaźnik nie jest sierotą,
   * a stanowi jedyny trop do dokończenia usuwania danych.
   */
  purgeOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ŚLAD FINANSOWY — zweryfikowany w migracjach ORAZ w żywej bazie (pg_constraint).
//
// Każda pozycja to powiązanie, które BLOKUJE usunięcie wiersza z auth.users
// (FK `ON DELETE RESTRICT` albo brak klauzuli ON DELETE = NO ACTION) ORAZ
// stanowi ślad finansowy podlegający retencji. Niepuste = tryb ANONIMIZACJA.
//
//   001:137  vouchers.current_owner_id            RESTRICT
//   001:154  vouchers.redeemed_by_user_id         SET NULL (nie blokuje — patrz niżej)
//   001:176  voucher_transactions.from_user_id    RESTRICT
//   001:177  voucher_transactions.to_user_id      RESTRICT
//   001:214  commissions.agent_id                 RESTRICT
//   001:245  distribution_batch_items.user_id     RESTRICT
//   001:256  buyback_agreements.user_id           RESTRICT
//   001:291  support_tickets.creator_id           RESTRICT
//   001:303  ticket_messages.sender_id            RESTRICT
//   017:6    buyback_batches.created_by      → user_profiles(id), NO ACTION
//   017:19   buyback_batch_items.employee_id → user_profiles(id), NO ACTION
//
// Trzech ostatnich pozycji NIE BYŁO w projekcie zadania — wykryte przy
// weryfikacji migracji i potwierdzone zapytaniem do żywej bazy. Bez nich PURGE
// wywaliłby się na poziomie bazy (user_profiles kasuje się kaskadowo
// z auth.users, a te FK są NO ACTION = blokują).
//
// `financial_documents` ŚWIADOMIE POMINIĘTE: tabela nie ma żadnej kolumny
// wiążącej użytkownika (006:25 — wiąże firmę i zamówienie).
// ─────────────────────────────────────────────────────────────────────────────
export const FINANCIAL_FOOTPRINT: readonly TableRef[] = [
  { table: 'vouchers',                 column: 'current_owner_id',    label: 'vouchery na koncie' },

  // FK jest SET NULL, więc TO NIE BLOKUJE usunięcia. Liczymy mimo to: realizacja
  // bonu to ślad finansowy i nie chcemy go cicho wyzerować przy PURGE.
  { table: 'vouchers',                 column: 'redeemed_by_user_id', label: 'vouchery zrealizowane przez tę osobę' },

  { table: 'voucher_transactions',     column: 'from_user_id',        label: 'transakcje wychodzące (księga)' },
  { table: 'voucher_transactions',     column: 'to_user_id',          label: 'transakcje przychodzące (księga)' },
  { table: 'commissions',              column: 'agent_id',            label: 'naliczone prowizje' },
  { table: 'distribution_batch_items', column: 'user_id',             label: 'pozycje w paczkach dystrybucji' },
  { table: 'buyback_agreements',       column: 'user_id',             label: 'umowy odkupu' },

  // ŚWIADOMY WYJĄTEK (recenzja, runda 1). Ta kolumna jest — podobnie jak
  // `user_app_entitlements.granted_by`, którą tylko ODPINAMY — nullowalną
  // atrybucją autora, nie danymi rozliczeniowymi osoby. Mimo to wymusza
  // anonimizację, bo dotyczy paczek przelewów: kto wygenerował zlecenie
  // wypłaty, jest częścią ścieżki audytu płatności i nie wolno tego wyczyścić.
  // NIE „uspójniać" tego z granted_by bez świadomej decyzji — to nie jest
  // niedopatrzenie.
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

  // KASOWANE JAWNIE, nie kaskadowo (recenzja I1). W żywej bazie
  // `notifications.user_id` jest typu TEXT i NIE MA ŻADNEGO klucza obcego —
  // wbrew migracji 001, którą nadpisała 025_fix_notifications_schema.
  // Nic tu nie kaskaduje, a treści powiadomień zawierają dane osobowe
  // (np. `app/api/me/worker/bank/route.ts` wstawia imię, nazwisko i maskę IBAN).
  { table: 'notifications',            column: 'user_id',        label: 'powiadomienia (zawierają dane osobowe w treści)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// POWIĄZANIA ODPINANE (`set null`) — dane firmowe zostają, znika tylko autor.
//
// `user_app_entitlements.granted_by` (044:7) to FK do auth.users BEZ klauzuli
// ON DELETE (= NO ACTION) — bez odpięcia PURGE wywaliłby się na poziomie bazy.
// Nie jest to ślad finansowy, więc odpinamy zamiast wymuszać anonimizację.
// ─────────────────────────────────────────────────────────────────────────────
export const DETACH_TABLES: readonly DetachRef[] = [
  { table: 'user_app_entitlements', column: 'granted_by',     label: 'nadane wyjątki dostępu (autor)' },
  { table: 'hr_employees',          column: 'coordinator_id', label: 'pracownicy z tym koordynatorem' },
  { table: 'hr_employees',          column: 'created_by',     label: 'kartoteki założone przez tę osobę' },
  { table: 'hr_contracts',          column: 'created_by',     label: 'kontrakty założone przez tę osobę' },
  { table: 'hr_documents',          column: 'uploaded_by',    label: 'dokumenty wgrane przez tę osobę' },

  // TYLKO PRZY PURGE (recenzja I2). `hr_employees.user_id` nie ma FK, więc po
  // skasowaniu konta zostałby wskaźnikiem-widmem — wtedy odpinamy.
  // Przy ANONIMIZACJI konto nadal istnieje: zostawiamy link, bo kartoteka
  // kadrowa (PESEL, paszport, data i miejsce urodzenia) ZOSTAJE, a to jedyny
  // trop, po którym da się później dokończyć usuwanie danych kadrowych.
  // Zerwanie go zamieniłoby dane paszportowe w sierotę nie do odnalezienia.
  { table: 'hr_employees',          column: 'user_id',        label: 'powiązanie z portalem pracownika', purgeOnly: true },
];

/** Odpięcia właściwe dla trybu. */
export function detachTablesFor(mode: PurgeMode): DetachRef[] {
  return DETACH_TABLES.filter((t) => mode === 'purge' || !t.purgeOnly);
}

// ─────────────────────────────────────────────────────────────────────────────
// DANE OSOBOWE, KTÓRE ZOSTAJĄ MIMO USUNIĘCIA KONTA (recenzja I2).
// Właściciel MUSI to zobaczyć w podsumowaniu GET, zanim potwierdzi — inaczej
// uzna żądanie RODO za wykonane, a komplet danych paszportowych zostanie
// w bazie. Usunięcie konta ≠ usunięcie kartoteki kadrowej.
// ─────────────────────────────────────────────────────────────────────────────
export const RETAINED_PERSONAL_DATA: readonly { table: string; note: string }[] = [
  {
    table: 'hr_employees',
    note: 'Kartoteka pracownicza ZOSTAJE wraz z danymi kadrowymi: PESEL, numer i data '
        + 'ważności paszportu, data i miejsce urodzenia, telefon, e-mail, imiona i nazwiska. '
        + 'Retencja kadrowa — usunięcie konta jej nie obejmuje. Aby zrealizować pełne '
        + 'żądanie RODO, kartotekę trzeba usunąć osobno w module Agencji.',
  },
  {
    table: 'hr_documents',
    note: 'Dokumenty pracownicze i skany ZOSTAJĄ (odpinany jest tylko autor wgrania). '
        + 'Pliki w Storage nie są usuwane.',
  },
];

/**
 * Powiązania pokazywane w podsumowaniu jako „skutki uboczne" — nie decydują
 * o trybie, ale właściciel ma je zobaczyć przed potwierdzeniem.
 */
export const IMPACT_COUNTS: readonly TableRef[] = [
  { table: 'hr_coordinator_contracts', column: 'coordinator_id', label: 'kontrakty zostaną bez opiekuna (koordynatora)' },
  { table: 'hr_employees',             column: 'coordinator_id', label: 'pracownicy zostaną bez koordynatora' },
  { table: 'hr_employees',             column: 'user_id',        label: 'kartoteki pracownicze (dane kadrowe ZOSTAJĄ)' },
  { table: 'notifications',            column: 'user_id',        label: 'powiadomienia do skasowania' },
];

/**
 * Powiązania, które baza odpina albo kasuje SAMA (ON DELETE SET NULL / CASCADE) —
 * wyłącznie przy PURGE. Lista istnieje po to, żeby modal mógł uczciwie pokazać
 * właścicielowi, co jeszcze zniknie razem z kontem.
 *
 * UWAGA: `notifications` NIE JEST tu wymienione — mimo migracji 001 tabela nie ma
 * dziś FK (patrz OWNED_TABLES). Kasujemy ją jawnie.
 */
export const DB_HANDLED: readonly string[] = [
  'voucher_accounts (kaskada)',
  'employee_vouchers (kaskada)',
  'employee_purchases (kaskada)',
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
  const detaches = detachTablesFor(mode).map((t) => `${t.table}.${t.column}`);

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
    // dane zatrudnienia (recenzja M1) — konto jest martwe, nie ma czego raportować
    hire_date:       null,
    contract_type:   null,
    temp_password:   null,
    status:          'anonymized',
    anonymized_at:   now,
    updated_at:      now,
  };
}

/**
 * Czy błąd z `auth.admin.deleteUser` oznacza „konta i tak już nie ma".
 *
 * ZAWĘŻONE (recenzja I3). Wcześniejszy wzorzec `/not found|does not exist/i`
 * łapał też błędy techniczne usługi uwierzytelniania („relation ... does not
 * exist", „column ... does not exist"). Uznanie takiego błędu za brak konta
 * prowadziłoby do skasowania profilu przy ŻYWYM koncie logowania — dokładnie
 * ten stan, przed którym broni kolejność kroków.
 *
 * Tolerujemy wyłącznie jednoznaczny komunikat o braku UŻYTKOWNIKA, a wywołujący
 * i tak musi dodatkowo potwierdzić przez `getUserById`, że konta faktycznie nie ma.
 */
export function isMissingAuthUserError(message: unknown, status?: unknown): boolean {
  if (status === 404) return true;
  if (typeof message !== 'string') return false;
  return /\buser\s+not\s+found\b/i.test(message);
}
