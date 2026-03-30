// ── Business constants — single source of truth ───────────────────────────
// All magic numbers / strings that appear in business logic live here.

export const COMMISSION_RATES = {
  ADVISOR_FIRST_INVOICE: 0.45,  // 45% – jednorazowa za pozyskanie kontraktu
  ADVISOR_RECURRING:     0.05,  // 5%  – miesięczna za utrzymanie firmy
  MANAGER_RECURRING:     0.02,
  DIRECTOR_RECURRING:    0.01,
  RENEWAL_TIER_1:        0.02,
  RENEWAL_TIER_2:        0.04,
} as const;

export const SESSION_CONFIG = {
  IDLE_LIMIT_MS:        15 * 60 * 1000,  // 15 minut
  WARNING_THRESHOLD_MS:  1 * 60 * 1000,  // ostrzeżenie 60 s przed końcem
} as const;

export const FINANCIAL_DEFAULTS = {
  SUCCESS_FEE_RATE: 0.20,
  VAT_RATE:         0.23,
} as const;

// Used only in demo/dev — never send to a real auth endpoint
export const TWO_FA_DEMO_CODE = '123456';
