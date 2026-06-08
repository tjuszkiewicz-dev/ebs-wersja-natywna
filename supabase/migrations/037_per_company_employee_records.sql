-- 037: Rozdzielenie kartoteki pracowników per pracodawca
--
-- Problem: user_profiles.company_id jest jednowartościowe, a import/dodawanie
-- pracownika dopasowywało istniejące osoby GLOBALNIE po e-mailu i robiło upsert,
-- który nadpisywał company_id. Skutek: import pracowników firmy A do firmy B
-- "przenosił" ich z A do B (wspólny koszyk pracowników).
--
-- Model docelowy: każdy (osoba, firma) = osobny rekord = osobne konto auth =
-- osobne saldo voucherów. Deduplikacja w obrębie JEDNEJ firmy po PESEL.
-- Ta sama osoba może istnieć równolegle w wielu firmach (osobne rekordy).
--
-- Ponieważ e-mail logowania (auth.users.email) musi być globalnie unikalny,
-- kolejny rekord tej samej osoby loguje się aliasem, a prawdziwy e-mail
-- kontaktowy trzymamy w user_profiles.contact_email.

-- 1) E-mail kontaktowy (prawdziwy adres osoby; login auth może być aliasem)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS contact_email text;

COMMENT ON COLUMN public.user_profiles.contact_email IS
  'Prawdziwy e-mail kontaktowy pracownika. Login auth (auth.users.email) bywa aliasem, gdy ta sama osoba jest pracownikiem w kilku firmach.';

-- 2) Twardy gwarant rozdzielności: w obrębie jednej firmy nie może być dwóch
--    pracowników o tym samym PESEL. Między firmami duplikaty są dozwolone
--    (ta sama osoba w kilku firmach = osobne rekordy).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_company_pesel
  ON public.user_profiles (company_id, pesel)
  WHERE role = 'pracownik' AND pesel IS NOT NULL AND pesel <> '';

-- 3) Pomocniczy indeks do szybkiego dopasowania po e-mailu kontaktowym w firmie
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_contact_email
  ON public.user_profiles (company_id, contact_email)
  WHERE role = 'pracownik';
