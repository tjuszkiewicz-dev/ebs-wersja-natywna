
import React from 'react';
import { Commission } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';

interface AdminQuarterlyReportProps {
  commissions: Commission[];
}

// Helper type for aggregated row
interface QuarterlyStat {
    id: string; // Composite key for table
    quarter: string;
    agentName: string;
    commissionCount: number;
    totalAmount: number;
}

export const AdminQuarterlyReport: React.FC<AdminQuarterlyReportProps> = ({ commissions }) => {
  // Pre-process data
  const aggregatedData: QuarterlyStat[] = Object.values(commissions.reduce((acc, c) => {
      const key = `${c.agentId}-${c.quarter || 'UNK'}`;
      if (!acc[key]) {
          acc[key] = {
              id: key,
              agentName: c.agentName,
              quarter: c.quarter || 'N/A',
              totalAmount: 0,
              commissionCount: 0
          };
      }
      acc[key].totalAmount += c.amount;
      acc[key].commissionCount += 1;
      return acc;
  }, {} as Record<string, QuarterlyStat>));

  const columns: Column<QuarterlyStat>[] = [
      {
          header: 'Kwartał',
          accessorKey: 'quarter',
          sortable: true,
          cell: (s) => <span className="font-mono text-xs text-slate-600 font-bold bg-slate-100 px-2 py-1 rounded">{s.quarter}</span>
      },
      {
          header: 'Agent',
          accessorKey: 'agentName',
          sortable: true,
          cell: (s) => <span className="font-medium text-slate-800">{s.agentName}</span>
      },
      {
          header: 'Liczba Transakcji',
          accessorKey: 'commissionCount',
          sortable: true,
          className: 'text-center'
      },
      {
          header: 'Suma Prowizji',
          accessorKey: 'totalAmount',
          sortable: true,
          className: 'text-right',
          cell: (s) => <span className="font-bold text-emerald-600">{s.totalAmount.toFixed(2)} PLN</span>
      }
  ];

  const renderMobileCard = (s: QuarterlyStat) => (
      <div className="flex justify-between items-center">
          <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{s.quarter}</span>
              <span className="font-bold text-slate-800">{s.agentName}</span>
              <span className="text-xs text-slate-500 block">{s.commissionCount} transakcji</span>
          </div>
          <span className="font-bold text-emerald-600 text-lg">{s.totalAmount.toFixed(2)}</span>
      </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
         <DataTable 
            data={aggregatedData}
            columns={columns}
            mobileRenderer={renderMobileCard}
            title="Wyniki Kwartalne (Symulacja)"
            subtitle="Agregacja wyników sprzedażowych na podstawie naliczonych prowizji"
            searchPlaceholder="Szukaj (Agent, Kwartał)..."
            searchableFields={['agentName', 'quarter']}
         />
    </div>
  );
};
