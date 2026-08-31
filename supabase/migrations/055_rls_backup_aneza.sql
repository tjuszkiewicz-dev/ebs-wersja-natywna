-- =============================================================================
-- EBS — Migracja 055: RLS na tabelach kopii zapasowych _backup_aneza_*
-- =============================================================================
-- Kontekst: 31.08.2026, przy okazji audytu RLS po migracji 054 (fala E7a — CRM),
--   database-linter zgłosił trzy błędy poziomu ERROR `rls_disabled_in_public`.
--   To NIE jest regresja migracji 054 — tabele powstały wcześniej, jako kopie
--   bezpieczeństwa przed czyszczeniem danych Anezy (3 zamówienia, 2 dokumenty,
--   6 poprawionych dat potwierdzeń).
--
-- Dlaczego to było groźne (zweryfikowane, nie teoretyczne):
--   Tabele leżą w schemacie `public`, więc PostgREST wystawia je pod
--   /rest/v1/<nazwa>. Przy WYŁĄCZONYM RLS rola `anon` czyta je BEZ LOGOWANIA.
--   Sprawdzone żywym zapytaniem kluczem anon (ten sam klucz jest w bundlu
--   przeglądarki, więc ma go każdy użytkownik strony):
--     _backup_aneza_orders_del    -> HTTP 206, Content-Range */3
--     _backup_aneza_docs_del      -> HTTP 206, Content-Range */2
--     _backup_aneza_potwierdzenia -> HTTP 206, Content-Range */6
--   Dla porównania żywe `voucher_orders` odbijało błędem (jest chronione).
--
--   `_backup_aneza_orders_del.distribution_plan` (jsonb) zawiera klucze
--   `pesel`, `employeeName`, `email` — to dane osobowe pracowników (RODO).
--
-- Co robi ta migracja: włącza RLS bez polityk = deny-all dla anon/authenticated,
--   zgodnie z konwencją repo (aplikacja chodzi na service_role, który omija RLS).
--   Operacja jest NIENISZCZĄCA — kopie zostają nietknięte i dalej pozwalają
--   cofnąć czyszczenie danych Anezy, gdyby okazało się błędne.
--
-- Decyzja o USUNIĘCIU tych tabel jest osobna i należy do właściciela
-- (patrz session-logs/2026-08-31-auth-reset-hasla-owner.md — pozycja „czeka na usera").
-- Do czasu tej decyzji kopie są bezpieczne, bo niedostępne z zewnątrz.
-- =============================================================================

ALTER TABLE public."_backup_aneza_orders_del"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_aneza_docs_del"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_aneza_potwierdzenia" ENABLE ROW LEVEL SECURITY;
