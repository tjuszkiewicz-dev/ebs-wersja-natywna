import { VoucherStatus } from './enums';

export interface DistributionBatchItem {
  userId: string;
  userName: string;
  amount: number;
}

export interface DistributionBatch {
  id: string;
  companyId: string;
  date: string;
  hrName: string;
  totalAmount: number;
  items: DistributionBatchItem[];
  status: 'COMPLETED';
}

export interface Voucher {
  id: string;
  value: 1;
  status: VoucherStatus;
  companyId: string;
  orderId?: string;
  ownerId?: string;
  issueDate: string;
  expiryDate?: string;
  emissionId: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  date: string;
  serviceId?: string;
  serviceName?: string;
  sourceOrderId?: string;
  serialRange?: {
    start: string;
    end: string;
  };
}

export interface BuybackSnapshot {
  user: {
    name: string;
    email: string;
    pesel: string;
    address?: string;
    iban: string;
  };
  vouchers: string[];
  termsVersion: string;
}

export interface BuybackAgreement {
  id: string;
  userId: string;
  voucherCount: number;
  totalValue: number;
  dateGenerated: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
  snapshot?: BuybackSnapshot;
}
