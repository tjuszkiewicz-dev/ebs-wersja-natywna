
import React, { useMemo } from 'react';
import { X, Calendar, ArrowRight, Wallet, ShoppingCart, Clock } from 'lucide-react';
import { User, Voucher, VoucherStatus } from '../../../types';

interface EmployeeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  historyMonth: string;
  onMonthChange: (val: string) => void;
  historyVouchers: Voucher[];
}

export const EmployeeHistoryModal: React.FC<EmployeeHistoryModalProps> = ({
  isOpen, onClose, user, historyMonth, onMonthChange, historyVouchers
}) => {
  if (!isOpen) return null;

  const totalInPeriod = historyVouchers.reduce((acc, v) => acc + v.value, 0);

  // --- LOGIC: Group Vouchers into "Transaction Batches" ---
  const groupedHistory = useMemo(() => {
      const groups: Record<string, {
          date: string;
          status: VoucherStatus;
          vouchers: Voucher[];
          totalValue: number;
      }> = {};

      historyVouchers.forEach(v => {
          // Group by Date (down to minute) and Status to identify unique operations
          // We assume bulk operations happen at the same timestamp
          const key = `${v.issueDate.slice(0, 16)}_${v.status}`;
          
          if (!groups[key]) {
              groups[key] = {
                  date: v.issueDate,
                  status: v.status,
                  vouchers: [],
                  totalValue: 0
              };
          }
          groups[key].vouchers.push(v);
          groups[key].totalValue += v.value;
      });

      // Sort groups by date descending
      return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [historyVouchers]);

  // Helper to extract clean ID suffix for readability
  const getShortId = (fullId: string) => {
      const parts = fullId.split('/');
      return parts.length > 1 ? parts[parts.length - 1] : fullId;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="bg-white p-5 border-b border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg">
                        {user.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">Historia Benefitów</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                            {user.name} <span className="text-slate-300">|</span> {user.email}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
                    <X size={20} />
                </button>
            </div>
            
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-500 uppercase">Filtruj okres:</label>
                    <div className="relative">
                        <input 
                            type="month" 
                            value={historyMonth}
                            onChange={(e) => onMonthChange(e.target.value)}
                            className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white shadow-sm cursor-pointer"
                        />
                        <Calendar size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase block">Suma w okresie</span>
                    <span className="text-lg font-bold text-emerald-600">{totalInPeriod} pkt</span>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto p-0 flex-1 bg-white">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm text-xs uppercase font-bold tracking-wide">
                        <tr>
                            <th className="px-6 py-3 border-b border-slate-200">Data Operacji</th>
                            <th className="px-6 py-3 border-b border-slate-200">Typ i Status</th>
                            <th className="px-6 py-3 border-b border-slate-200">Zakres Voucherów (ID)</th>
                            <th className="px-6 py-3 border-b border-slate-200 text-right">Wartość</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {groupedHistory.map((group, idx) => {
                            // Find ID Range
                            const sortedIds = group.vouchers.map(v => v.id).sort();
                            const firstId = getShortId(sortedIds[0]);
                            const lastId = getShortId(sortedIds[sortedIds.length - 1]);
                            const isSingle = sortedIds.length === 1;

                            const isCredit = group.status === VoucherStatus.DISTRIBUTED || group.status === VoucherStatus.ACTIVE;
                            
                            return (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-sm">
                                                {new Date(group.date).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {new Date(group.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                            group.status === VoucherStatus.DISTRIBUTED ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            group.status === VoucherStatus.CONSUMED ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                            group.status === VoucherStatus.EXPIRED ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        }`}>
                                            {group.status === VoucherStatus.DISTRIBUTED && <Wallet size={12}/>}
                                            {group.status === VoucherStatus.CONSUMED && <ShoppingCart size={12}/>}
                                            {group.status === VoucherStatus.EXPIRED && <Clock size={12}/>}
                                            {group.status === VoucherStatus.DISTRIBUTED ? 'Otrzymano' : 
                                             group.status === VoucherStatus.CONSUMED ? 'Wydano' : group.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 text-sm font-mono text-slate-700" title={`Pełny zakres:\n${sortedIds[0]}\n...\n${sortedIds[sortedIds.length-1]}`}>
                                                <span className="font-bold bg-slate-100 px-1.5 rounded text-slate-600">{firstId}</span>
                                                {!isSingle && (
                                                    <>
                                                        <ArrowRight size={14} className="text-slate-400"/>
                                                        <span className="font-bold bg-slate-100 px-1.5 rounded text-slate-600">{lastId}</span>
                                                    </>
                                                )}
                                            </div>
                                            {!isSingle && (
                                                <span className="text-[10px] text-slate-400 mt-1 pl-1">
                                                    Pakiet zbiorczy ({group.vouchers.length} szt.)
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-slate-600'}`}>
                                            {isCredit ? '+' : '-'}{group.totalValue} PLN
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {groupedHistory.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Clock size={32} className="opacity-20"/>
                                        <p>Brak operacji w wybranym miesiącu.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Footer Summary */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 text-xs text-slate-500 text-center shrink-0">
                Wyświetlono {groupedHistory.length} operacji (zgrupowanych) dla okresu {historyMonth}.
            </div>
        </div>
    </div>
  );
};
