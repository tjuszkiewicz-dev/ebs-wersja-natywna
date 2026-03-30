
import React, { useMemo } from 'react';
import { X, Printer, FileText, Download, Hash, Calendar, User } from 'lucide-react';
import { Order, Voucher, User as UserType, VoucherStatus } from '../../../types';

interface DistributionEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  vouchers: Voucher[]; // Vouchers belonging to this order
  employees: UserType[]; // To resolve names
}

export const DistributionEvidenceModal: React.FC<DistributionEvidenceModalProps> = ({
  isOpen, onClose, order, vouchers, employees
}) => {
  if (!isOpen) return null;

  // --- LOGIC: Group vouchers by owner to create "Payroll Style" rows ---
  const distributionRows = useMemo(() => {
      const groups: Record<string, {
          user: UserType | undefined;
          count: number;
          vouchers: Voucher[];
      }> = {};

      // Only count distributed or active vouchers assigned to someone
      const relevantVouchers = vouchers.filter(v => v.ownerId);

      relevantVouchers.forEach(v => {
          if (!groups[v.ownerId!]) {
              groups[v.ownerId!] = {
                  user: employees.find(u => u.id === v.ownerId),
                  count: 0,
                  vouchers: []
              };
          }
          groups[v.ownerId!].count += v.value;
          groups[v.ownerId!].vouchers.push(v);
      });

      return Object.values(groups).map(group => {
          // Sort IDs to find ranges
          const sortedIds = group.vouchers.map(v => v.id).sort();
          const firstId = sortedIds[0]?.split('/').pop(); // Get just V-XXXX
          const lastId = sortedIds[sortedIds.length - 1]?.split('/').pop();
          
          return {
              userId: group.user?.id || 'UNKNOWN',
              name: group.user?.name || 'Nieznany / Usunięty',
              department: group.user?.department || group.user?.organization?.department || '-',
              amount: group.count,
              range: sortedIds.length > 1 ? `${firstId} ... ${lastId}` : firstId,
              date: group.vouchers[0].issueDate // Assume mostly same date for batch
          };
      }).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name
  }, [vouchers, employees]);

  const totalDistributed = distributionRows.reduce((acc, r) => acc + r.amount, 0);
  const remainingInPool = order.amount - totalDistributed;

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
            
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                        <FileText size={24} className="text-slate-700"/>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">Protokół Dystrybucji</h3>
                        <p className="text-xs text-slate-500">Dowód wydania środków dla Zamówienia: <span className="font-mono font-bold">{order.id}</span></p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handlePrint}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition flex items-center gap-2 text-sm shadow-sm"
                    >
                        <Printer size={16}/> Drukuj Listę
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition">
                        <X size={24}/>
                    </button>
                </div>
            </div>

            {/* Content (Printable Area) */}
            <div className="flex-1 overflow-y-auto p-8 bg-white" id="printable-evidence">
                
                {/* Print Header (Visible mostly on print) */}
                <div className="mb-8 text-center hidden print:block">
                    <h1 className="text-xl font-bold uppercase tracking-wider mb-2">Ewidencja Wydania Voucherów</h1>
                    <p className="text-sm text-slate-500">Załącznik do zamówienia nr {order.id} z dnia {new Date(order.date).toLocaleDateString()}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8 print:hidden">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <span className="text-xs font-bold text-slate-400 uppercase">Wartość Zamówienia</span>
                        <p className="text-2xl font-bold text-slate-800">{order.amount} pkt</p>
                    </div>
                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50">
                        <span className="text-xs font-bold text-emerald-600 uppercase">Wydano Pracownikom</span>
                        <p className="text-2xl font-bold text-emerald-700">{totalDistributed} pkt</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${remainingInPool > 0 ? 'border-amber-100 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                        <span className="text-xs font-bold text-slate-400 uppercase">Pozostało w Puli HR</span>
                        <p className={`text-2xl font-bold ${remainingInPool > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{remainingInPool} pkt</p>
                    </div>
                </div>

                {/* The Evidence Table */}
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-slate-600 border-y border-slate-200 print:bg-gray-100 print:text-black">
                            <th className="py-3 px-4 w-12 text-center">Lp.</th>
                            <th className="py-3 px-4">Pracownik (Beneficjent)</th>
                            <th className="py-3 px-4">Data Wydania</th>
                            <th className="py-3 px-4">Zakres Numerów (ID)</th>
                            <th className="py-3 px-4 text-right">Wartość</th>
                            <th className="py-3 px-4 w-32 text-center print:table-cell hidden">Podpis</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-800 divide-y divide-slate-100">
                        {distributionRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition print:break-inside-avoid">
                                <td className="py-3 px-4 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-3 px-4">
                                    <div className="font-bold text-slate-900">{row.name}</div>
                                    <div className="text-xs text-slate-500">{row.department}</div>
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                    {new Date(row.date).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-500">
                                    {row.range}
                                </td>
                                <td className="py-3 px-4 text-right font-bold">
                                    {row.amount} PLN
                                </td>
                                <td className="py-3 px-4 border-b border-slate-200 print:table-cell hidden">
                                    {/* Empty space for signature in print mode */}
                                </td>
                            </tr>
                        ))}
                        {distributionRows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                                    Nie rozdano jeszcze żadnych voucherów z tego zamówienia.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 font-bold bg-slate-50 print:bg-white">
                        <tr>
                            <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs tracking-wider">Razem wydano:</td>
                            <td className="py-3 px-4 text-right">{totalDistributed} PLN</td>
                            <td className="print:table-cell hidden"></td>
                        </tr>
                    </tfoot>
                </table>

                {/* Print Footer */}
                <div className="mt-12 hidden print:flex justify-between text-xs text-gray-500 pt-4 border-t border-gray-300">
                    <div>
                        Sporządził: System EBS<br/>
                        Data wydruku: {new Date().toLocaleDateString()}
                    </div>
                    <div className="text-right">
                        Podpis Osoby Upoważnionej (HR)<br/><br/>
                        ......................................................
                    </div>
                </div>
            </div>
        </div>
        <style>{`
            @media print {
                @page { margin: 1cm; size: landscape; }
                body * { visibility: hidden; }
                #printable-evidence, #printable-evidence * { visibility: visible; }
                #printable-evidence { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
                .no-print { display: none; }
            }
        `}</style>
    </div>
  );
};