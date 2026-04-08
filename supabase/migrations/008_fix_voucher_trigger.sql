-- =============================================================================
-- EBS — Migracja 008: Naprawa triggera tworzenia konta voucherowego
-- =============================================================================
-- Problem: fn_auto_create_voucher_account nie miał obsługi wyjątków.
-- Gdy RLS blokował INSERT do voucher_accounts, Supabase Auth zwracał
-- "Database error creating new user" przy tworzeniu konta przez admin API.
-- =============================================================================

-- 1. Napraw trigger — dodaj EXCEPTION handling żeby nie blokował tworzenia użytkowników
CREATE OR REPLACE FUNCTION fn_auto_create_voucher_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.voucher_accounts (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nie blokuj tworzenia konta auth jeśli insert voucher_account zawiedzie
  RETURN NEW;
END;
$$;

-- 2. Dodaj politykę INSERT do voucher_accounts dla triggerów i service_role
-- (poprzednio była tylko polityka SELECT — INSERT blokowany przez RLS)
DROP POLICY IF EXISTS "Tworzenie konta voucherowego — system" ON voucher_accounts;
CREATE POLICY "Tworzenie konta voucherowego — system"
  ON voucher_accounts FOR INSERT
  WITH CHECK (true);
