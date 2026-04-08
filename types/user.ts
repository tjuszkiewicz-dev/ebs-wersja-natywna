import { ContractType, Role, UserStatus } from './enums';

export interface UserIdentity {
  firstName: string;
  lastName: string;
  pesel: string;
  email: string;
  phoneNumber?: string;
}

export interface UserOrganization {
  department: string;
  position: string;
  hireDate?: string;
  costCenter?: string;
}

export interface UserContract {
  type: ContractType;
  hasSicknessInsurance?: boolean;
  contractDateStart?: string;
}

export interface IbanChangeRequest {
  newIban: string;
  reason: string;
  requestedAt: string;
  status: 'PENDING' | 'REJECTED';
  rejectionReason?: string;
}

export interface UserFinance {
  payoutAccount: {
    iban: string;
    country: string;
    isVerified: boolean;
    verificationMethod?: 'MANUAL' | 'MICROTRANSFER';
    lastVerifiedAt?: string;
  };
  pendingChange?: IbanChangeRequest;
}

export interface UserAddress {
  street: string;
  city: string;
  zipCode: string;
}

export interface User {
  id: string;
  role: Role;
  companyId?: string;
  voucherBalance: number;
  status: UserStatus;
  name: string;
  email: string;
  pesel?: string;
  department?: string;
  position?: string;
  identity?: UserIdentity;
  organization?: UserOrganization;
  contract?: UserContract;
  finance?: UserFinance;
  address?: UserAddress;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  termsAcceptedMethod?: 'MANUAL' | 'BULK_IMPORT';
  anonymizedAt?: string;
  isTwoFactorEnabled?: boolean;
  tempPassword?: string | null;
}
