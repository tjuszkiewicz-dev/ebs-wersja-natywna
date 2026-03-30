
import React, { useState, useMemo } from 'react';
import { CheckCircle, XCircle, FileText, Filter, Clock, CheckCheck, Ban } from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { DataTable, Column } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';

interface Props {
  orders: Order[];
  onApproveOrder: (id: string) => void;
  onSimulateBankPayment: (id: string, success: boolean) => void;
  onViewDocument: (type: 'DEBIT_NOTE' | 'VAT_INVOICE', order: Order) => void;
}

export const OrdersTable: React.FC<Props> = ({ orders, onApproveOrder, onSimulateBankPayment, onViewDocument }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'ALL'>('ALL');

  // --- FILTERING LOGIC ---
  const filteredOrders = useMemo(() => {
      if (activeFilter === 'ALL') return orders;
      return orders.filter(o => o.status === activeFilter);
  }, [orders, activeFilter]);

  // --- COUNTS FOR TABS ---
  const counts = useMemo(() => ({
      ALL: orders.length,
      PENDING: orders.filter(o => o.status === OrderStatus.PENDING).length,
      APPROVED: orders.filter(o => o.status === OrderStatus.APPROVED).length,
      PAID: orders.filter(o => o.status === OrderStatus.PAID).length,
      REJECTED: orders.filter(o => o.status === OrderStatus.REJECTED).length,
  }), [orders]);

  const columns: Column<Order>[] = [
    {
      header: 'ID Zamówienia',
      accessorKey: 'id',
      sortable: true,
      cell: (order) => (
          <div>
              <span className="font-mono text-xs font-bold text-slate-700 block">{order.id}</span>
              {order.isFirstInvoice && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 rounded font-bold border border-blue-100">Pierwsze</span>}
          </div>
      )
    },
    {
      header: 'Firma',
      accessorKey: 'companyId',
      sortable: true,
      cell: (order) => <span className="font-medium text-slate-800 text-xs">{order.companyId}</span>
    },
    {
      header: 'Data',
      accessorKey: 'date',
      sortable: true,
      cell: (order) => <span className="text-slate-500 text-xs">{new Date(order.date).toLocaleDateString()}</span>
    },
    {
      header: 'Wartość (Brutto)',
      accessorKey: 'totalValue',
      sortable: true,
      className: 'text-right',
      cell: (order) => (
        <div className="flex flex-col items-end">
            <span className="font-bold text-slate-800">{order.totalValue.toLocaleString('pl-PL', {minimumFractionDigits: 2})} PLN</span>
            <div className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                <span title="Vouchery">V: {order.voucherValue.toLocaleString()}</span>
                <span className="text-slate-300">|</span>
                <span title="Obsługa">F: {order.feeValue.toLocaleString()}</span>
            </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      className: 'text-center',
      cell: (order) => <StatusBadge status={order.status} />
    },
    {
      header: '',
      className: 'text-right w-[180px]',
      cell: (order) => (
        <div className="flex flex-col items-end gap-2 justify-center h-full">
            <div className="flex items-center gap-2">
                {/* PRIMARY ACTIONS */}
                {order.status === OrderStatus.PENDING && (
                    <button 
                        onClick={() => onApproveOrder(order.id)}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition shadow-sm flex items-center gap-1"
                    >
                        <CheckCircle size={14}/> Zatwierdź
                    </button>
                )}
                
                {order.status === OrderStatus.APPROVED && (
                    <>
                        <button 
                            onClick={() => onSimulateBankPayment(order.id, true)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition shadow-sm flex items-center gap-1"
                            title="Potwierdź wpłatę"
                        >
                            <CheckCheck size={14}/> Opłacono
                        </button>
                        <button 
                            onClick={() => onSimulateBankPayment(order.id, false)}
                            className="p-1.5 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 transition"
                            title="Odrzuć (Brak wpłaty)"
                        >
                            <Ban size={14}/>
                        </button>
                    </>
                )}

                {/* DOCUMENTS (Secondary) */}
                {order.status !== OrderStatus.PENDING && (
                    <div className="flex border border-slate-200 rounded overflow-hidden">
                        <button 
                            onClick={() => onViewDocument('DEBIT_NOTE', order)}
                            className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold hover:bg-white hover:text-indigo-600 transition border-r border-slate-200"
                            title="Nota Księgowa"
                        >
                            NK
                        </button>
                        <button 
                            onClick={() => onViewDocument('VAT_INVOICE', order)}
                            className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold hover:bg-white hover:text-indigo-600 transition"
                            title="Faktura VAT"
                        >
                            FV
                        </button>
                    </div>
                )}
            </div>
        </div>
      )
    }
  ];

  const renderMobileCard = (order: Order) => (
    <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start">
            <div>
                <span className="font-mono text-xs text-slate-500 block mb-0.5">{order.id}</span>
                <h4 className="font-bold text-slate-800 text-sm">{order.companyId}</h4>
            </div>
            <StatusBadge status={order.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 py-2 border-t border-b border-slate-100">
            <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Data</span>
                <p className="text-xs text-slate-700">{new Date(order.date).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Wartość</span>
                <p className="text-sm font-bold text-slate-800">{order.totalValue.toLocaleString()} PLN</p>
            </div>
        </div>

        <div className="flex justify-end gap-2 items-center">
             {order.status === OrderStatus.PENDING && (
                <button 
                    onClick={() => onApproveOrder(order.id)}
                    className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2"
                >
                    <CheckCircle size={14}/> Zatwierdź
                </button>
             )}
             {order.status === OrderStatus.APPROVED && (
                 <button 
                    onClick={() => onSimulateBankPayment(order.id, true)}
                    className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2"
                 >
                    <CheckCheck size={14}/> Potwierdź Wpłatę
                 </button>
             )}
        </div>
    </div>
  );

  return (
    <div className="space-y-4">
        {/* --- SMART FILTERS (TABS) --- */}
        <div className="flex flex-wrap gap-2 p-1 bg-slate-100/50 rounded-xl border border-slate-200 w-fit">
            {[
                { id: 'ALL', label: 'Wszystkie', icon: null, count: counts.ALL },
                { id: OrderStatus.PENDING, label: 'Do Akceptacji', icon: <Clock size={14}/>, count: counts.PENDING, alert: true },
                { id: OrderStatus.APPROVED, label: 'Oczekuje na Wpłatę', icon: <CheckCircle size={14}/>, count: counts.APPROVED, info: true },
                { id: OrderStatus.PAID, label: 'Opłacone', icon: <CheckCheck size={14}/>, count: counts.PAID },
                { id: OrderStatus.REJECTED, label: 'Odrzucone', icon: <Ban size={14}/>, count: counts.REJECTED },
            ].map(tab => {
                const isActive = activeFilter === tab.id;
                const isAlert = tab.alert && tab.count > 0;
                const isInfo = tab.info && tab.count > 0;

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveFilter(tab.id as any)}
                        className={`
                            px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all
                            ${isActive 
                                ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                                isAlert ? 'bg-amber-500 text-white' : 
                                isInfo ? 'bg-indigo-500 text-white' :
                                isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>

        <DataTable 
            data={filteredOrders}
            columns={columns}
            mobileRenderer={renderMobileCard}
            title="Centrum Zamówień"
            subtitle="Zarządzanie przepływem finansowym"
            searchPlaceholder="Szukaj ID, Firmy..."
            searchableFields={['id', 'companyId']}
        />
    </div>
  );
};
