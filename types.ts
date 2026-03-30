
// GLOBAL EXTERNAL LIBS
declare global {
    const XLSX: {
        read: (data: any, options: any) => any;
        utils: {
            sheet_to_json: (sheet: any, options?: any) => any[];
            aoa_to_sheet: (data: any[][]) => any;
            book_new: () => any;
            book_append_sheet: (wb: any, ws: any, name: string) => void;
            json_to_sheet: (data: any[]) => any;
        };
        writeFile: (wb: any, filename: string) => void;
    };
    
    interface Window {
        html2pdf: () => {
            set: (opt: any) => any;
            from: (element: HTMLElement) => any;
            save: () => Promise<void>;
        };
    }

    const JSZip: new () => {
        file: (name: string, data: any) => void;
        folder: (name: string) => any;
        generateAsync: (options: any) => Promise<Blob>;
    };

    const saveAs: (data: Blob, filename: string) => void;
}

// Enums must be standard enums, not const enums
export enum Role {
  SUPERADMIN = 'SUPERADMIN',
  HR = 'HR',
  EMPLOYEE = 'EMPLOYEE',
  // Struktura Sprzedaży
  DIRECTOR = 'DIRECTOR', // Dyrektor Handlowy
  MANAGER = 'MANAGER',   // Manager
  ADVISOR = 'ADVISOR'    // Doradca
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'ANONYMIZED';

export enum VoucherStatus {
  CREATED = 'CREATED',       // Techniczny status początkowy (Pula Platformy)
  RESERVED = 'RESERVED',     // Zatwierdzone przez Admina, czeka na płatność (Warunkowe przypisanie)
  ACTIVE = 'ACTIVE',         // Opłacone, w puli HR (Gotowe do dystrybucji)
  DISTRIBUTED = 'DISTRIBUTED', // Przypisany do pracownika
  CONSUMED = 'CONSUMED',     // Wykorzystany (Usługa cyfrowa)
  EXPIRED = 'EXPIRED',       // Wygasł -> Procedura odkupu
  BUYBACK_PENDING = 'BUYBACK_PENDING', // Umowa odkupu wygenerowana (ID zamrożone)
  BUYBACK_COMPLETE = 'BUYBACK_COMPLETE' // Odkupiony, wrócił do puli głównej (logicznie)
}

export enum OrderStatus {
  PENDING = 'PENDING',       // Złożone (Umowa Zlecenia), czeka na weryfikację Admina
  APPROVED = 'APPROVED',     // Zatwierdzone -> Proforma do zapłaty -> Vouchery REZERWOWANE
  PAID = 'PAID',             // Opłacone (Bank API) -> Vouchery AKTYWNE
  REJECTED = 'REJECTED'      // Brak płatności / Odrzucone -> Vouchery wracają do puli (usuwane z rezerwacji)
}

// Typy umów do kalkulatora płacowego
export enum ContractType {
  UOP = 'UOP', // Umowa o Pracę
  UZ = 'UZ'    // Umowa Zlecenie
}

// --- NEW: DISTRIBUTION BATCH (PROTOCOL) ---
export interface DistributionBatchItem {
    userId: string;
    userName: string;
    amount: number;
}

export interface DistributionBatch {
    id: string; // PROTOCOL-YYYY-MM-DD-XXX
    companyId: string;
    date: string;
    hrName: string;
    totalAmount: number;
    items: DistributionBatchItem[];
    status: 'COMPLETED';
}

// --- ENTERPRISE INTEGRATIONS ---
export type IntegrationCategory = 'FOUNDATION' | 'WORKFLOW' | 'AUTOMATION' | 'MANAGEMENT';
export type IntegrationType = 'HR_PAYROLL' | 'BANKING' | 'ACCOUNTING' | 'SIGNATURE' | 'IDENTITY' | 'COMMUNICATION' | 'BI';
export type IntegrationProvider = 'ENOVA' | 'SAP' | 'SYMFONIA' | 'COMARCH' | 'AUTENTI' | 'AZURE' | 'SENDGRID' | 'POWERBI' | 'MILLENIUM';

export interface IntegrationConfig {
  id: string;
  provider: IntegrationProvider;
  type: IntegrationType;
  category: IntegrationCategory;
  name: string;
  description: string; // Business description for HR ("Co to robi")
  businessGoal: string; // "Po co to jest"
  status: 'CONNECTED' | 'ATTENTION' | 'DISCONNECTED';
  lastSync?: string;
  config: {
    endpointUrl?: string;
    apiKey?: string;
    webhookEvents: string[]; 
  };
}

export interface WebhookLog {
  id: string;
  integrationId: string;
  event: string;
  status: 'SUCCESS' | 'FAILED';
  timestamp: string;
  payloadSnippet: string;
}

// --- SUPPORT HELPDESK ---
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type TicketCategory = 'TECHNICAL' | 'FINANCIAL' | 'VOUCHER' | 'OTHER';

export interface TicketMessage {
    id: string;
    ticketId: string;
    senderId: string;
    senderName: string;
    senderRole: Role;
    message: string;
    timestamp: string;
    isInternal?: boolean; // For admin notes
}

export interface SupportTicket {
    id: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    creatorId: string;
    creatorName: string; // Snapshot
    companyId?: string; // For filtering by company
    createdAt: string;
    updatedAt: string;
    relatedEntityId?: string; // Context (Order ID, Voucher ID)
    relatedEntityType?: EntityType;
    messages: TicketMessage[];
}

// --- ANALYTICS & REPORTS ---
export interface AnalyticMetric {
  label: string;
  value: number | string;
  trend?: number; // percentage
  trendLabel?: string; // e.g., "vs last month"
}

// --- EPS CORE: EMPLOYEE DATA LAYERS ---

// 1. IDENTITY LAYER (KTO)
export interface UserIdentity {
  firstName: string;
  lastName: string;
  pesel: string;
  email: string;
  phoneNumber?: string; // NEW: Contact for SMS notifications
}

// 2. ORGANIZATION LAYER (GDZIE)
export interface UserOrganization {
  department: string;
  position: string;
  hireDate?: string; // NEW: For loyalty bonuses
  costCenter?: string; // MPK (Miejsce Powstawania Kosztów) for Enterprise Reporting
}

// 3. CONTRACT LAYER (NA JAKIEJ PODSTAWIE)
export interface UserContract {
  type: ContractType;
  hasSicknessInsurance?: boolean; // Dla UZ
  contractDateStart?: string;
}

// 4. FINANCE LAYER (ODKUP) - Strict Separation from Payroll
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
    country: string; // PL default
    isVerified: boolean; // Czy przeszedł weryfikację (np. mikroprzelew)
    verificationMethod?: 'MANUAL' | 'MICROTRANSFER';
    lastVerifiedAt?: string;
  };
  // NEW: Holds the pending request that blocks further changes until resolved
  pendingChange?: IbanChangeRequest;
}

