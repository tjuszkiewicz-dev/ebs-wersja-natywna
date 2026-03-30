
import React, { useState } from 'react';
import { FileText, FileSpreadsheet, CreditCard, User as UserIcon, Users, CalendarClock, Clock, FileCheck } from 'lucide-react';
import { Order, OrderStatus } from '../../../types'; 
import { DataTable, Column } from '../../ui/DataTable';
import { StatusBadge } from '../../ui/StatusBadge';
import { PaymentDetailsModal } from '../modals/PaymentDetailsModal';
import { formatDate, formatCurrency } from '../../../utils/formatters';

interface HROrderListProps {
  orders: Order[];
  onViewProforma: (type: 'DEBIT_NOTE' | 'VAT_INVOICE', order: Order) => void;
  onViewEvidence: (order: Order) => void;
  onDistributeSingle: (order: Order) => void; 
  onDistributeBulk: (order: Order) => void; 
}

export const HROrderList: React.FC<HROrderListProps> = ({ orders, onViewProforma, onViewEvidence, onDistributeSingle, onDistributeBulk }) => {
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<Order | null>(null);

  const getDueDate = (dateStr: string) => {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + 7);
      return formatDate(date.toISOString());
  };

  const columns: Column<Order>[] = [
    {
        header: 'Numer i Data',
        accessorKey: 'id',
        sortable: true,
        cell: (o) => (
            <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-800">{o.id}</span>
                <span className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Clock size={10}/> {formatDate(o.date)}
                </span>
            </div>
        )
    },
    {
        header: 'Kwota do zapłaty',
        accessorKey: 'totalValue',
        sortable: true,
        cell: (o) => (
            <div className="flex flex-col items-start gap-0.5">
                <span className="font-bold text-base text-slate-900">
                    {formatCurrency(o.totalValue)}
                </span>
                <div className="flex gap-2 text-[10px] text-slate-500">
                    <span>V: {o.voucherValue.toLocaleString()}</span>
                    <span>|</span>
                    <span>Obsługa: {o.feeValue.toLocaleString()}</span>
                </div>
            </div>
        )
    },
    {
        header: 'Status / Termin',
        accessorKey: 'status',
        sortable: true,
        className: 'text-center',
        cell: (o) => (
            <div className="flex flex-col items-center gap-1">
                <StatusBadge status={o.status} />
                {o.status === OrderStatus.APPROVED && (
                    <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                        <CalendarClock size={10}/> Termin: {getDueDate(o.date)}
                    </span>
                )}
            </div>
        )
    },
    {
        header: 'Akcje',
        className: 'text-right',
        cell: (o) => {
            if (o.status === OrderStatus.PENDING) return <span className="text-xs text-slate-400 italic">Oczekiwanie na akceptację</span>;
            
            const isPaid = o.status === OrderStatus.PAID;

            return (
            <div className="flex items-center justify-end gap-2">
                {/* Pay Button for Approved Orders */}
                {o.status === OrderStatus.APPROVED && (
                    <button 
                        onClick={() => setSelectedPaymentOrder(o)}
                        className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm mr-2"
                        title="Zobacz dane do przelewu"
                    >
                        <CreditCard size={14}/> Zapłać
                    </button>
                )}

                {/* Distribution Shortcuts for PAID Orders */}
                {isPaid && (
                    <div className="flex gap-1 mr-2 border-r border-slate-200 pr-2">
                        <button 
                            onClick={() => onDistributeSingle(o)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded transition"
                            title="Rozdaj Pojedynczo"
                        >
                            <UserIcon size={16}/>
                        </button>
                        <button 
                            onClick={() => onDistributeBulk(o)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded transition"
                            title="Rozdaj Masowo (Excel)"
                        >
                            <Users size={16}/>
                        </button>
                    </div>
                )}

                {/* Documents */}
                <div className="flex flex-col gap-1 items-end">
                    <div className="flex gap-1">
                        <button 
                            onClick={() => onViewProforma('DEBIT_NOTE', o)}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-100 transition flex items-center gap-1"
                        >
                            <FileSpreadsheet size={12}/> Nota
                        </button>
                        <button 
                            onClick={() => onViewProforma('VAT_INVOICE', o)}
                            className={`text-[10px] font-bold px-2 py-1 rounded border transition flex items-center gap-1 ${
                                isPaid 
                                ? 'text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border-indigo-100' 
                                : 'text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border-slate-200'
                            }`}
                        >
                            <FileText size={12}/> {isPaid ? 'Faktura VAT' : 'Faktura'}
                        </button>
                    </div>
                    {/* EVIDENCE BUTTON */}
                    <button 
                        onClick={() => onViewEvidence(o)}
                        className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200 transition flex items-center gap-1 w-fit"
                        title="Lista pracowników, którzy otrzymali vouchery z tego zamówienia"
                    >
                        <FileCheck size={12}/> Lista Wydania (Ewidencja)
                    </button>
                </div>
            </div>
        )}
    }
  ];

  const renderMobileCard = (o: Order) => (
      <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start">
             <div>
                 <span className="font-bold text-sm text-slate-800 block">{o.id}</span>
                 <span className="text-xs text-slate-400">{formatDate(o.date)}</span>
             </div>
             <StatusBadge status={o.status} />
          </div>
          
          <div className="py-2 border-t border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500 uppercase font-bold">Do zapłaty</span>
              <div className="text-right">
                  <span className="font-bold text-lg text-slate-900 block leading-none">{formatCurrency(o.totalValue)}</span>
                  <span className="text-[10px] text-slate-400">(Vouchery + Obsługa)</span>
              </div>
          </div>

          <div className="flex flex-col gap-3">
                 {o.status === OrderStatus.APPROVED && (
                    <button 
                        onClick={() => setSelectedPaymentOrder(o)}
                        className="w-full py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 flex justify-center items-center gap-2"
                    >
                        <CreditCard size={16}/> Opłać (Pokaż dane)
                    </button>
                 )}
                 {/* ... (rest of mobile buttons logic) ... */}
          </div>
      </div>
  );

  return (
    <>
        <DataTable 
            data={orders}
            columns={columns}
            mobileRenderer={renderMobileCard}
            title="Twoje Faktury i Zamówienia"
            subtitle="Pobierz dokumenty lub sprawdź status płatności"
            searchPlaceholder="Szukaj po numerze..."
            searchableFields={['id']}
        />

        {selectedPaymentOrder && (
            <PaymentDetailsModal 
                isOpen={!!selectedPaymentOrder}
                onClose={() => setSelectedPaymentOrder(null)}
                order={selectedPaymentOrder}
                company={{ name: 'Twoja Firma' } as any}
            />
        )}
    </>
  );
};
