
import React from 'react';
import { OrderStatus, VoucherStatus, TicketStatus } from '../../types';

type StatusType = OrderStatus | VoucherStatus | TicketStatus | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  
  // Normalized configuration
  const getConfig = (s: string) => {
    const normalized = s.toUpperCase();
    
    switch (normalized) {
      case 'PAID':
      case 'ACTIVE':
      case 'RESOLVED':
      case 'SUCCESS':
      case 'CONNECTED':
        return { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: getLabel(normalized) };
      
      case 'PENDING':
      case 'PENDING_APPROVAL':
      case 'IN_PROGRESS':
      case 'WARNING':
      case 'ATTENTION':
      case 'OPEN':
        return { color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: getLabel(normalized) };
      
      case 'APPROVED': // Special case for Admin
        return { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', label: getLabel(normalized) };

      case 'DISTRIBUTED':
      case 'CREATED':
        return { color: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', label: getLabel(normalized) };

      case 'REJECTED':
      case 'EXPIRED':
      case 'ERROR':
      case 'DISCONNECTED':
      case 'FAILED':
        return { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: getLabel(normalized) };

      default:
        return { color: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', label: getLabel(normalized) };
    }
  };

  const getLabel = (s: string) => {
      const labels: Record<string, string> = {
          'PAID': 'Opłacone',
          'ACTIVE': 'Aktywny',
          'PENDING': 'Oczekuje',
          'PENDING_APPROVAL': 'Do Akceptacji',
          'APPROVED': 'Zatwierdzone', // Better context
          'REJECTED': 'Odrzucone',
          'DISTRIBUTED': 'Rozdany',
          'CONSUMED': 'Zużyty',
          'EXPIRED': 'Wygasły',
          'OPEN': 'Otwarte',
          'IN_PROGRESS': 'W toku',
          'RESOLVED': 'Rozwiązane',
          'CLOSED': 'Zamknięte',
          'CONNECTED': 'Połączono',
          'DISCONNECTED': 'Rozłączono',
          'ATTENTION': 'Wymaga Uwagi'
      };
      return labels[s] || s;
  };

  const config = getConfig(String(status));

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${config.bg} ${config.text} ${config.border} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`}></span>
      {config.label}
    </span>
  );
};
