-- =============================================================================
-- Migracja 029: Infrastruktura szyfrowania PESEL (RODO)
-- =============================================================================
-- M5: Komentarz w 001 mówi że PESEL jest zaszyfrowany w warstwie app, ale żaden
-- CHECK/trigger tego nie wymusza. Na prod PESEL jest prawdopodobnie plaintext.
--
-- Ta migracja stawia INFRASTRUKTURĘ — bez łamania warstwy app:
--   1. pgcrypto (już włączone w 001) — pgp_sym_encrypt/decrypt
--   2. kolumna pesel_encrypted BYTEA (dodatkowa, obok pesel TEXT)
--   3. funkcje encrypt_pesel(text, key) / decrypt_pesel(bytea, key)
--   4. funkcja backfill_pesel_encrypted(key) — szyfruje istniejące pesele
--
-- App pozostaje niezmieniony. Następna iteracja (osobny PR):
--   A. dodać EBS_PESEL_KEY do Vercel env
--   B. przełączyć kod na RPC encrypt_pesel/decrypt_pesel
--   C. wywołać backfill_pesel_encrypted() raz
--   D. DROP kolumny pesel TEXT
-- =============================================================================

-- pgcrypto jest włączone w 001 (gen_random_uuid używa tego samego rozszerzenia)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS pesel_encrypted BYTEA;

COMMENT ON COLUMN user_profiles.pesel_encrypted IS
  'PESEL zaszyfrowany AES-256 (pgp_sym_encrypt). Klucz po stronie aplikacji — '
  'nigdy nie zapisywany w bazie. Docelowa kolumna; pesel TEXT do deprekacji.';

-- ─────────────────────────────────────────────────────────────────────────────
-- encrypt_pesel — zwraca BYTEA zaszyfrowany podanym kluczem
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION encrypt_pesel(p_pesel TEXT, p_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_pesel IS NULL OR p_pesel = '' THEN RETURN NULL; END IF;
  IF p_key IS NULL OR length(p_key) < 16 THEN
    RAISE EXCEPTION 'encrypt_pesel: klucz musi mieć min. 16 znaków';
  END IF;
  RETURN pgp_sym_encrypt(p_pesel, p_key);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- decrypt_pesel — odszyfrowuje BYTEA tym samym kluczem; TEXT w razie nieudania
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decrypt_pesel(p_ciphertext BYTEA, p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_ciphertext IS NULL THEN RETURN NULL; END IF;
  IF p_key IS NULL OR length(p_key) < 16 THEN
    RAISE EXCEPTION 'decrypt_pesel: klucz musi mieć min. 16 znaków';
  END IF;
  RETURN pgp_sym_decrypt(p_ciphertext, p_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill — zaszyfruj istniejące PESEL-e (uruchom raz z app-side skryptu)
-- Zwraca liczbę rekordów zaszyfrowanych.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION backfill_pesel_encrypted(p_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_profiles
  SET pesel_encrypted = pgp_sym_encrypt(pesel, p_key)
  WHERE pesel IS NOT NULL
    AND pesel <> ''
    AND pesel_encrypted IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Tylko service_role wykonuje backfill (klucz nigdy nie powinien dotrzeć do klienta)
REVOKE ALL ON FUNCTION backfill_pesel_encrypted(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION backfill_pesel_encrypted(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION backfill_pesel_encrypted(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION backfill_pesel_encrypted(TEXT) TO service_role;

COMMENT ON FUNCTION encrypt_pesel IS
  'Szyfruje PESEL AES-256 z kluczem podanym jako argument. IMMUTABLE — ta sama '
  'para (pesel,key) może dać różne ciphertext (pgp_sym_encrypt używa IV).';

COMMENT ON FUNCTION decrypt_pesel IS
  'Deszyfruje PESEL. Zwraca NULL jeśli klucz nieprawidłowy (nie rzuca wyjątkiem).';

COMMENT ON FUNCTION backfill_pesel_encrypted IS
  'JEDNORAZOWA migracja danych. Zaszyfruj istniejące PESEL-e plaintext. '
  'Odpalić: SELECT backfill_pesel_encrypted(''<EBS_PESEL_KEY z Vercel env>''). '
  'Po uruchomieniu i weryfikacji app-side → DROP COLUMN pesel.';
