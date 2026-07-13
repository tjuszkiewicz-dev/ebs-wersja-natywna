-- 042: guard idempotencji przypomnienia o wygaśnięciu vouchera (SP4)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS expiry_reminder_at TIMESTAMPTZ;
