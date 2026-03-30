
import React from 'react';
import { Commission, CommissionType } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { Badge } from '../../ui/Badge';

interface AdminFinancePanelProps {
  commissions: Commission[];
}

export const AdminFinancePanel: React.FC<AdminFinancePanelProps> = ({ commissions }) => {

  const columns: Column<Commission>[] = [
    {
        header: 'Data',
        accessorKey: 'dateCalculated',
        sortable: true,
        cell: (c) => <span className="text-slate-500 text-xs">{new Date(c.dateCalculated).toLocaleDateString()}</span>
    },
    {
        header: 'Agent',
        accessorKey: 'agentName',
        sortable: true,
        cell: (c) => <span className="font-medium text-slate-800">{c.agentName}</span>
    },
    {
        header: 'Rola',
        accessorKey: 'role',
        sortable: true,
        cell: (c) => <span className="text-[10px] uppercase font-bold text-slate-500">{c.role}</span>
    },
    {
        header: 'Typ',
        accessorKey: 'type',
        sortable: true,
        cell: (c) => {
            switch(c.type) {
                case CommissionType.ACQUISITION: return <Badge variant="indigo">Pozyskanie</Badge>;
                case CommissionType.RENEWAL: return <Badge variant="success">Odnowienie</Badge>;
                default: return <Badge variant="info">Utrzymanie</Badge>;
            }
        }
    },
    {
        header: 'Stawka',
        accessorKey: 'rate',
        cell: (c) => <span className="font-mono text-xs">{c.rate}</span>
    },
    {
        header: 'Kwota',
        accessorKey: 'amount',
        sortable: true,
        className: 'text-right',
        cell: (c) => <span className="font-bold text-slate-700">{c.amount.toFixed(2)} PLN</span>
    }
  ];

  const renderMobileCard = (c: Commission) => (
      <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
              <div>
                  <h4 className="font-bold text-slate-800 text-sm">{c.agentName}</h4>
                  <p className="text-[10px] text-slate-500 uppercase">{c.role}</p>
              </div>
              <span className="text-xs text-slate-400">{new Date(c.dateCalculated).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-1">
              {columns[3].cell && columns[3].cell(c)}
              <span className="font-bold text-slate-800">{c.amount.toFixed(2)} PLN</span>
          </div>
      </div>
  );

  const totalPaid = commissions.reduce((acc, c) => acc + (c.isPaid ? c.amount : 0), 0);

  return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Suma Prowizji (Wypłacone)</h4>
              <p className="text-3xl font-bold text-slate-800">{totalPaid.toFixed(2)} PLN</p>
          </div>

          <DataTable 
            data={commissions}
            columns={columns}
            mobileRenderer={renderMobileCard}
            title="Rejestr Prowizji"
            subtitle="Szczegółowa lista naliczeń dla struktury sprzedaży"
            searchPlaceholder="Szukaj Agenta..."
            searchableFields={['agentName', 'role', 'orderId']}
          />
      </div>
  );
};
