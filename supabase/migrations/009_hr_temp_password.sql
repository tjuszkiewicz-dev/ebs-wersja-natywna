-- =============================================================================
-- EBS — Migracja 009: Kolumna hr_temp_password w company_contacts
-- =============================================================================
-- Cel: Persystencja hasła tymczasowego konta HR w rekordzie kontaktu,
--      tak żeby panel admina mógł je wyświetlić po odświeżeniu strony.
--
-- UWAGA BEZPIECZEŃSTWO: Kolumna jest widoczna tylko przez service_role
--   (RLS na company_contacts dopuszcza tylko superadminów przez politykę ALL).
--   Hasło tymczasowe powinno być zmienione przez operatora HR przy pierwszym
--   logowaniu. Należy je wyczyścić po potwierdzeniu zmiany.
-- =============================================================================

ALTER TABLE company_contacts
  ADD COLUMN IF NOT EXISTS hr_temp_password TEXT;

COMMENT ON COLUMN company_contacts.hr_temp_password IS
  'Hasło tymczasowe konta HR — ustawiane przez superadmina, widoczne tylko w panelu admina. Powinno zostać wyczyszczone po pierwszym logowaniu operatora.';
