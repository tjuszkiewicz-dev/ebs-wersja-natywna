import React, { useMemo } from 'react';
import { X, History, Printer } from 'lucide-react';
import { User, Company } from '@/types';
import { HrOrder, STATUS_MAP, formatPeriod } from '@/utils/hrUtils';
import { formatCurrency } from '@/utils/formatters';

interface HROrderHistoryModalProps {
  employee: User;
  hrOrders: HrOrder[];
  company: Company;
  onClose: () => void;
}

export function HROrderHistoryModal({ employee, hrOrders, company, onClose }: HROrderHistoryModalProps) {
  const empOrders = useMemo(() => {
    return hrOrders
      .filter(o =>
        o.distributions?.some(d =>
          d.employeeId === employee.id ||
          (d.pesel && employee.pesel && d.pesel === employee.pesel) ||
          (d.employeeName && d.employeeName === employee.name)
        )
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [hrOrders, employee]);

  const totalReceived = useMemo(() =>
    empOrders.reduce((s, o) => {
      const dist = o.distributions?.find(d =>
        d.employeeId === employee.id ||
        (d.pesel && employee.pesel && d.pesel === employee.pesel)
      );
      return s + (dist?.amount ?? 0);
    }, 0),
  [empOrders, employee]);

  const handlePrintPdf = () => {
    const statusLabel = (s: HrOrder['status']) =>
      s === 'PAID' ? 'Opłacone' : s === 'APPROVED' ? 'Do opłacenia' : s === 'PENDING' ? 'Oczekuje' : 'Odrzucone';

    const rows = empOrders.map(o => {
      const dist = o.distributions?.find(d =>
        d.employeeId === employee.id ||
        (d.pesel && employee.pesel && d.pesel === employee.pesel)
      );
      const amount = dist?.amount ?? 0;
      return `
        <tr>
          <td>${new Date(o.date).toLocaleDateString('pl-PL')}</td>
          <td>${o.period ? (() => { const [y,m] = o.period.split('-'); const months=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']; return `${months[parseInt(m,10)-1]} ${y}`; })() : '—'}</td>
          <td>${o.invoiceNumber ?? o.id}</td>
          <td style="text-align:right;font-weight:700">${amount.toFixed(2)} zł</td>
          <td style="text-align:center">${statusLabel(o.status)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/>
    <title>Historia voucherów — ${employee.name}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}
      h1{font-size:18px;margin-bottom:4px}
      .sub{color:#666;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e3a5f;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      td{padding:7px 12px;border-bottom:1px solid #e5e7eb;font-size:12px}
      tr:nth-child(even) td{background:#f9fafb}
      .total{margin-top:16px;text-align:right;font-size:14px;font-weight:700}
      .footer{margin-top:32px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>Historia zamówień voucherów</h1>
    <div class="sub">
      Pracownik: <strong>${employee.name}</strong> &nbsp;|&nbsp;
      ${employee.pesel ? `PESEL: <strong>${employee.pesel}</strong> &nbsp;|&nbsp;` : ''}
      Firma: <strong>${company.name}</strong> &nbsp;|&nbsp;
      Wygenerowano: <strong>${new Date().toLocaleDateString('pl-PL')}</strong>
    </div>
    <table>
      <thead><tr>
        <th>Data zamówienia</th><th>Okres</th><th>Nr dokumentu</th>
        <th style="text-align:right">Kwota voucherów</th><th style="text-align:center">Status</th>
      </tr></thead>
      <tbody>${rows.length ? rows : '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">Brak zamówień dla tego pracownika</td></tr>'}</tbody>
    </table>
    <div class="total">Łącznie otrzymanych voucherów: ${totalReceived.toFixed(2)} zł</div>
    <div class="footer">Raport wygenerowany przez system EBS — Eliton Benefits System | ${company.name} | NIP: ${(company as any).nip ?? ''}</div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const st = (s: HrOrder['status']) => STATUS_MAP[s] ?? STATUS_MAP.PENDING;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <History size={16} className="text-indigo-600"/> Historia voucherów — {employee.name}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {employee.pesel ? `PESEL: ${employee.pesel} · ` : ''}{empOrders.length} zamówień · łącznie {totalReceived.toFixed(2)} zł
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-2 bg-indigo-600 text-white text-xs font-medium px-4 py-2 rounded hover:bg-indigo-700 transition-colors">
              <Printer size={13}/> Pobierz raport PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {empOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History size={32} className="text-gray-200 mb-3"/>
              <p className="text-gray-500 font-medium text-sm">Brak historii zamówień</p>
              <p className="text-gray-400 text-xs mt-1">Ten pracownik nie był jeszcze uwzględniony w żadnym zamówieniu</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: '#1e3a5f' }}>
                <tr>
                  {['Data', 'Okres', 'Nr dokumentu', 'Kwota voucherów', 'Status'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Kwota voucherów' ? 'right' : h === 'Status' ? 'center' : 'left', color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empOrders.map((order, idx) => {
                  const dist = order.distributions?.find(d =>
                    d.employeeId === employee.id ||
                    (d.pesel && employee.pesel && d.pesel === employee.pesel)
                  );
                  const amount = dist?.amount ?? 0;
                  const s = st(order.status);
                  return (
                    <tr key={order.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '8px 14px', color: '#374151', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                        {new Date(order.date).toLocaleDateString('pl-PL')}
                      </td>
                      <td style={{ padding: '8px 14px', color: '#6b7280', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                        {formatPeriod(order.period)}
                      </td>
                      <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                        {order.invoiceNumber ?? order.id}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#111827', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                        {formatCurrency(amount)}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${s.color}`}>
                          {s.icon} {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer summary */}
        {empOrders.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">{empOrders.length} zamówień</span>
            <span className="text-sm font-bold text-gray-900">
              Łącznie: {formatCurrency(totalReceived)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
