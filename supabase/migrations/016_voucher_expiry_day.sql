-- Migration 016: Add voucher_expiry_day to companies
-- Day of month (1-31) on which employee vouchers expire. Default: 10.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS voucher_expiry_day INTEGER NOT NULL DEFAULT 10
    CONSTRAINT companies_voucher_expiry_day_range CHECK (voucher_expiry_day >= 1 AND voucher_expiry_day <= 31);
