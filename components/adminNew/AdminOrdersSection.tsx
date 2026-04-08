import React, { useState } from 'react';
import { Check, X, Ban, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils/formatters';

// ── Typy ─────────────────────────────────────────────────────────────────────

export interface AdminOrder {
  id:              string;
  company_id:      string;
  status:          'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled';
  amount_pln:      number;
  fee_pln:         number;
  total_pln:       number;
  amount_vouchers: number;
  doc_voucher_id:  string | null;
  doc_fee_id:      string | null;
  is_first_invoice: boolean;
  created_at:      string;
}

interface Props {
  orders:    AdminOrder[];
  companyId: string;
  onRefresh: () => void;
}

type OrderAction = 'approve' | 'pay' | 'reject';

// ── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: AdminOrder['status'] }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: 'Oczekuje',    cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Zatwierdzone', cls: 'bg-blue-100 text-blue-700' },
    paid:     { label: 'Opłacone',    cls: 'bg-blue-100 text-blue-700' },
    rejected: { label: 'Odrzucone',   cls: 'bg-red-100 text-red-600' },
    cancelled: { label: 'Anulowane', cls: 'bg-slate-100 text-slate-500' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const AdminOrdersSection: React.FC<Props> = ({ orders, companyId: _, onRefresh }) => {
  const [busyId,   setBusyId]   = useState<string | null>(null);
  const [errorId,  setErrorId]  = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const doAction = async (orderId: string, action: OrderAction) => {
    if (
      action === 'reject' &&
      !confirm('Czy na pewno odrzucić to zamówienie?')
    ) return;

    setBusyId(orderId);
    setErrorId(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const d = await res.json();
        setErrorId(orderId);
        setErrorMsg(d.error ?? `Błąd HTTP ${res.status}`);
        return;
      }
      onRefresh();
    } catch (e: any) {
      setErrorId(orderId);
      setErrorMsg(e.message ?? 'Błąd sieciowy');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition"
        >
          Zamówienia
          <span className="text-xs text-slate-400 font-normal">({orders.length})</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          {orders.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Brak zamówień</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Data', 'Numer noty', 'Nr faktury', 'Vouchery', 'Wartość', 'Opłata', 'Razem', 'Status', 'Akcje'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-slate-500 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.map((order) => {
                  const isBusy = busyId === order.id;
                  const hasErr = errorId === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <tr className="hover:bg-slate-50/50 transition">
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDate(order.created_at)}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">{order.doc_voucher_id ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">{order.doc_fee_id ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-700 font-medium">{order.amount_vouchers.toLocaleString('pl-PL')}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatCurrency(order.amount_pln)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatCurrency(order.fee_pln)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">{formatCurrency(order.total_pln)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={order.status} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {order.status === 'pending' && (
                              <>
                                <button
                                  disabled={isBusy}
                                  onClick={() => doAction(order.id, 'approve')}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition disabled:opacity-40"
                                  title="Zatwierdź i emituj vouchery"
                                >
                                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() => doAction(order.id, 'reject')}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-40"
                                  title="Odrzuć zamówienie"
                                >
                                  <Ban size={12} />
                                </button>
                              </>
                            )}
                            {order.status === 'approved' && (
                              <button
                                disabled={isBusy}
                                onClick={() => doAction(order.id, 'pay')}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-semibold hover:bg-blue-700 transition disabled:opacity-40"
                                title="Potwierdź płatność i nalicz prowizje"
                              >
                                {isBusy ? <Loader2 size={10} className="animate-spin" /> : null}
                                Opłać
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {hasErr && (
                        <tr>
                          <td colSpan={9} className="px-3 py-1.5 bg-red-50">
                            <div className="flex items-center gap-1.5 text-red-600 text-[11px]">
                              <AlertCircle size={11} />
                              {errorMsg}
                              <button
                                onClick={() => { setErrorId(null); setErrorMsg(null); }}
                                className="ml-auto text-red-400 hover:text-red-600"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
