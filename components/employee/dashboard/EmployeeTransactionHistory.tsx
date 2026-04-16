
import React from 'react';
import { Transaction } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface EmployeeTransactionHistoryProps {
  transactions: Transaction[];
}

export const EmployeeTransactionHistory: React.FC<EmployeeTransactionHistoryProps> = ({ transactions }) => {

  const columns: Column<Transaction>[] = [
      {
          header: 'Typ',
          accessorKey: 'type',
          sortable: true,
          className: 'w-12 text-center',
          cell: (t) => t.type === 'CREDIT' 
            ? <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-full inline-flex"><ArrowDownLeft size={16} /></div>
            : <div className="p-1.5 bg-red-100 text-red-600 rounded-full inline-flex"><ArrowUpRight size={16} /></div>
      },
      {
          header: 'Data',
          accessorKey: 'date',
          sortable: true,
          cell: (t) => <span className="text-slate-500 text-xs">{new Date(t.date).toLocaleDateString()} <span className="text-slate-300">{new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></span>
      },
      {
          header: 'Szczegóły Operacji',
          accessorKey: 'serviceName', // Fallback for sort
          cell: (t) => t.type === 'CREDIT' ? (
              <div>
                  <span className="font-bold text-slate-700 block">Zasilenie Konta</span>
                  {t.serialRange ? (
                      <span className="text-[10px] text-slate-400 font-mono block">
                          Zakres: ...{t.serialRange.start.slice(-6)} - ...{t.serialRange.end.slice(-6)}
                      </span>
                  ) : (
                      <span className="text-[10px] text-slate-400">Bonus / Manual</span>
                  )}
                  {t.sourceOrderId && (
                      <span className="text-[10px] text-blue-400 font-mono block mt-0.5" title={`Zamówienie: ${t.sourceOrderId}`}>
                          Zam: …{t.sourceOrderId.slice(-8)}
                      </span>
                  )}
              </div>
          ) : (
              <div>
                  <span className="font-medium text-slate-700 block">{t.serviceName}</span>
                  <span className="text-[10px] text-slate-400 block">Zakup usługi</span>
              </div>
          )
      },
      {
          header: 'Kwota',
          accessorKey: 'amount',
          sortable: true,
          className: 'text-right',
          cell: (t) => t.type === 'CREDIT' 
            ? <span className="font-bold text-emerald-600">+{t.amount} vou</span>
            : <span className="font-bold text-slate-800">-{t.amount} vou</span>
      }
  ];

  const renderMobileCard = (t: Transaction) => (
      <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
              {t.type === 'CREDIT' 
                ? <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full"><ArrowDownLeft size={16} /></div>
                : <div className="p-2 bg-red-100 text-red-600 rounded-full"><ArrowUpRight size={16} /></div>
              }
              <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                      {t.type === 'CREDIT' ? 'Zasilenie Konta' : t.serviceName}
                  </h4>
                  <p className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString()}</p>
                  {t.type === 'CREDIT' && t.serialRange && (
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {t.serialRange.start.slice(-6)}...{t.serialRange.end.slice(-6)}
                      </p>
                  )}
                  {t.type === 'CREDIT' && t.sourceOrderId && (
                      <p className="text-[9px] text-blue-400 font-mono mt-0.5" title={`Zamówienie: ${t.sourceOrderId}`}>
                          Zam: …{t.sourceOrderId.slice(-8)}
                      </p>
                  )}
              </div>
          </div>
          <span className={`font-bold text-sm ${t.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-800'}`}>
              {t.type === 'CREDIT' ? '+' : '-'}{t.amount}
          </span>
      </div>
  );

  return (
    <DataTable 
        data={transactions}
        columns={columns}
        mobileRenderer={renderMobileCard}
        title="Historia Operacji"
        subtitle="Szczegółowy wykaz wpływów i wydatków"
        searchPlaceholder="Szukaj..."
        searchableFields={['serviceName', 'type']}
    />
  );
};