// 5. ADDRESS LAYER (NEW - FOR SHIPPING/INVOICING DATA)
export interface UserAddress {
  street: string;
  city: string;
  zipCode: string;
}

// MAIN USER OBJECT (EPS Profile)
export interface User {
  id: string;
  role: Role;
  companyId?: string; 
  voucherBalance: number;
  status: UserStatus;
  
  // Flattened accessors for backward compatibility (Facade)
  name: string; 
  email: string;
  pesel?: string; 
  department?: string;
  position?: string;

  // EPS Layers - Optional because Admins/HR might not have full profiles initially
  identity?: UserIdentity;
  organization?: UserOrganization;
  contract?: UserContract; 
  finance?: UserFinance;
  address?: UserAddress; // NEW
  
  // Legal & Consent
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  termsAcceptedMethod?: 'MANUAL' | 'BULK_IMPORT';
  anonymizedAt?: string; // NEW: Compliance
  
  // Security
  isTwoFactorEnabled?: boolean; // NEW: 2FA
}

// --- CORE JSON ARCHITECTURE (AUDIT & COMPLIANCE) ---

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
  
  // Final Financials
  final_netto_cash: number;
  final_netto_voucher: number;
  
  // Final Hours (UZ)
  hours_paid: number;
  hours_voucher: number;
  
  config_version: number; 
  locked_at: string;
}

// --- Governance & Notifications ---
export enum NotificationTarget {
  EMPLOYEE = 'EMPLOYEE',
  HR = 'HR'
}

export enum NotificationTrigger {
  VOUCHER_GRANTED = 'VOUCHER_GRANTED',
  VOUCHER_EXPIRING = 'VOUCHER_EXPIRING', 
  VOUCHER_EXPIRED = 'VOUCHER_EXPIRED',
  ORDER_UNPAID = 'ORDER_UNPAID',
  ORDER_PENDING = 'ORDER_PENDING', 
  SYSTEM_ALERT = 'SYSTEM_ALERT'
}

export type NotificationActionType = 'APPROVE_ORDER' | 'REJECT_ORDER' | 'APPROVE_BUYBACK' | 'VIEW_DETAILS' | 'REVIEW_IBAN' | 'VIEW_TICKET';

export interface NotificationAction {
  type: NotificationActionType;
  targetId: string; 
  label: string;
  variant: 'primary' | 'danger' | 'neutral';
  completed?: boolean; 
  completedLabel?: string; 
}

