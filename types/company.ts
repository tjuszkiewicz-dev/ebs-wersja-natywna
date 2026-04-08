import { UserAddress } from './user';

export interface Company {
  id: string;
  name: string;
  nip: string;
  balancePending: number;
  balanceActive: number;
  advisorId?: string;
  managerId?: string;
  directorId?: string;
  address?: UserAddress;
  email?: string;
  phone?: string;
  contactPersonName?: string;
  correspondenceAddress?: UserAddress;
  customVoucherValidityDays?: number;
  customPaymentTermsDays?: number;
  feePercent?: number;
  voucherExpiryDay?: number;
  voucherExpiryHour?: number;
  voucherExpiryMinute?: number;
  krs?: string;
  regon?: string;
  voucherValidityDays?: number;
  origin?: 'NATIVE' | 'CRM_SYNC';
  externalCrmId?: string;
  isSyncManaged?: boolean;
}
