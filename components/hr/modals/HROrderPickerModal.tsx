import React, { useState } from 'react';
import { FileText, X, Printer } from 'lucide-react';
import { Company } from '@/types';
import { HrOrder, STATUS_MAP, buildOrderReportHtml } from '@/utils/hrUtils';

interface HROrderPickerModalProps {
  orders: HrOrder[];
  company: Company;
  onClose: () => void;
}

export function HROrderPickerModal({ orders, company, onClose }: HROrderPickerModalProps) {
  const [selectedId, setSelectedId] = useState<string>(orders[0]?.id ?? '');

  const handleGenerate = () => {
    const order = orders.find(o => o.id === selectedId);
    if (!order) return;
    const [y, m] = (order.period ?? '').split('-');
    const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const periodLabel = y && m ? `${months[parseInt(m,10)-1]} ${y}` : '';
    const html = buildOrderReportHtml(
      [order],
      company,
      `Raport zamówienia ${order.id}`,
      `Firma: ${company.name} | Okres: ${periodLabel} | Data: ${new Date(order.date).toLocaleDateString('pl-PL')} | Nr dok.: ${order.invoiceNumber ?? '—'}`
    );
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <FileText size={16} className="text-indigo-600"/> Wybierz zamówienie do raportu
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18}/></button>
        </div>

        <div className="px-6 py-4 space-y-2 max-h-96 overflow-y-auto">
          {orders.map(o => {
            const [y, m] = (o.period ?? '').split('-');
            const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
            const periodLabel = y && m ? `${months[parseInt(m,10)-1]} ${y}` : '—';
            const st = STATUS_MAP[o.status];
            const isSelected = selectedId === o.id;
            return (
              <div
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-gray-800">{o.id}</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full border ${st.color}`}>
                      {st.label}
                    </span>
                    <span className="text-xs text-gray-400">{periodLabel}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{o.invoiceNumber ?? ''} · {o.employeeCount} pracowników</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-sm text-gray-900">{o.totalAmount.toFixed(2)} zł</span>
                  <p className="text-xs text-gray-400">{new Date(o.date).toLocaleDateString('pl-PL')}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded hover:bg-gray-100">Anuluj</button>
          <button
            onClick={handleGenerate}
            disabled={!selectedId}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            <Printer size={13}/> Generuj PDF
          </button>
        </div>
      </div>
    </div>
  );
}
