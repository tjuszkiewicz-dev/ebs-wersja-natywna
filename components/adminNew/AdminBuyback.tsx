'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, ChevronDown, ChevronUp, Download, Loader2,
  CheckCircle2, AlertCircle, Building2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  nip?: string | null;
};

type ExpiredEmployee = {
  employeeId: string;
  fullName: string;
  count: number;
};

type BatchItem = {
  id: string;
  full_name: string;
  iban: string;
  voucher_count: number;
  amount_pln: number;
};

type BuybackBatch = {
  id: string;
  period_label: string;
  total_amount: number;
  voucher_count: number;
  status: string;
  created_at: string;
  buyback_batch_items?: BatchItem[];
};

type CompanyData = {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  expiredEmployees: ExpiredEmployee[];
  batches: BuybackBatch[];
  generating: boolean;
  genError: string | null;
  genSuccess: string | null;
};

const EMPTY: CompanyData = {
  loaded: false, loading: false, error: null,
  expiredEmployees: [], batches: [],
  generating: false, genError: null, genSuccess: null,
};

// ── Component ────────────────────────────────────────────────────────────────

export function AdminBuyback() {
  const [companies, setCompanies]       = useState<Company[]>([]);
  const [listLoading, setListLoading]   = useState(true);
  const [listError, setListError]       = useState<string | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [companyData, setCompanyData]   = useState<Record<string, CompanyData>>({});
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // helper
  const update = useCallback((id: string, patch: Partial<CompanyData>) =>
    setCompanyData(prev => ({ ...prev, [id]: { ...EMPTY, ...prev[id], ...patch } }))
  , []);

  // ── Fetch company list ────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setListError(e.message ?? 'Błąd pobierania firm');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // ── Fetch data for one company ────────────────────────────────────────────

  const fetchCompanyData = useCallback(async (companyId: string) => {
    update(companyId, { loading: true, error: null });
    try {
      const [expRes, batchRes] = await Promise.all([
        fetch(`/api/companies/${companyId}/expired-vouchers`),
        fetch(`/api/companies/${companyId}/buyback-batches`),
      ]);
      const expiredEmployees: ExpiredEmployee[] = expRes.ok ? await expRes.json() : [];
      const batches: BuybackBatch[] = batchRes.ok ? await batchRes.json() : [];
      update(companyId, {
        loaded: true, loading: false, error: null,
        expiredEmployees: Array.isArray(expiredEmployees) ? expiredEmployees : [],
        batches: Array.isArray(batches) ? batches : [],
      });
    } catch (e: any) {
      update(companyId, { loading: false, error: e.message ?? 'Błąd' });
    }
  }, [update]);

  // ── Toggle expand ─────────────────────────────────────────────────────────

  const handleToggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const state = companyData[id];
    if (!state?.loaded && !state?.loading) {
      fetchCompanyData(id);
    }
  };

  // ── Generate batch ────────────────────────────────────────────────────────

  const handleGenerateBatch = useCallback(async (companyId: string) => {
    update(companyId, { generating: true, genError: null, genSuccess: null });
    try {
      const res = await fetch(`/api/companies/${companyId}/buyback-batches`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      if (d.csv) {
        const blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), {
          href: url,
          download: `odkup_${d.periodLabel ?? 'batch'}.csv`,
        });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }
      update(companyId, {
        generating: false,
        genSuccess: `Paczka wygenerowana: ${d.voucherCount} voucherów, ${d.totalAmount?.toFixed(2)} PLN.`,
      });
      // refresh data for this company
      fetchCompanyData(companyId);
    } catch (e: any) {
      update(companyId, { generating: false, genError: e.message ?? 'Błąd generowania' });
    }
  }, [update, fetchCompanyData]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Anulowanie subskrypcji — odkup voucherów</h2>
            <p className="text-sm text-gray-500 mt-1">
              Pracownicy, których vouchery wygasły i nie zostały przedłużone, mogą otrzymać wypłatę gotówkową (1 voucher = 1 PLN).
              Kliknij firmę, aby zobaczyć listę pracowników i wygenerować paczkę przelewów.
            </p>
          </div>
          <button
            onClick={fetchCompanies}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
          >
            <RefreshCw size={13} /> Odśwież
          </button>
        </div>
      </div>

      {/* Companies list */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin text-blue-500" />
          <span className="text-sm">Pobieranie listy firm…</span>
        </div>
      ) : listError ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{listError}</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">Brak firm w bazie.</div>
      ) : (
        <div className="space-y-2">
          {companies.map(company => {
            const state    = companyData[company.id] ?? EMPTY;
            const isOpen   = expandedId === company.id;
            const pending  = state.expiredEmployees.length;
            const total    = state.expiredEmployees.reduce((s, e) => s + e.count, 0);
            const hasPending = pending > 0;

            return (
              <div
                key={company.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Company row */}
                <button
                  type="button"
                  onClick={() => handleToggle(company.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 size={16} className="text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{company.name}</p>
                      {company.nip && (
                        <p className="text-xs text-gray-400 font-mono">NIP: {company.nip}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {isOpen && state.loaded && (
                      hasPending ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-full">
                          {total} voucherów · {pending} prac.
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-medium rounded-full">
                          Brak przeterminowanych
                        </span>
                      )
                    )}
                    {state.loading && <Loader2 size={14} className="animate-spin text-blue-500" />}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">

                    {state.loading && (
                      <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin text-blue-500" />
                        Pobieranie danych…
                      </div>
                    )}

                    {state.error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-700">{state.error}</p>
                      </div>
                    )}

                    {state.loaded && !state.loading && (
                      <>
                        {/* Feedback messages */}
                        {state.genSuccess && (
                          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                            <p className="text-sm text-green-700">{state.genSuccess}</p>
                          </div>
                        )}
                        {state.genError && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                            <p className="text-sm text-red-700">{state.genError}</p>
                          </div>
                        )}

                        {/* Employees with expired vouchers */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Pracownicy z przeterminowanymi voucherami
                            </p>
                            {hasPending && (
                              <button
                                onClick={() => handleGenerateBatch(company.id)}
                                disabled={state.generating}
                                className="flex items-center gap-2 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-blue-700 transition-colors disabled:opacity-60"
                              >
                                {state.generating
                                  ? <><Loader2 size={12} className="animate-spin" /> Generuję…</>
                                  : <><Download size={12} /> Wygeneruj paczkę przelewów</>
                                }
                              </button>
                            )}
                          </div>

                          {state.expiredEmployees.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">
                              Brak pracowników z przeterminowanymi voucherami.
                            </p>
                          ) : (
                            <div className="rounded-lg overflow-hidden border border-gray-200">
                              <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                  <tr style={{ background: '#1e3a5f' }}>
                                    {['LP', 'Imię i nazwisko', 'Vouchery po terminie'].map((h, i) => (
                                      <th key={i} style={{
                                        padding: '8px 12px', color: '#fff', fontWeight: 600,
                                        fontSize: 11, textAlign: i === 0 ? 'center' : i === 2 ? 'right' : 'left',
                                        whiteSpace: 'nowrap', width: i === 0 ? 44 : undefined,
                                      }}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {state.expiredEmployees.map((emp, idx) => (
                                    <tr key={emp.employeeId} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                      <td style={{ padding: '7px 12px', textAlign: 'center', color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>
                                        {idx + 1}
                                      </td>
                                      <td style={{ padding: '7px 12px', fontWeight: 500, color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                                        {emp.fullName}
                                      </td>
                                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#b45309', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                                        {emp.count} szt.
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Batch history */}
                        {state.batches.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                              Historia wygenerowanych paczek
                            </p>
                            <div className="space-y-2">
                              {state.batches.map(batch => {
                                const isBatchOpen = expandedBatch === batch.id;
                                return (
                                  <div key={batch.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedBatch(isBatchOpen ? null : batch.id)}
                                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                      <div className="flex items-center gap-3 text-sm">
                                        <span className="font-medium text-gray-800">{batch.period_label}</span>
                                        <span className="text-gray-400 text-xs">·</span>
                                        <span className="text-xs text-gray-500">
                                          {batch.voucher_count} voucherów · {batch.total_amount?.toFixed(2)} PLN
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-400">
                                          {new Date(batch.created_at).toLocaleDateString('pl-PL')}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                          batch.status === 'COMPLETE'
                                            ? 'bg-green-50 text-green-700 border border-green-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                          {batch.status === 'COMPLETE' ? 'Zakończona' : batch.status}
                                        </span>
                                        {isBatchOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                      </div>
                                    </button>

                                    {isBatchOpen && batch.buyback_batch_items && batch.buyback_batch_items.length > 0 && (
                                      <div className="border-t border-gray-100 overflow-x-auto">
                                        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                                          <thead>
                                            <tr style={{ background: '#f8fafc' }}>
                                              {['Pracownik', 'IBAN', 'Vouchery', 'Kwota'].map((h, i) => (
                                                <th key={i} style={{
                                                  padding: '6px 12px', color: '#6b7280', fontWeight: 600,
                                                  fontSize: 10, textAlign: i >= 2 ? 'right' : 'left',
                                                  borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
                                                }}>
                                                  {h}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {batch.buyback_batch_items.map((item, i) => (
                                              <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                                <td style={{ padding: '6px 12px', color: '#111827', fontWeight: 500, borderBottom: '1px solid #f3f4f6' }}>
                                                  {item.full_name}
                                                </td>
                                                <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#6b7280', fontSize: 11, borderBottom: '1px solid #f3f4f6' }}>
                                                  {item.iban || '—'}
                                                </td>
                                                <td style={{ padding: '6px 12px', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                                                  {item.voucher_count}
                                                </td>
                                                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#1d4ed8', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                                                  {item.amount_pln?.toFixed(2)} PLN
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
