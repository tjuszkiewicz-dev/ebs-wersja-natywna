
import React, { useState, useMemo } from 'react';
import { AuditLogEntry } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { ExternalLink, Eye, Shield, DollarSign, Settings, List } from 'lucide-react';
import { Tabs } from '../../ui/Tabs';
import { Badge } from '../../ui/Badge';

interface AdminAuditLogProps {
  auditLogs: AuditLogEntry[];
  onLogClick?: (entry: AuditLogEntry) => void;
}

type LogCategory = 'ALL' | 'SECURITY' | 'FINANCE' | 'SYSTEM';

export const AdminAuditLog: React.FC<AdminAuditLogProps> = ({ auditLogs, onLogClick }) => {
  const [activeCategory, setActiveCategory] = useState<LogCategory>('ALL');

  const filteredLogs = useMemo(() => {
      if (activeCategory === 'ALL') return auditLogs;
      
      return auditLogs.filter(log => {
          const action = log.action.toUpperCase();
          const type = log.targetEntityType;

          if (activeCategory === 'SECURITY') {
              return action.includes('LOGIN') || action.includes('USER') || action.includes('AUTH') || action.includes('2FA');
          }
          if (activeCategory === 'FINANCE') {
              return type === 'ORDER' || type === 'BUYBACK' || action.includes('PAYMENT') || action.includes('COMMISSION');
          }
          if (activeCategory === 'SYSTEM') {
              return type === 'SYSTEM' || action.includes('CONFIG') || action.includes('INTEGRATION');
          }
          return true;
      });
  }, [auditLogs, activeCategory]);

  const getActionBadge = (action: string) => {
      if (action.includes('DELETE') || action.includes('REJECT') || action.includes('BAN')) return <Badge variant="error">{action}</Badge>;
      if (action.includes('Create') || action.includes('ADD') || action.includes('APPROVE') || action.includes('PAYMENT')) return <Badge variant="success">{action}</Badge>;
      if (action.includes('UPDATE') || action.includes('EDIT')) return <Badge variant="info">{action}</Badge>;
      if (action.includes('LOGIN') || action.includes('2FA')) return <Badge variant="indigo">{action}</Badge>;
      return <Badge variant="neutral">{action}</Badge>;
  };

  const columns: Column<AuditLogEntry>[] = [
    {
        header: 'Czas',
        accessorKey: 'timestamp',
        sortable: true,
        cell: (log) => <span className="text-xs text-slate-500 whitespace-nowrap font-mono">{new Date(log.timestamp).toLocaleString()}</span>
    },
    {
        header: 'Aktor',
        accessorKey: 'actorName',
        sortable: true,
        cell: (log) => (
            <div>
                <span className="font-bold text-slate-700 text-xs block">{log.actorName}</span>
                <span className="text-[9px] text-slate-400 font-mono block">{log.actorId}</span>
            </div>
        )
    },
    {
        header: 'Akcja',
        accessorKey: 'action',
        sortable: true,
        cell: (log) => getActionBadge(log.action)
    },
    {
        header: 'Szczegóły',
        accessorKey: 'details',
        cell: (log) => {
            const hasLink = !!log.targetEntityId;
            return (
                <div className="flex items-center justify-between gap-2 group">
                    <span 
                        className={`text-xs block max-w-md truncate ${hasLink ? 'text-slate-800 font-medium cursor-pointer group-hover:text-blue-600 transition-colors' : 'text-slate-600'}`}
                        title={log.details}
                        onClick={() => hasLink && onLogClick && onLogClick(log)}
                    >
                        {log.details}
                    </span>
                    {hasLink && (
                        <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-500 transition-opacity opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    )}
                </div>
            );
        }
    },
    {
        header: '',
        className: 'w-10 text-right',
        cell: (log) => log.targetEntityId && (
            <button 
                onClick={() => onLogClick && onLogClick(log)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition"
                title="Pokaż obiekt"
            >
                <Eye size={14}/>
            </button>
        )
    }
  ];

  const renderMobileCard = (log: AuditLogEntry) => (
      <div 
        className={`flex flex-col gap-2 ${log.targetEntityId ? 'cursor-pointer active:bg-slate-50' : ''}`}
        onClick={() => log.targetEntityId && onLogClick && onLogClick(log)}
      >
          <div className="flex justify-between items-start">
             <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
             {log.targetEntityId && <ExternalLink size={12} className="text-slate-400"/>}
          </div>
          <div className="flex justify-between items-center">
             <span className="font-bold text-sm text-slate-800">{log.actorName}</span>
             {getActionBadge(log.action)}
          </div>
          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 mt-1">{log.details}</p>
      </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* CATEGORY TABS */}
        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full md:w-fit">
            <Tabs 
                activeTab={activeCategory}
                onChange={(id) => setActiveCategory(id as LogCategory)}
                items={[
                    { id: 'ALL', label: 'Wszystkie', icon: <List size={14}/> },
                    { id: 'FINANCE', label: 'Finansowe', icon: <DollarSign size={14}/> },
                    { id: 'SECURITY', label: 'Bezpieczeństwo', icon: <Shield size={14}/> },
                    { id: 'SYSTEM', label: 'System', icon: <Settings size={14}/> },
                ]}
            />
        </div>

        <DataTable 
            data={filteredLogs}
            columns={columns}
            mobileRenderer={renderMobileCard}
            title="Dziennik Zdarzeń (Audit Log)"
            subtitle="Pełny rejestr operacji w systemie. Dane są niemodyfikowalne."
            searchPlaceholder="Szukaj w logach..."
            searchableFields={['action', 'actorName', 'details', 'actorId', 'targetEntityId']}
        />
    </div>
  );
};
