import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, Building2, Coins, RefreshCw, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ── Typy ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  vouchersIssued:  number;
  commissionsTotal: number;
  activeCompanies: number;
}

interface ChartPoint {
  date:     string;
  ordered:  number;
  redeemed: number;
  buybacks: number;
}

interface DashboardData {
  stats: DashboardStats;
  chart: ChartPoint[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const defaultRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toISODate(from), to: toISODate(to) };
};

const formatShortDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label:    string;
  value:    string | number;
  icon:     React.ReactNode;
  color:    string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, loading }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${color}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      {loading ? (
        <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-slate-800">{value}</p>
      )}
    </div>
  </div>
);

// ── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.name}</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const AdminPulpit: React.FC = () => {
  const def = defaultRange();
  const [from, setFrom] = useState(def.from);
  const [to,   setTo]   = useState(def.to);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania danych');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = data?.stats;
  const chart = data?.chart ?? [];

  return (
    <div className="space-y-6">
      {/* Filtr czasowy */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Od
            </label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Do
            </label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Odśwież
          </button>
        </div>
      </div>

      {/* Błąd */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Karty statystyk */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Aktywne vouchery (wszystkie firmy)"
          value={loading ? '' : `${(stats?.vouchersIssued ?? 0).toLocaleString('pl-PL')} szt.`}
          icon={<Coins size={22} />}
          color="bg-blue-600"
          loading={loading}
        />
        <StatCard
          label="Prowizje (okres)"
          value={loading ? '' : formatCurrency(stats?.commissionsTotal ?? 0)}
          icon={<TrendingUp size={22} />}
          color="bg-blue-600"
          loading={loading}
        />
        <StatCard
          label="Firmy w obsłudze"
          value={loading ? '' : stats?.activeCompanies ?? 0}
          icon={<Building2 size={22} />}
          color="bg-violet-600"
          loading={loading}
        />
      </div>

      {/* Wykres */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Przepływ środków w wybranym okresie</h3>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chart.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
            Brak danych w wybranym okresie
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorOrdered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="colorRedeemed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="colorBuybacks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    ordered:  'Zamówione vouchery (PLN)',
                    redeemed: 'Zrealizowane vouchery (PLN)',
                    buybacks: 'Odkupione vouchery (PLN)',
                  };
                  return labels[value] ?? value;
                }}
              />
              <Area type="monotone" dataKey="ordered"  stroke="#10b981" strokeWidth={2} fill="url(#colorOrdered)"  name="ordered" />
              <Area type="monotone" dataKey="redeemed" stroke="#6366f1" strokeWidth={2} fill="url(#colorRedeemed)" name="redeemed" />
              <Area type="monotone" dataKey="buybacks" stroke="#f59e0b" strokeWidth={2} fill="url(#colorBuybacks)" name="buybacks" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
