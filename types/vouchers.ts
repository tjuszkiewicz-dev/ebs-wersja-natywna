// ── Typy domenowe warstwy voucherowej ────────────────────────────────────────
// Używaj tych typów w komponentach i lib/vouchers.ts
// Nigdzie w tym pliku nie używaj słowa "token"

import type {
  Database,
  VoucherStatus,
  OrderStatus,
  CommissionType,
  TransactionType,
  DbRole,
} from './database';

// Skróty dla wygody
export type VoucherAccount     = Database['public']['Tables']['voucher_accounts']['Row'];
export type VoucherTransaction = Database['public']['Tables']['voucher_transactions']['Row'];
export type VoucherOrder       = Database['public']['Tables']['voucher_orders']['Row'];
export type Voucher            = Database['public']['Tables']['vouchers']['Row'];
export type Commission         = Database['public']['Tables']['commissions']['Row'];
export type BuybackAgreement   = Database['public']['Tables']['buyback_agreements']['Row'];
export type UserProfile        = Database['public']['Tables']['user_profiles']['Row'];
export type Company            = Database['public']['Tables']['companies']['Row'];
export type Notification       = Database['public']['Tables']['notifications']['Row'];
export type ServiceItem        = Database['public']['Tables']['services']['Row'];

// Re-eksport typów wyliczeń
export type { VoucherStatus, OrderStatus, CommissionType, TransactionType, DbRole };

// ---------------------------------------------------------------------------
// Typy rozszerzone / widoki (złączenia tabel)
// ---------------------------------------------------------------------------

/** Saldo voucherowe użytkownika z danymi profilu */
export interface VoucherBalanceView {
  userId:    string;
  balance:   number;
  fullName:  string | null;
  role:      DbRole;
}

/** Historia transakcji z nazwami użytkowników */
export interface TransactionHistoryItem extends VoucherTransaction {
  fromUserName?: string;
  toUserName?:   string;
}

/** Voucher z danymi właściciela (dla panelu admin) */
export interface VoucherWithOwner extends Voucher {
  ownerName?:  string;
  ownerEmail?: string;
}

/** Zamówienie z danymi firmy */
export interface OrderWithCompany extends VoucherOrder {
  companyName?: string;
  companyNip?:  string;
}

/** Prowizja z danymi agenta */
export interface CommissionWithAgent extends Commission {
  agentEmail?: string;
}

// ---------------------------------------------------------------------------
// Parametry wywołań funkcji (dla lib/vouchers.ts)
// ---------------------------------------------------------------------------

export interface PurchaseVouchersParams {
  companyId:        string;
  hrUserId:         string;
  amountPln:        number;
  validMonths?:     number;
  isFirstInvoice?:  boolean;
}

export interface TransferVouchersParams {
  fromUserId: string;
  toUserId:   string;
  amount:     number;
  type:       TransactionType;
  orderId?:   string;
}

export interface RedeemVoucherParams {
  serialNumber: string;
  userId:       string;
  serviceId?:   string;
  serviceName?: string;
}

// ---------------------------------------------------------------------------
// Odpowiedzi API
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    message: string;
    code?:   string;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;
