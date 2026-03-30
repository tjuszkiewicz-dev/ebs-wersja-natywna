
import React from 'react';
import { Eye } from 'lucide-react';
import { BuybackAgreement } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { StatusBadge } from '../../ui/StatusBadge';

interface EmployeeBuybackListProps {
  buybacks: BuybackAgreement[];
  onViewAgreement: (agreement: BuybackAgreement) => void;
}

export const EmployeeBuybackList: React.FC<EmployeeBuybackListProps> = ({ buybacks, onViewAgreement }) => {

  const columns: Column<BuybackAgreement>[] = [
      {
          header: 'ID Umowy',
          accessorKey: 'id',
          sortable: true,
          cell: (b) => <span className="font-mono text-xs text-slate-500">{b.id}</span>
      },
      {
          header: 'Data',
          accessorKey: 'dateGenerated',
          sortable: true,
          cell: (b) => <span className="text-slate-600 text-xs">{new Date(b.dateGenerated).toLocaleDateString()}</span>
      },
      {
          header: 'Wartość',
          accessorKey: 'totalValue',
          sortable: true,
          className: 'text-right',
          cell: (b) => <span className="font-bold text-slate-800">{b.totalValue} PLN</span>
      },
      {
          header: 'Status',
          accessorKey: 'status',
          sortable: true,
          className: 'text-center',
          cell: (b) => <StatusBadge status={b.status} />
      },
      {
          header: 'Podgląd',
          className: 'text-right',
          cell: (b) => (
             <div className="flex justify-end">
                <button
                    onClick={() => onViewAgreement(b)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                    title="Zobacz dokument"
                >
                    <Eye size={16}/>
                </button>
             </div>
          )
      }
  ];

  const renderMobileCard = (b: BuybackAgreement) => (
      <div className="flex justify-between items-center">
          <div>
              <span className="font-mono text-[10px] text-slate-400 block">{b.id}</span>
              <span className="font-bold text-sm text-slate-800">{b.totalValue} PLN</span>
              <span className="text-xs text-slate-500 block">{new Date(b.dateGenerated).toLocaleDateString()}</span>
          </div>
          <div className="flex flex-col items-end gap-2">
              <StatusBadge status={b.status} />
              <button onClick={() => onViewAgreement(b)} className="text-blue-600 text-xs font-bold">Pokaż</button>
          </div>
      </div>
  );

  return (
    <DataTable 
        data={buybacks}
        columns={columns}
        mobileRenderer={renderMobileCard}
        title="Twoje Umowy Odkupu"
        searchPlaceholder="Szukaj ID..."
        searchableFields={['id']}
    />
  );
};
