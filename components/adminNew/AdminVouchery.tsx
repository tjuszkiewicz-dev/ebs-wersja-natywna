'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket, Search, RefreshCw, Plus, Loader2, AlertCircle,
  CheckCircle2, X, ChevronDown, ChevronRight, Building2, User, Hash,
  Clock, Layers, BookOpen, Archive,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface EmployeeNode {
  id:        string;
  full_name: string;
  role:      string;
  total:     number;
  active:    number;
  consumed:  number;
  expired:   number;
}

interface CompanyNode {
  id:        string;
  name:      string;
  nip:       string;
  total:     number;   // active vouchers (non-consumed/expired)
  pool:      number;   // in HR pool, not yet distributed to employees
  pending:   number;   // in poczekalni (pending/approved unpaid orders)
  employees: EmployeeNode[];
}

interface VoucherItem {
  id:                   string;
  serial_number:        string;
  face_value_pln:       number;
  status:               string;
  issued_at:            string;
  valid_until:          string;
  redeemed_at:          string | null;
  buyback_agreement_id: string | null;
}

interface HistoryItem {
  batch_id:       string;
  order_id:       string | null;
  company_id:     string;
  amount:         number;
  distributed_at: string;
  hr_name:        string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  created:          'Nieprzyznany',
  reserved:         'Zarezerwowany',
  active:           'Aktywny',
  distributed:      'Przyznany',
  consumed:         'Zuzity',
  expired:          'Wygasly',
  buyback_pending:  'Odkup w toku',
  buyback_complete: 'Odkupiony',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  created:          { bg: '#f8fafc', text: '#94a3b8', border: '#e2e8f0' },
  reserved:         { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' },
  active:           { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  distributed:      { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  consumed:         { bg: '#1e293b', text: '#cbd5e1', border: '#334155' },
  expired:          { bg: '#fff7ed', text: '#b45309', border: '#fed7aa' },
  buyback_pending:  { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },
  buyback_complete: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
};

function StatusBadge({ status }: { status: string }) {
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.created;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 10,
      fontWeight: 600, padding: '2px 8px', borderRadius: 999,
      background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── HistoryModal ─────────────────────────────────────────────────────────────

function HistoryModal({ emp, onClose }: { emp: EmployeeNode | null; onClose: () => void }) {
  const [history,  setHistory]  = useState<HistoryItem[] | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!emp) return;
    setHistory(null);
    setLoading(true);
    fetch(`/api/admin/vouchers/employee-history?userId=${emp.id}`)
      .then(r => r.json())
      .then(d => setHistory(d.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [emp?.id]);

  if (!emp) return null;

  const total = history?.reduce((s, h) => s + h.amount, 0) ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Historia voucherow</h3>
            <p className="text-sm text-gray-400 mt-0.5">{emp.full_name || 'Nieznany pracownik'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-blue-400" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Archive size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Brak historii przydzialow</p>
            </div>
          ) : (
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Data przydzialu</th>
                  <th className="px-5 py-3 text-right font-semibold">Ilosc</th>
                  <th className="px-5 py-3 text-left font-semibold">ID zamowienia</th>
                  <th className="px-5 py-3 text-left font-semibold">HR</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.batch_id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td className="px-5 py-3 text-gray-700 text-sm">{fmt(h.distributed_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-bold text-blue-700 font-mono text-base">{h.amount.toLocaleString('pl-PL')}</span>
                      <span className="text-gray-400 ml-1 text-xs">pkt</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{h.order_id?.slice(-8) ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-sm">{h.hr_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {history && history.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50">
            <span className="text-xs text-gray-500">
              Laczna liczba przydzialow: <strong>{history.length}</strong>
            </span>
            <span className="text-sm font-bold text-blue-700">
              {total.toLocaleString('pl-PL')} pkt lacznie
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EmployeeRow ───────────────────────────────────────────────────────────────

function EmployeeRow({
  emp,
  companyId,
  search,
  onHistory,
}: {
  emp:       EmployeeNode;
  companyId: string;
  search:    string;
  onHistory: (emp: EmployeeNode) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [vouchers, setVouchers] = useState<VoucherItem[] | null>(null);
  const [loadingV, setLoadingV] = useState(false);

  const handleExpand = async () => {
    const next = !open;
    setOpen(next);
    if (next && vouchers === null) {
      setLoadingV(true);
      try {
        const res = await fetch(`/api/admin/vouchers/employee-vouchers?userId=${emp.id}&companyId=${companyId}`);
        const d   = await res.json();
        setVouchers(d.vouchers ?? []);
      } catch { setVouchers([]); }
      finally  { setLoadingV(false); }
    }
  };

  const filtered = search && vouchers
    ? vouchers.filter(v => v.serial_number.toLowerCase().includes(search.toLowerCase()))
    : (vouchers ?? []);

  if (search && !emp.full_name.toLowerCase().includes(search.toLowerCase()) && filtered.length === 0 && !open) {
    return null;
  }

  return (
    <>
      {/* Employee summary */}
      <tr
        onClick={handleExpand}
        className="cursor-pointer hover:bg-blue-50 transition-colors"
        style={{ background: open ? '#f0f7ff' : '#f8fafc' }}
      >
        <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', width: 28 }} />
        <td colSpan={5} style={{ padding: '7px 14px', border: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-2 flex-wrap">
            {open
              ? <ChevronDown  size={13} className="text-blue-500 shrink-0" />
              : <ChevronRight size={13} className="text-gray-400 shrink-0" />
            }
            <User size={13} className="text-blue-400 shrink-0" />
            <span className="text-sm font-medium text-gray-800">
              {emp.full_name || <span className="text-gray-400 italic">Nieznany</span>}
            </span>
            <span className="text-xs text-gray-400">(pracownik)</span>

            {/* Stat chips */}
            {emp.active > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 ml-1">
                {emp.active.toLocaleString('pl-PL')} aktywnych
              </span>
            )}
            {emp.consumed > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                {emp.consumed.toLocaleString('pl-PL')} zuzytych
              </span>
            )}
            {emp.expired > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600">
                {emp.expired.toLocaleString('pl-PL')} wygaslych
              </span>
            )}

            <button
              onClick={e => { e.stopPropagation(); onHistory(emp); }}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-xs text-blue-500 hover:bg-blue-100 transition"
            >
              <BookOpen size={11} /> Historia
            </button>
          </div>
        </td>
        <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
          <span className="text-xs font-mono text-gray-400">{emp.total.toLocaleString('pl-PL')} szt.</span>
        </td>
      </tr>

      {/* Loading */}
      {open && loadingV && (
        <tr><td colSpan={7} style={{ padding: '12px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <Loader2 size={15} className="inline animate-spin text-blue-400" />
        </td></tr>
      )}

      {/* Individual vouchers */}
      {open && !loadingV && vouchers !== null && filtered.map((v, vi) => (
        <tr key={v.id} style={{ background: vi % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
          <td style={{ padding: '5px 10px', border: '1px solid #e5e7eb', width: 28 }} />
          <td style={{ padding: '5px 10px', border: '1px solid #e5e7eb', paddingLeft: 48 }}>
            <div className="flex items-center gap-1.5">
              <Hash size={10} className="text-gray-300 shrink-0" />
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#111827' }}>{v.serial_number}</span>
            </div>
          </td>
          <td style={{ padding: '5px 10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.face_value_pln} PLN</span>
          </td>
          <td style={{ padding: '5px 8px', border: '1px solid #e5e7eb' }}>
            <StatusBadge status={v.status} />
          </td>
          <td style={{ padding: '5px 10px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 11 }}>
            {fmt(v.issued_at)}
          </td>
          <td style={{
            padding: '5px 10px', border: '1px solid #e5e7eb', fontSize: 11, whiteSpace: 'nowrap',
            color: v.status === 'expired' ? '#b45309' : '#6b7280',
            fontWeight: v.status === 'expired' ? 600 : 400,
          }}>
            {fmt(v.valid_until)}
          </td>
          <td style={{ padding: '5px 10px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 11 }}>
            {v.redeemed_at ? fmt(v.redeemed_at) : '—'}
            {v.buyback_agreement_id && (
              <span className="ml-1 text-[10px] text-emerald-600 font-semibold">odkup</span>
            )}
          </td>
        </tr>
      ))}

      {open && !loadingV && vouchers !== null && filtered.length === 0 && (
        <tr><td colSpan={7} style={{ padding: '10px 48px', border: '1px solid #e5e7eb', color: '#9ca3af', fontSize: 12 }}>
          Brak voucherow pasujacych do wyszukiwania.
        </td></tr>
      )}
    </>
  );
}

// ── CompanyRow ────────────────────────────────────────────────────────────────

function CompanyRow({
  company,
  search,
  onHistory,
}: {
  company:   CompanyNode;
  search:    string;
  onHistory: (emp: EmployeeNode) => void;
}) {
  const [open, setOpen] = useState(false);

  const matchingEmployees = search
    ? company.employees?.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase())) ?? []
    : (company.employees ?? []);

  useEffect(() => {
    if (search && matchingEmployees.length > 0) setOpen(true);
    if (!search) setOpen(false);
  }, [search, matchingEmployees.length]);

  if (search && matchingEmployees.length === 0) return null;

  return (
    <>
      {/* Company row */}
      <tr
        onClick={() => setOpen(o => !o)}
        className="cursor-pointer hover:bg-slate-100 transition-colors"
        style={{ background: open ? '#eef6ff' : '#f8fbff' }}
      >
        <td style={{ padding: '9px 10px', border: '1px solid #cbd5e1', textAlign: 'center', width: 28 }}>
          {open
            ? <ChevronDown  size={14} className="text-blue-600 mx-auto" />
            : <ChevronRight size={14} className="text-gray-500 mx-auto" />
          }
        </td>
        <td colSpan={5} style={{ padding: '9px 14px', border: '1px solid #cbd5e1' }}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Building2 size={15} className="text-slate-600 shrink-0" />
            <span className="font-semibold text-sm text-slate-800">{company.name}</span>
            {company.nip && <span className="text-xs text-gray-400">NIP {company.nip}</span>}

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {company.pending > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                  <Clock size={10} />
                  {company.pending.toLocaleString('pl-PL')} w poczekalni
                </span>
              )}
              {company.pool > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                  <Layers size={10} />
                  {company.pool.toLocaleString('pl-PL')} pula HR
                </span>
              )}
              <span className="text-xs text-gray-500">
                {(matchingEmployees?.length ?? 0)} prac.
              </span>
              <span className="text-sm font-bold text-blue-600 font-mono">
                {company.total.toLocaleString('pl-PL')} aktywnych
              </span>
            </div>
          </div>
        </td>
        <td style={{ padding: '9px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
          <span className="text-xs font-mono text-gray-400">{company.total.toLocaleString('pl-PL')}</span>
        </td>
      </tr>

      {/* Poczekalni row */}
      {open && company.pending > 0 && (
        <tr style={{ background: '#fffbeb' }}>
          <td style={{ padding: '7px 10px', border: '1px solid #fde68a', width: 28 }} />
          <td colSpan={6} style={{ padding: '7px 14px', border: '1px solid #fde68a' }}>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-amber-500 shrink-0" />
              <span className="text-sm text-amber-700 font-medium">Poczekalni — nieoplacone zamowienia</span>
              <span className="ml-auto text-xs font-mono font-semibold text-amber-600">
                {company.pending.toLocaleString('pl-PL')} voucherow oczekujacych na platnosc
              </span>
            </div>
          </td>
        </tr>
      )}

      {/* HR Pool row */}
      {open && company.pool > 0 && (
        <tr style={{ background: '#f0fdf4' }}>
          <td style={{ padding: '7px 10px', border: '1px solid #bbf7d0', width: 28 }} />
          <td colSpan={6} style={{ padding: '7px 14px', border: '1px solid #bbf7d0' }}>
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-green-600 shrink-0" />
              <span className="text-sm text-green-700 font-medium">Pula HR — gotowe do dystrybucji dla pracownikow</span>
              <span className="ml-auto text-xs font-mono font-semibold text-green-700">
                {company.pool.toLocaleString('pl-PL')} voucherow
              </span>
            </div>
          </td>
        </tr>
      )}

      {/* Employee rows */}
      {open && matchingEmployees.map(emp => (
        <EmployeeRow
          key={emp.id}
          emp={emp}
          companyId={company.id}
          search={search}
          onHistory={onHistory}
        />
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const AdminVouchery: React.FC = () => {
  const [companies,    setCompanies]   = useState<CompanyNode[]>([]);
  const [totalVouchers,setTotalVouchers] = useState(0);
  const [totalPending, setTotalPending]  = useState(0);
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState<string | null>(null);
  const [search,       setSearch]      = useState('');
  const [historyEmp,   setHistoryEmp]  = useState<EmployeeNode | null>(null);

  // Emit state
  const [emitAmount, setEmitAmount] = useState('');
  const [emitDesc,   setEmitDesc]   = useState('');
  const [emitting,   setEmitting]   = useState(false);
  const [emitOk,     setEmitOk]     = useState<string | null>(null);
  const [emitErr,    setEmitErr]    = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/admin/vouchers/tree');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCompanies(data.companies ?? []);
      setTotalVouchers(data.totalVouchers ?? 0);
      setTotalPending(data.totalPending   ?? 0);
    } catch (e: any) {
      setError(e.message ?? 'Blad pobierania voucherow');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const handleEmit = async () => {
    const amount = parseInt(emitAmount);
    if (!amount || amount < 1) { setEmitErr('Podaj liczbe voucherow (min. 1).'); return; }
    if (!emitDesc.trim())       { setEmitErr('Podaj opis emisji.'); return; }
    setEmitting(true); setEmitErr(null); setEmitOk(null);
    try {
      const res  = await fetch('/api/vouchers/emit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount, description: emitDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEmitOk(`Wyemitowano ${data.emitted} voucherow. ID emisji: ${data.emissionId}`);
      setEmitAmount('');
      setEmitDesc('');
      fetchTree();
    } catch (e: any) {
      setEmitErr(e.message ?? 'Blad emisji');
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* History modal */}
      <HistoryModal emp={historyEmp} onClose={() => setHistoryEmp(null)} />

      {/* ── Emit panel ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Plus size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Produkcja voucherow</h2>
            <p className="text-xs text-gray-400">Emisja nowych jednostek do puli platformy (1 voucher = 1 PLN)</p>
          </div>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Liczba voucherow</label>
            <input type="number" min={1} max={1000000} value={emitAmount}
              onChange={e => setEmitAmount(e.target.value)} placeholder="np. 1000"
              className="w-36 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Opis emisji</label>
            <input type="text" value={emitDesc} onChange={e => setEmitDesc(e.target.value)}
              placeholder="np. Emisja kwartalna Q2 2026"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
          </div>
          <button onClick={handleEmit} disabled={emitting || !emitAmount || !emitDesc.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
            {emitting
              ? <><Loader2 size={14} className="animate-spin" /> Emituje…</>
              : <><Ticket size={14} /> Wyemituj</>
            }
          </button>
        </div>
        {emitOk && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 size={15} className="text-green-600 shrink-0" />
            <p className="text-sm text-green-700">{emitOk}</p>
            <button onClick={() => setEmitOk(null)} className="ml-auto text-green-400 hover:text-green-600"><X size={13}/></button>
          </div>
        )}
        {emitErr && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={15} className="text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{emitErr}</p>
            <button onClick={() => setEmitErr(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={13}/></button>
          </div>
        )}
      </div>

      {/* ── Tree panel ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Ticket size={15} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">Wszystkie vouchery</h3>
            <span className="text-xs text-gray-400">
              ({totalVouchers.toLocaleString('pl-PL')} aktywnych
              {totalPending > 0 && `, ${totalPending.toLocaleString('pl-PL')} w poczekalni`})
            </span>
          </div>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj nazwy pracownika..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12}/>
              </button>
            )}
          </div>
          <button onClick={fetchTree}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Odswiez
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['', 'Firma / Pracownik', 'Wartosc', 'Status', 'Data emisji', 'Wazny do', 'Razem'].map((h, i) => (
                  <th key={i} style={{
                    border: '1px solid #16304f', padding: '8px 10px',
                    color: '#fff', fontWeight: 600, fontSize: 11,
                    textAlign: i === 0 ? 'center' : i === 6 ? 'right' : 'left',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                  <Loader2 size={24} className="mx-auto text-blue-400 animate-spin mb-2" />
                  <p className="text-gray-400 text-sm">Ladowanie...</p>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                  <AlertCircle size={20} className="mx-auto text-red-400 mb-2" />
                  <p className="text-red-500 text-sm">{error}</p>
                </td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                  <Ticket size={28} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                  <p className="text-gray-500 text-sm font-medium">Brak voucherow w systemie</p>
                  <p className="text-gray-400 text-xs mt-1">Uzyj panelu Produkcja voucherow powyzej.</p>
                </td></tr>
              ) : (
                companies.map(company => (
                  <CompanyRow key={company.id} company={company} search={search} onHistory={setHistoryEmp} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-5 py-2.5 border-t border-gray-100 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Building2 size={11} className="text-slate-500" /> Firma
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <User size={11} className="text-blue-400" /> Pracownik
          </span>
          <span className="text-xs text-amber-500 flex items-center gap-1">
            <Clock size={11} /> Poczekalni (nieoplacone)
          </span>
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Layers size={11} /> Pula HR (gotowe do dystrybucji)
          </span>
          <span className="text-xs text-gray-400 ml-auto">
            Vouchery ladowane na zadanie — kliknij pracownika, by rozwinac
          </span>
        </div>
      </div>
    </div>
  );
};