// --- Service Catalog ---
export enum ServiceType {
  SUBSCRIPTION = 'SUBSCRIPTION', 
  ONE_TIME = 'ONE_TIME'          
}

// --- Documents ---
export enum DocumentType {
  AGREEMENT = 'AGREEMENT', 
  INVOICE = 'INVOICE',     
  POLICY = 'POLICY',       
  CONFIRMATION = 'CONFIRMATION', 
  IMPORT_REPORT = 'IMPORT_REPORT',
  PROTOCOL = 'PROTOCOL' // NEW
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: DocumentType;
  content: string; 
  version: number;
  lastModified: string;
  accessRoles: Role[]; 
  description?: string;
  isSystem?: boolean; 
}

export interface SystemConfig {
  defaultVoucherValidityDays: number;
  paymentTermsDays: number;
  platformCurrency: string;
  templates: DocumentTemplate[];
  buybackAgreementTemplate: string; 
  pdfAutoScaling: boolean;
  minPasswordLength: number;
  sessionTimeoutMinutes: number;
  auditLogRetentionDays: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number; 
  type: ServiceType;
  icon: string; 
  image?: string;
  isActive: boolean;
}

// --- TRANSACTIONS & WALLET HISTORY ---
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

export interface NotificationConfig {
  id: string;
  target: NotificationTarget;
  trigger: NotificationTrigger;
  daysOffset?: number; 
  messageTemplate: string;
  isEnabled: boolean;
}

export interface NotificationChannelPreference {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}

export interface NotificationPreferenceItem {
  id: string;
  trigger: NotificationTrigger;
  label: string;
  channels: NotificationChannelPreference;
}

// NEW: Strict Payroll Entry for Net-First Logic
export interface PayrollEntry {
  id: string; 
  email: string;
  employeeName: string;
  contractType: ContractType;
  
  // Core Net Calculation
  declaredNetAmount: number; 
  statutoryMinNet: number;   
  
  // Distribution (Editable)
  cashPartNet: number;       
  voucherPartNet: number;    
  
  // Metadata for Hourly Logic (UZ)
  totalHours: number;        
  cashHours?: number;        
  hasSicknessInsurance?: boolean; 
  
  // Matching Status
  matchedUserId?: string;
  status: 'MATCHED' | 'MISSING' | 'INACTIVE' | 'INVALID_AMOUNT';
  validationError?: string; 

  // LINK TO JSON DECISION
  decisionSnapshot?: PayrollDecision; 
}

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
  // Config Overrides
  customVoucherValidityDays?: number;
  customPaymentTermsDays?: number;
  
  // --- CRM INTEGRATION FIELDS (NEW) ---
  origin?: 'NATIVE' | 'CRM_SYNC'; // Source of the company entity
  externalCrmId?: string;         // ID in the central CRM database
  isSyncManaged?: boolean;        // If true, fields like Name/NIP/Advisor are locked in EBS
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

// BUYBACK SNAPSHOT DEFINITION
export interface BuybackSnapshot {
    user: {
        name: string;
        email: string;
        pesel: string;
        address?: string; // Consolidated address string
        iban: string; // CRITICAL: IBAN at moment of agreement
    };
    vouchers: string[]; // List of IDs
    termsVersion: string;
}

export interface BuybackAgreement {
  id: string;
  userId: string;
  voucherCount: number;
  totalValue: number;
  dateGenerated: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
  
  // NEW: The JSON Snapshot
  snapshot?: BuybackSnapshot;
}

export type EntityType = 'ORDER' | 'USER' | 'BUYBACK' | 'COMPANY' | 'SYSTEM' | 'TICKET';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string; 
  details: string;
  targetEntityId?: string;
  targetEntityType?: EntityType;
}

export enum CommissionType {
  ACQUISITION = 'ACQUISITION', 
  RECURRING = 'RECURRING',     
  RENEWAL = 'RENEWAL'          
}

export interface Commission {
  id: string;
  agentId: string;
  agentName: string;
  role: Role;
  type: CommissionType; 
  orderId?: string;
  amount: number;
  rate: string; 
  dateCalculated: string;
  quarter?: string; 
  isPaid: boolean;
}

export interface QuarterlyPerformance {
  agentId: string;
  quarter: string; 
  acquisitionsCount: number; 
  currentTierRate: number; 
}

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface Notification {
  id: string;
  userId: string; 
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  priority?: NotificationPriority; // NEW
  read: boolean;
  date: string;
  action?: NotificationAction; 
  targetEntityId?: string;
  targetEntityType?: EntityType;
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
  // NEW OPTIONAL FIELDS FOR EXTENDED MODAL
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
