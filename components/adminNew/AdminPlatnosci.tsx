import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Building2, RefreshCw, AlertCircle, Loader2,
  Hash, CheckCircle2, Clock, FileText, Receipt, X, Download
} from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils/formatters';

// ── Typy ─────────────────────────────────────────────────────────────────────

interface Company {
  id:             string;
  name:           string;
  nip:            string;
  address_city:   string | null;
  balance_active: number;
}

interface FinancialDoc {
  id:                   string;
  orderId:              string;
  type:                 'nota' | 'faktura_vat';
  document_number:      string | null;
  amount_net:           number;
  vat_amount:           number;
  amount_gross:         number;
  order_status:         string;
  status:               'pending' | 'paid';
  issued_at:            string;
  payment_confirmed_at: string | null;
  external_payment_ref: string | null;
  pdf_url:              string | null;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const PaymentBadge: React.FC<{ status: 'pending' | 'paid' }> = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      status === 'paid'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-amber-100 text-amber-700'
    }`}
  >
    {status === 'paid' ? <CheckCircle2 size={9} /> : <Clock size={9} />}
    {status === 'paid' ? 'Opłacone' : 'Oczekuje'}
  </span>
);

// ── Financial docs panel ───────────────────────────────────────────────────────

const FinancialDocsPanel: React.FC<{ company: Company; onClose: () => void }> = ({
  company, onClose,
}) => {
  const [docs,    setDocs]    = useState<FinancialDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [busyId,  setBusyId]  = useState<string | null>(null);
  const [tab,     setTab]     = useState<'nota' | 'faktura_vat'>('nota');

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/financials`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDocs(await res.json());
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania dokumentów');
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const markPaid = async (docId: string) => {
    setBusyId(docId);
    try {
      const res = await fetch(`/api/companies/${company.id}/financials/${docId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'paid' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      fetchDocs();
    } catch (e: any) {
      alert(e.message ?? 'Błąd aktualizacji');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = docs.filter((d) => d.type === tab);

  const totalPending = filtered.filter((d) => d.status === 'pending').reduce((s, d) => s + d.amount_gross, 0);
  const totalPaid    = filtered.filter((d) => d.status === 'paid').reduce((s, d) => s + d.amount_gross, 0);

  return (
    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-xl overflow-hidden mt-4">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div>
          <h3 className="text-base font-bold">{company.name}</h3>
          <p className="text-blue-200 text-xs mt-0.5 flex items-center gap-1">
            <Hash size={10} />{company.nip}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
          <X size={16} />
        </button>
      </div>

      {/* Type tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setTab('nota')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
            tab === 'nota'
              ? 'border-b-2 border-blue-600 text-blue-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt size={14} />
          Noty księgowe
        </button>
        <button
          onClick={() => setTab('faktura_vat')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
            tab === 'faktura_vat'
              ? 'border-b-2 border-blue-600 text-blue-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText size={14} />
          Faktury VAT
        </button>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-6 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs">
        <span className="text-slate-500">
          Oczekuje: <strong className="text-amber-600">{formatCurrency(totalPending)}</strong>
        </span>
        <span className="text-slate-500">
          Opłacone: <strong className="text-blue-700">{formatCurrency(totalPaid)}</strong>
        </span>
        <button
          onClick={fetchDocs}
          className="ml-auto flex items-center gap-1 text-slate-400 hover:text-slate-700 transition"
        >
          <RefreshCw size={11} />
          Odśwież
        </button>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 m-4 p-3 bg-red-50 rounded-xl text-red-600 text-sm">
            <AlertCircle size={14} />{error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            Brak dokumentów tego typu
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {(tab === 'nota'
                  ? ['Data', 'Numer noty', 'Wartość', 'Status płatności', 'Potwierdzenie', 'PDF', 'Akcja']
                  : ['Data', 'Nr faktury', 'Netto', 'VAT', 'Brutto', 'Status', 'Potwierdzenie', 'PDF', 'Akcja']
                ).map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(doc.issued_at)}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{doc.document_number ?? '—'}</td>
                  {tab === 'faktura_vat' && (
                    <>
                      <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(doc.amount_net)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatCurrency(doc.vat_amount)}</td>
                    </>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                    {formatCurrency(doc.amount_gross)}
                  </td>
                  <td className="px-4 py-3"><PaymentBadge status={doc.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                    {doc.payment_confirmed_at ? formatDate(doc.payment_confirmed_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {doc.pdf_url ? (
                      <a
                        href={doc.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-semibold hover:bg-blue-100 transition"
                      >
                        <Download size={10} /> PDF
                      </a>
                    ) : (
                      <span className="text-slate-300 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {doc.status === 'pending' ? (
                      <button
                        onClick={() => markPaid(doc.id)}
                        disabled={busyId === doc.id}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                      >
                        {busyId === doc.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                        Oznacz jako opłacone
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Opłacone</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const AdminPlatnosci: React.FC = () => {
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<Company | null>(null);
  const [pendingSet,   setPendingSet]   = useState<Set<string>>(new Set());

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices/pending-companies');
      if (!res.ok) return;
      const ids: string[] = await res.json();
      setPendingSet(new Set(ids));
    } catch { /* cicho — wskaźnik opcjonalny */ }
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania firm');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); fetchPending(); }, [fetchCompanies, fetchPending]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.nip.includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj firmy..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchCompanies}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Odśwież
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Company list */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((company) => (
            <button
              key={company.id}
              onClick={() => setSelected(selected?.id === company.id ? null : company)}
              className={`text-left w-full p-4 rounded-2xl border shadow-sm transition group ${
                selected?.id === company.id
                  ? 'border-blue-400 bg-blue-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                    selected?.id === company.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                  }`}
                >
                  <Building2 size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{company.name}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Hash size={9} />{company.nip}
                  </p>
                  {pendingSet.has(company.id) && (
                    <p className="text-[10px] font-bold text-emerald-500 mt-1 animate-pulse">
                      ● Nie opłacone
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-3 bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Building2 size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm">Brak firm pasujących do wyszukiwania</p>
            </div>
          )}
        </div>
      )}

      {/* Financial panel for selected company */}
      {selected && (
        <FinancialDocsPanel
          key={selected.id}
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};
