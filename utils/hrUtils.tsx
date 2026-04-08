import React from 'react';
import { Clock, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Company } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type HRTab = 'ORDER' | 'HISTORY' | 'EMPLOYEES' | 'PAYMENTS' | 'BUYBACK';

export interface HrOrder {
  id: string;
  companyId: string;
  date: string;
  period: string; // YYYY-MM
  totalAmount: number;
  employeeCount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  invoiceNumber?: string;
  distributions: { employeeId: string; employeeName: string; pesel: string; amount: number }[];
  createdBy: string;
  umowaPdfUrl: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<HrOrder['status'], string> = {
  PENDING: 'Oczekuje', APPROVED: 'Do opłacenia', PAID: 'Opłacone', REJECTED: 'Odrzucone',
};

export const STATUS_MAP: Record<HrOrder['status'], { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: 'Oczekuje',      color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: <Clock size={13}/> },
  APPROVED: { label: 'Do opłacenia',  color: 'bg-rose-50 text-rose-700 border-rose-200',      icon: <AlertCircle size={13}/> },
  PAID:     { label: 'Opłacone',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13}/> },
  REJECTED: { label: 'Odrzucone',     color: 'bg-slate-50 text-slate-500 border-slate-200',   icon: <X size={13}/> },
};

// ─── Formatters ──────────────────────────────────────────────────────────────

export function formatPeriod(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-');
  const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Report Builder ──────────────────────────────────────────────────────────

export function buildOrderReportHtml(orders: HrOrder[], company: Company, title: string, subtitle: string): string {
  const allRows = orders.map(o => {
    const [y, m] = (o.period ?? '').split('-');
    const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const periodLabel = y && m ? `${months[parseInt(m,10)-1]} ${y}` : '—';
    const distRows = (o.distributions ?? []).map(d =>
      `<tr class="dist"><td></td><td style="padding-left:24px;color:#6b7280;font-size:11px">${d.employeeName}</td><td style="color:#6b7280;font-size:11px;font-family:monospace">${d.pesel ?? '—'}</td><td></td><td style="text-align:right;color:#6b7280;font-size:11px">${d.amount.toFixed(2)} zł</td><td></td></tr>`
    ).join('');
    return `
      <tr class="order-row">
        <td style="font-family:monospace;font-size:11px">${o.id}</td>
        <td>${new Date(o.date).toLocaleDateString('pl-PL')}</td>
        <td>${periodLabel}</td>
        <td style="font-family:monospace;font-size:11px">${o.invoiceNumber ?? '—'}</td>
        <td style="text-align:right;font-weight:700">${o.totalAmount.toFixed(2)} zł</td>
        <td style="text-align:center">${STATUS_LABELS[o.status] ?? o.status}</td>
      </tr>${distRows}`;
  }).join('');
  const total = orders.reduce((s, o) => s + o.totalAmount, 0);
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}
    h1{font-size:18px;margin-bottom:4px}
    .sub{color:#666;font-size:12px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#1e3a5f;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
    td{padding:7px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;vertical-align:top}
    tr.order-row td{background:#f8fafc;font-weight:500}
    tr.dist td{background:#fff}
    .total{margin-top:16px;text-align:right;font-size:14px;font-weight:700}
    .footer{margin-top:32px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>${title}</h1>
  <div class="sub">${subtitle}</div>
  <table>
    <thead><tr>
      <th>ID zamówienia</th><th>Data</th><th>Okres</th><th>Nr dokumentu</th>
      <th style="text-align:right">Kwota</th><th style="text-align:center">Status</th>
    </tr></thead>
    <tbody>${allRows}</tbody>
  </table>
  <div class="total">Łącznie: ${total.toFixed(2)} zł (${orders.length} zamówień)</div>
  <div class="footer">Raport wygenerowany przez EBS — Eliton Benefits System | ${company.name} | ${new Date().toLocaleDateString('pl-PL')}</div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;
}
