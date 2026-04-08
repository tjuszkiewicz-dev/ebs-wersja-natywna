-- Migration 018: add voucher_expiry_hour and voucher_expiry_minute to companies
-- Allows admins to set the exact time (hour:minute) at which vouchers expire on the configured day.
-- Defaults: hour = 0 (midnight), minute = 5 (00:05)

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS voucher_expiry_hour   INTEGER NOT NULL DEFAULT 0  CHECK (voucher_expiry_hour   >= 0 AND voucher_expiry_hour   <= 23),
  ADD COLUMN IF NOT EXISTS voucher_expiry_minute  INTEGER NOT NULL DEFAULT 5  CHECK (voucher_expiry_minute  >= 0 AND voucher_expiry_minute  <= 59);

COMMENT ON COLUMN companies.voucher_expiry_hour   IS 'Godzina wygaśnięcia voucherów (0–23)';
COMMENT ON COLUMN companies.voucher_expiry_minute IS 'Minuta wygaśnięcia voucherów (0–59)';
