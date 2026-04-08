import { Role, DocumentType, ServiceType } from './enums';
import { EntityType } from './core';

export type IntegrationCategory = 'FOUNDATION' | 'WORKFLOW' | 'AUTOMATION' | 'MANAGEMENT';
export type IntegrationType = 'HR_PAYROLL' | 'BANKING' | 'ACCOUNTING' | 'SIGNATURE' | 'IDENTITY' | 'COMMUNICATION' | 'BI';
export type IntegrationProvider = 'ENOVA' | 'SAP' | 'SYMFONIA' | 'COMARCH' | 'AUTENTI' | 'AZURE' | 'SENDGRID' | 'POWERBI' | 'MILLENIUM';

export interface IntegrationConfig {
  id: string;
  provider: IntegrationProvider;
  type: IntegrationType;
  category: IntegrationCategory;
  name: string;
  description: string;
  businessGoal: string;
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
  isInternal?: boolean;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  creatorId: string;
  creatorName: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
  relatedEntityId?: string;
  relatedEntityType?: EntityType;
  messages: TicketMessage[];
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
