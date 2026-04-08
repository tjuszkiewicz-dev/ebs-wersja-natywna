import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Ticket, Search, RefreshCw, Plus, Loader2, AlertCircle,
  CheckCircle2, ChevronLeft, ChevronRight, Filter, X,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface VoucherRow {
  id:                   string;
  serial_number:        string;
  face_value_pln:       number;
  status:               string;
  company_id:           string;
  current_owner_id:     string;
  issued_at:            string;
  valid_until:          string;
  redeemed_at:          string | null;
  buyback_agreement_id: string | null;
  companies?:           { name: string; nip: string } | null;
  user_profiles?:       { full_name: string | null; role: string } | null;
}

// Polish status labels (business vocabulary)
const STATUS_LABELS: Record<string, string> = {
  created:          'Nieprzyznany',
  reserved:         'Zarezerwowany',
  active:           'Przyznany',
  distributed:      'Przyznany',
  consumed:         'Zużyty',
  expired:          'Wygasły',
  buyback_pending:  'Odkup w toku',
  buyback_complete: 'Odkupiony',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  created:          { bg: '#f8fafc', text: '#94a3b8', border: '#e2e8f0' },   // slate — nieprzyznany
  reserved:         { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' },   // blue
  active:           { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },   // green — przyznany
  distributed:      { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },   // blue — przyznany (pracownik)
  consumed:         { bg: '#1e293b', text: '#cbd5e1', border: '#334155' },   // dark — zużyty
  expired:          { bg: '#fff7ed', text: '#b45309', border: '#fed7aa' },   // amber — wygasły
  buyback_pending:  { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },   // yellow — odkup w toku
  buyback_complete: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },   // green — odkupiony
};

// Filter options ordered by lifecycle
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'created',          label: 'Nieprzyznany' },
  { value: 'active',           label: 'Przyznany (aktywny)' },
  { value: 'distributed',      label: 'Przyznany (pracownik)' },
  { value: 'consumed',         label: 'Zużyty' },
  { value: 'expired',          label: 'Wygasły' },
  { value: 'buyback_pending',  label: 'Odkup w toku' },
  { value: 'buyback_complete', label: 'Odkupiony' },
];

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── Component ────────────────────────────────────────────────────────────────

