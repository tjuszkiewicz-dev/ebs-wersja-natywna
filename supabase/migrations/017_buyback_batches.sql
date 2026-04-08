-- Migration 017: Buyback batches — paczki przelewów dla zbytych voucherów

CREATE TABLE IF NOT EXISTS buyback_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES user_profiles(id),
  period_label  TEXT,                      -- np. "Kwiecień 2026"
  total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  voucher_count INTEGER NOT NULL DEFAULT 0,
  file_csv      TEXT,                      -- wygenerowany CSV (content)
  status        TEXT NOT NULL DEFAULT 'generated'
                  CONSTRAINT buyback_batches_status CHECK (status IN ('generated', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyback_batch_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES buyback_batches(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES user_profiles(id),
  full_name     TEXT NOT NULL,
  iban          TEXT NOT NULL,
  voucher_count INTEGER NOT NULL,
  amount_pln    NUMERIC(10,2) NOT NULL,
  voucher_ids   UUID[] NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buyback_batches_company ON buyback_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_buyback_batch_items_batch ON buyback_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_buyback_batch_items_employee ON buyback_batch_items(employee_id);

-- RLS
ALTER TABLE buyback_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyback_batch_items ENABLE ROW LEVEL SECURITY;

-- Superadmin full access
CREATE POLICY "superadmin_all_buyback_batches" ON buyback_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "superadmin_all_buyback_items" ON buyback_batch_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Pracodawca (HR) — tylko własna firma
CREATE POLICY "pracodawca_own_buyback_batches" ON buyback_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'pracodawca' AND company_id = buyback_batches.company_id
    )
  );

CREATE POLICY "pracodawca_own_buyback_items" ON buyback_batch_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM buyback_batches bb
      JOIN user_profiles up ON up.company_id = bb.company_id
      WHERE bb.id = buyback_batch_items.batch_id
        AND up.id = auth.uid()
        AND up.role = 'pracodawca'
    )
  );
