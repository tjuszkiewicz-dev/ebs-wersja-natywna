import { ContractType, OrderStatus } from './enums';

export interface PayrollConfig {
  year: number;
  uop: {
    min_netto: number;
    min_brutto?: number;
  };
  zlecenie: {
    min_stawka_brutto_h: number;
    min_stawka_netto_h: {
      chorobowe: number;
      bez_chorobowego: number;
    };
  };
}

export interface PayrollDecision {
  employee_id?: string;
  contract_type: ContractType;
  input_data: {
    declared_netto?: number;
    total_hours?: number;
    cash_hours?: number;
    voucher_hours?: number;
    has_sickness_insurance?: boolean;
  };
  split: {
    netto_cash: number;
    netto_voucher: number;
  };
  validation: {
    is_valid: boolean;
    validated_against_config: string;
    error?: string;
  };
  timestamp: string;
}

export interface PayrollSnapshot {
  snapshot_id: string;
  employee_email: string;
  employee_name: string;
  matched_user_id?: string;
  contract_type: ContractType;
  final_netto_cash: number;
  final_netto_voucher: number;
  hours_paid: number;
  hours_voucher: number;
  config_version: number;
  locked_at: string;
}

export interface PayrollEntry {
  id: string;
  email: string;
  employeeName: string;
  contractType: ContractType;
  declaredNetAmount: number;
  statutoryMinNet: number;
  cashPartNet: number;
  voucherPartNet: number;
  totalHours: number;
  cashHours?: number;
  hasSicknessInsurance?: boolean;
  matchedUserId?: string;
  status: 'MATCHED' | 'MISSING' | 'INACTIVE' | 'INVALID_AMOUNT';
  validationError?: string;
  decisionSnapshot?: PayrollDecision;
}

export interface Order {
  id: string;
  companyId: string;
  amount: number;
  voucherValue: number;
  feeValue: number;
  totalValue: number;
  docVoucherId: string;
  docFeeId: string;
  date: string;
  status: OrderStatus;
  isFirstInvoice: boolean;
  snapshots?: PayrollSnapshot[];
  distributionPlan?: PayrollEntry[];
}

export interface ImportRow {
  rowId: number;
  name: string;
  surname: string;
  email: string;
  pesel: string;
  department: string;
  position: string;
  isValid: boolean;
  errors: string[];
  phoneNumber?: string;
  iban?: string;
  contractType?: ContractType | string;
}

export interface ImportResult {
  total: number;
  valid: number;
  invalid: number;
  rows: ImportRow[];
}

export interface ImportHistoryEntry {
  id: string;
  companyId: string;
  date: string;
  hrName: string;
  totalProcessed: number;
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  reportData: any;
}