export const AdminVouchery: React.FC = () => {
  // ── List state ──────────────────────────────────────────────────────────
  const [vouchers,    setVouchers]    = useState<VoucherRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [search,      setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LIMIT = 50;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // ── Emit state ──────────────────────────────────────────────────────────
  const [emitAmount,  setEmitAmount]  = useState('');
  const [emitDesc,    setEmitDesc]    = useState('');
  const [emitting,    setEmitting]    = useState(false);
  const [emitOk,      setEmitOk]      = useState<string | null>(null);
  const [emitErr,     setEmitErr]     = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchVouchers = useCallback(async (p = page, s = search, st = filterStatus) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:  String(p),
        limit: String(LIMIT),
        ...(s  ? { search: s }  : {}),
        ...(st ? { status: st } : {}),
      });
      const res = await fetch(`/api/admin/vouchers?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setVouchers(data.vouchers ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania voucherów');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus]);

  useEffect(() => { fetchVouchers(1, search, filterStatus); setPage(1); }, [filterStatus]);
  useEffect(() => { fetchVouchers(page, search, filterStatus); }, [page]);
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchVouchers(1, search, filterStatus);
    }, 350);
  }, [search]);

  // ── Emit ─────────────────────────────────────────────────────────────────
  const handleEmit = async () => {
    const amount = parseInt(emitAmount);
    if (!amount || amount < 1) { setEmitErr('Podaj liczbę voucherów (min. 1).'); return; }
    if (!emitDesc.trim()) { setEmitErr('Podaj opis emisji.'); return; }
    setEmitting(true); setEmitErr(null); setEmitOk(null);
    try {
      const res = await fetch('/api/vouchers/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: emitDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEmitOk(`Wyemitowano ${data.emitted} voucherów. ID emisji: ${data.emissionId}`);
      setEmitAmount('');
      setEmitDesc('');
      fetchVouchers(1, search, filterStatus);
      setPage(1);
    } catch (e: any) {
      setEmitErr(e.message ?? 'Błąd emisji');
    } finally {
      setEmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Emit panel ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Plus size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Produkcja voucherów</h2>
            <p className="text-xs text-gray-400">Emisja nowych jednostek do puli platformy (1 voucher = 1 PLN)</p>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Liczba voucherów</label>
            <input
              type="number"
              min={1}
              max={1000000}
              value={emitAmount}
              onChange={e => setEmitAmount(e.target.value)}
              placeholder="np. 1000"
              className="w-36 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Opis emisji</label>
            <input
              type="text"
              value={emitDesc}
              onChange={e => setEmitDesc(e.target.value)}
              placeholder="np. Emisja kwartalna Q2 2026"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleEmit}
            disabled={emitting || !emitAmount || !emitDesc.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {emitting
              ? <><Loader2 size={14} className="animate-spin" /> Emituję…</>
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

      {/* ── List panel ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Ticket size={15} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">
              Wszystkie vouchery
            </h3>
            <span className="text-xs text-gray-400 font-normal">
              ({total.toLocaleString('pl-PL')} szt.)
            </span>
          </div>

          <div className="relative flex-1 max-w-xs ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nr seryjny…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="">Wszystkie statusy</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchVouchers(page, search, filterStatus)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition"
          >
            <RefreshCw size={13} /> Odśwież
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['LP','Nr seryjny','Firma (klient)','Właściciel','Status','Data emisji','Ważny do','Odkupiony'].map((h, i) => (
                  <th key={i} style={{
                    border: '1px solid #16304f', padding: '8px 10px',
                    color: '#fff', fontWeight: 600, fontSize: 11,
                    textAlign: i === 0 ? 'center' : 'left',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                    <Loader2 size={24} className="mx-auto text-blue-400 animate-spin mb-2" />
                    <p className="text-gray-400 text-sm">Ładowanie…</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                    <AlertCircle size={20} className="mx-auto text-red-400 mb-2" />
                    <p className="text-red-500 text-sm">{error}</p>
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                    <Ticket size={28} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                    {total === 0 && !search && !filterStatus ? (
                      <>
                        <p className="text-gray-500 text-sm font-medium">Brak voucherów w systemie</p>
                        <p className="text-gray-400 text-xs mt-1">Użyj panelu „Produkcja voucherów" powyżej, aby wyemitować nowe jednostki.</p>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm">Brak voucherów spełniających kryteria.</p>
                    )}
                  </td>
                </tr>
              ) : (
                vouchers.map((v, idx) => {
                  const sc  = STATUS_COLORS[v.status] ?? STATUS_COLORS.created;
                  const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
                    border: '1px solid #e5e7eb', padding: '6px 10px',
                    background: rowBg, ...extra,
                  });
                  return (
                    <tr key={v.id} className="hover:bg-blue-50 transition-colors">
                      <td style={{ ...cell(), textAlign: 'center', color: '#9ca3af' }}>
                        {(page - 1) * LIMIT + idx + 1}
                      </td>
                      <td style={cell({ fontFamily: 'monospace', color: '#111827', fontSize: 11 })}>
                        {v.serial_number}
                      </td>
                      <td style={cell({ color: '#374151' })}>
                        {v.companies?.name ?? <span className="text-gray-400">—</span>}
                        {v.companies?.nip && (
                          <span className="ml-1.5 text-[10px] text-gray-400">NIP {v.companies.nip}</span>
                        )}
                      </td>
                      <td style={cell({ color: '#374151' })}>
                        {v.user_profiles?.full_name ?? <span className="text-gray-400">{v.current_owner_id.slice(0, 8)}…</span>}
                        {v.user_profiles?.role && (
                          <span className="ml-1.5 text-[10px] text-gray-400">({v.user_profiles.role})</span>
                        )}
                      </td>
                      <td style={cell()}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                          background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {STATUS_LABELS[v.status] ?? v.status}
                        </span>
                      </td>
                      <td style={cell({ color: '#6b7280', whiteSpace: 'nowrap' })}>{fmt(v.issued_at)}</td>
                      <td style={cell({
                        color: v.status === 'expired' ? '#b45309' : '#6b7280',
                        fontWeight: v.status === 'expired' ? 600 : 400,
                        whiteSpace: 'nowrap',
                      })}>
                        {fmt(v.valid_until)}
                      </td>
                      <td style={cell({ color: '#6b7280', whiteSpace: 'nowrap' })}>
                        {v.redeemed_at ? fmt(v.redeemed_at) : '—'}
                        {v.buyback_agreement_id && (
                          <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">odkup</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Strona {page} z {totalPages} · {total.toLocaleString('pl-PL')} rekordów
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 transition"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const pg = totalPages <= 7 ? i + 1
                  : page <= 4 ? i + 1
                  : page >= totalPages - 3 ? totalPages - 6 + i
                  : page - 3 + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-7 h-7 rounded text-xs font-medium transition ${
                      pg === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'
                    }`}>
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 transition"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
