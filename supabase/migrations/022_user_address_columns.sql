-- Dodaj kolumny adresowe do user_profiles (dane adresowe pracowników)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_city   TEXT,
  ADD COLUMN IF NOT EXISTS address_zip    TEXT;

COMMENT ON COLUMN user_profiles.address_street IS 'Ulica i numer mieszkania';
COMMENT ON COLUMN user_profiles.address_city   IS 'Miasto';
COMMENT ON COLUMN user_profiles.address_zip    IS 'Kod pocztowy (np. 00-000)';
