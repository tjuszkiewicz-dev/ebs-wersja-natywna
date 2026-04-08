import React, { useMemo } from 'react';
import {
  X, Mail, Info, MapPin, CreditCard, UserX, CheckCircle2,
} from 'lucide-react';
import { User } from '@/types';
import { HrOrder, formatPeriod } from '@/utils/hrUtils';
import { formatCurrency, formatDate } from '@/utils/formatters';

// ─── EmpDetailRow ────────────────────────────────────────────────────────────

export const EmpDetailRow: React.FC<{ label: string; value?: string | null; mono?: boolean; small?: boolean }> = ({
  label, value, mono, small
}) => (
  <div className="flex items-start gap-1.5 mb-1.5 last:mb-0">
    <span className="shrink-0 text-gray-400" style={{ fontSize: 10, minWidth: 72 }}>{label}:</span>
    <span className={`break-all ${mono ? 'font-mono' : ''}`} style={{ fontSize: small ? 9 : 11, color: value ? '#374151' : '#d1d5db' }}>
      {value || '—'}
    </span>
  </div>
);

// ─── EmployeeCard ─────────────────────────────────────────────────────────────

interface EmployeeCardProps {
  employee: User;
  hrOrders: HrOrder[];
  onDeactivate: (id: string) => void;
  onActivate: (id: string) => void;
  onClose: () => void;
  isAdmin: boolean;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee, hrOrders, onDeactivate, onActivate, onClose, isAdmin
}) => {
  const isActive = employee.status === 'ACTIVE';

  const distributions = useMemo(() => {
    const result: { orderId: string; date: string; amount: number; period: string }[] = [];
    hrOrders.forEach(o => {
      o.distributions.forEach(d => {
        if (d.employeeId === employee.id) {
          result.push({ orderId: o.id, date: o.date, amount: d.amount, period: o.period });
        }
      });
    });
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [hrOrders, employee.id]);

  const totalAssigned = useMemo(() => distributions.reduce((s, d) => s + d.amount, 0), [distributions]);
  const balance = employee.voucherBalance ?? (employee as any).finance?.voucherBalance ?? 0;

  return (
    <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden self-start sticky top-4">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-base">{employee.name}</p>
            <p className="text-xs text-gray-300 mt-0.5">{employee.position || (employee as any).organization?.position || 'Pracownik'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white mt-0.5">
            <X size={16}/>
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            isActive ? 'bg-emerald-500 text-white' : 'bg-gray-600 text-gray-300'
          }`}>
            {isActive ? 'Aktywny' : 'Nieaktywny'}
          </span>
          <span className="text-xs text-gray-400">{employee.department || '—'}</span>
        </div>
      </div>

      <div className="p-4 space-y-4 text-sm max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Balance */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-center">
          <p className="text-xs text-blue-600 font-medium mb-0.5">Aktualne saldo voucherów</p>
          <p className="text-2xl font-bold text-blue-800">{formatCurrency(balance)}</p>
        </div>

        {/* Basic info */}
        <div className="space-y-2">
          {employee.email && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Mail size={13} className="text-gray-400 shrink-0"/>
              <span className="truncate">{employee.email}</span>
            </div>
          )}
          {(employee.pesel || (employee as any).identity?.pesel) && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Info size={13} className="text-gray-400 shrink-0"/>
              <span className="font-mono">PESEL: {employee.pesel || (employee as any).identity?.pesel}</span>
            </div>
          )}
          {((employee as any).address?.city || (employee as any).address?.street) && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapPin size={13} className="text-gray-400 shrink-0"/>
              <span>
                {[(employee as any).address?.street, (employee as any).address?.postalCode, (employee as any).address?.city]
                  .filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {(employee as any).finance?.payoutAccount?.iban && (
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <CreditCard size={13} className="text-gray-400 shrink-0 mt-0.5"/>
              <span className="font-mono break-all">{(employee as any).finance.payoutAccount.iban}</span>
            </div>
          )}
        </div>

        {/* Distribution history */}
        {distributions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Historia przydziałów ({distributions.length})
            </p>
            <div className="space-y-1.5">
              {distributions.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{formatPeriod(d.period)}</p>
                    <p className="text-xs text-gray-400">{formatDate(d.date)}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700">+{formatCurrency(d.amount)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-right">
              Łącznie przydzielono: <strong className="text-gray-600">{formatCurrency(totalAssigned)}</strong>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-1 border-t border-gray-100 space-y-2">
          {isActive ? (
            <button
              onClick={() => onDeactivate(employee.id)}
              className="w-full flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-3 py-2 rounded transition-colors font-medium"
            >
              <UserX size={13}/> Dezaktywuj pracownika
            </button>
          ) : (
            <button
              onClick={() => onActivate(employee.id)}
              className="w-full flex items-center justify-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-2 rounded transition-colors font-medium"
            >
              <CheckCircle2 size={13}/> Reaktywuj pracownika
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
