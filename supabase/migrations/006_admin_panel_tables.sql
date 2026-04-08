-- ============================================================
-- Migration 006: Admin Panel — company_contacts + financial_documents
-- ============================================================

-- TABLE: company_contacts
-- Persons of contact for each company (decision makers, HR operators, etc.)
CREATE TABLE IF NOT EXISTS company_contacts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    phone             TEXT,
    email             TEXT,
    is_decision_maker BOOLEAN NOT NULL DEFAULT FALSE,
    is_hr_operator    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_contacts_company ON company_contacts(company_id);

-- TABLE: financial_documents
-- Accounting documents (nota buchalteryjna + faktura VAT) tied to voucher orders.
-- Supports future webhook-based payment confirmation via external_payment_ref.
CREATE TABLE IF NOT EXISTS financial_documents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID NOT NULL,
    linked_order_id       UUID,   -- FK to voucher_orders(id) if synthesized from order
    type                  TEXT NOT NULL CHECK (type IN ('nota', 'faktura_vat')),
    document_number       TEXT,
    amount_net            NUMERIC(12, 2) NOT NULL DEFAULT 0,
    vat_amount            NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_gross          NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_confirmed_at  TIMESTAMPTZ,
    external_payment_ref  TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_docs_company   ON financial_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_docs_order     ON financial_documents(linked_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_docs_order_type
    ON financial_documents(linked_order_id, type)
    WHERE linked_order_id IS NOT NULL;
