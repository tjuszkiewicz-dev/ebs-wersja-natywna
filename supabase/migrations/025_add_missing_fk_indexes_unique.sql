-- =============================================================================
-- Migracja 025: Brakujące FK, UNIQUE, indeksy
-- =============================================================================
-- K7: FK nie zdefiniowane w 006 i 017
-- K8: brak UNIQUE na financial_documents.document_number
-- M6: brakujące indeksy na kolumnach FK używanych w filtrowaniu/JOIN
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- K7: brakujące foreign keys
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_company_contacts_company'
  ) THEN
    ALTER TABLE company_contacts
      ADD CONSTRAINT fk_company_contacts_company
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_docs_company'
  ) THEN
    ALTER TABLE financial_documents
      ADD CONSTRAINT fk_financial_docs_company
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_docs_order'
  ) THEN
    ALTER TABLE financial_documents
      ADD CONSTRAINT fk_financial_docs_order
      FOREIGN KEY (linked_order_id) REFERENCES voucher_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- K8: UNIQUE na numerze dokumentu (partial — tylko gdy wypełniony)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_docs_number
  ON financial_documents(document_number)
  WHERE document_number IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- M6: brakujące indeksy na kolumnach FK
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_voucher_orders_hr_user
  ON voucher_orders(hr_user_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_redeemed_by
  ON vouchers(redeemed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_buyback_agreements_user
  ON buyback_agreements(user_id);

CREATE INDEX IF NOT EXISTS idx_buyback_agreements_status
  ON buyback_agreements(status);

CREATE INDEX IF NOT EXISTS idx_distribution_batches_order
  ON distribution_batches(order_id);

CREATE INDEX IF NOT EXISTS idx_vtx_service
  ON voucher_transactions(service_id)
  WHERE service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket
  ON ticket_messages(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender
  ON ticket_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_buyback_batches_created_by
  ON buyback_batches(created_by);
