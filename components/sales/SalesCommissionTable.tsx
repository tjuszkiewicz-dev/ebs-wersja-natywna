
import React from 'react';
import { Commission, CommissionType } from '../../types';
import { DataTable, Column } from '../ui/DataTable';
import { Badge } from '../ui/Badge';

interface Props {
  commissions: Commission[];
}

export const SalesCommissionTable: React.FC<Props> = ({ commissions }) => {

  const columns: Column<Commission>[] = [
    {
        header: 'Data',
        accessorKey: 'dateCalculated',
        sortable: true,
        cell: (c) => <span className="text-slate-500 text-xs">{new Date(c.dateCalculated).toLocaleDateString()}</span>
    },
    {
        header: 'Zamówienie',
        accessorKey: 'orderId',
        sortable: true,
        cell: (c) => <span className="font-mono text-xs text-slate-600">{c.orderId}</span>
    },
    {
        header: 'Typ',
        accessorKey: 'type',
        sortable: true,
        cell: (c) => c.type === CommissionType.ACQUISITION 
            ? <Badge variant="indigo">Pozyskanie</Badge>
            : <Badge variant="success">Utrzymanie</Badge>
    },
    {
        header: 'Stawka',
        accessorKey: 'rate',
        sortable: true,
        cell: (c) => <span className="text-slate-700 font-medium">{c.rate}</span>
    },
    {
        header: 'Kwota',
        accessorKey: 'amount',
        sortable: true,
        className: 'text-right',
        cell: (c) => <span className="font-bold text-emerald-600">{c.amount.toFixed(2)} PLN</span>
    }
  ];

  const renderMobileCard = (c: Commission) => (
      <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
              <span className="font-mono text-xs text-slate-500">{c.orderId}</span>
              <span className="text-xs text-slate-400">{new Date(c.dateCalculated).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center">
              <div>
                  {c.type === CommissionType.ACQUISITION ? <Badge variant="indigo">Pozyskanie</Badge> : <Badge variant="success">Utrzymanie</Badge>}
                  <span className="text-xs text-slate-500 ml-2">({c.rate})</span>
              </div>
              <span className="font-bold text-emerald-600 text-sm">{c.amount.toFixed(2)} PLN</span>
          </div>
      </div>
  );

  return (
      <DataTable 
        data={commissions}
        columns={columns}
        mobileRenderer={renderMobileCard}
        title="Twoje Prowizje"
        subtitle="Historia naliczeń prowizyjnych"
        searchPlaceholder="Szukaj ID Zamówienia..."
        searchableFields={['orderId']}
    />
  );
};
