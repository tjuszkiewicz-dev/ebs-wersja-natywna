-- 043: guard idempotencji paczki przelewów odkupu (SP5, fix review C1/I1)
-- Rozdziela "PDF wygenerowany" (pdf_url) od "ujęte w paczce przelewów" (transfer_batched_at),
-- żeby awaria PDF-serwera ani timeout crona nie powielały ani nie gubiły przelewów.
ALTER TABLE buyback_agreements ADD COLUMN IF NOT EXISTS transfer_batched_at TIMESTAMPTZ;
