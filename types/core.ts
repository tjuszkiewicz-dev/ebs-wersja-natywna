import { Role, CommissionType } from './enums';

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

export interface AnalyticMetric {
  label: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
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
