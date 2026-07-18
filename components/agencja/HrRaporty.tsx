'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, Building2, UserCheck, UserX, RefreshCw, AlertCircle, FileDown, Globe, Layers } from 'lucide-react';

interface Emp {
  first_name: string; last_name: string; status: string;
  country_of_origin?: string | null; phone?: string | null; email?: string | null;
  bank_account?: string | null; team?: string | null; contract?: { id: string; name: string } | null;
}
interface Contract { id: string; name: string; employee_count: number; }

const TEAL = '#4a95a9';
const NAVY = '#0b1622';
const GOLD = '#f0a500';
const RED  = '#e11d48';
const BAR_COLORS = [TEAL, GOLD, '#6366f1', '#f43f5e', '#10b981', '#f97316', '#0ea5e9', '#a855f7'];

function tally(items: (string | null | undefined)[], fallback: string) {
  const m: Record<string, number> = {};
  for (const it of items) { const k = it && it.trim() ? it : fallback; m[k] = (m[k] ?? 0) + 1; }
  return Object.entries(m).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function BarList({ title, icon, rows, total }: { title: string; icon: React.ReactNode; rows: { label: string; count: number }[]; total: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">{icon} {title}</h3>
      <div className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm italic text-slate-300">Brak danych</p>}
        {rows.map((r, i) => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          return (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="truncate pr-2 text-slate-600">{r.label}</span>
                <span className="flex-shrink-0 text-slate-400">{r.count} ({pct}%)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const HrRaporty: React.FC = () => {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [re, rc] = await Promise.all([
        fetch('/api/hr/employees', { credentials: 'same-origin' }),
        fetch('/api/hr/contracts', { credentials: 'same-origin' }),
      ]);
      if (!re.ok) throw new Error(`HTTP ${re.status}`);
      const de = await re.json();
      const dc = rc.ok ? await rc.json() : { contracts: [] };
      setEmps(de.employees || []);
      setContracts(dc.contracts || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const exportCsv = () => {
    const keys: (keyof Emp | 'contract_name')[] = ['last_name', 'first_name', 'country_of_origin', 'phone', 'email', 'bank_account', 'team', 'contract_name', 'status'];
    const rows = emps.map(e => ({ ...e, contract_name: e.contract?.name ?? '' }));
    const csv = [keys.join(';'), ...rows.map(r => keys.map(k => String((r as any)[k] ?? '')).join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `agencja-pracownicy.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={28} className="animate-spin text-slate-300" /></div>;
  if (error) return <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={14} /> {error}</div>;

  const total = emps.length;
  const active = emps.filter(e => e.status === 'active').length;
  const inactive = total - active;
  const contractsCount = contracts.length || new Set(emps.map(e => e.contract?.id).filter(Boolean)).size;

  const byContract = tally(emps.map(e => e.contract?.name), 'Bez kontraktu');
  const byCountry = tally(emps.map(e => e.country_of_origin), 'Nieokreślony');
  const byTeam = tally(emps.map(e => e.team), 'Bez grupy');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans text-lg font-bold text-slate-900">Raporty agencji pracy</h2>
          <p className="text-sm text-slate-500">Statystyki kartoteki pracowników i kontraktów</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={16} /></button>
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: GOLD }}><FileDown size={15} /> Export CSV</button>
        </div>
      </div>

      {/* KPI agencji */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Wszyscy pracownicy',   value: total,          icon: <Users size={20} />,     bg: NAVY },
          { label: 'Pracownicy aktywni',   value: active,         icon: <UserCheck size={20} />, bg: TEAL },
          { label: 'Pracownicy nieaktywni', value: inactive,      icon: <UserX size={20} />,     bg: RED },
          { label: 'Kontrakty / obiekty',  value: contractsCount, icon: <Building2 size={20} />, bg: GOLD },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 text-white shadow-sm" style={{ backgroundColor: k.bg }}>
            <div className="mb-2 flex items-center justify-between"><span className="opacity-70">{k.icon}</span></div>
            <p className="text-3xl font-bold">{k.value}</p>
            <p className="mt-0.5 text-xs opacity-70">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <BarList title="Pracownicy wg kontraktu / obiektu" icon={<Building2 size={15} className="text-primary-500" />} rows={byContract} total={total} />
        <BarList title="Pracownicy wg kraju pochodzenia" icon={<Globe size={15} className="text-primary-500" />} rows={byCountry} total={total} />
      </div>

      <BarList title="Pracownicy wg grupy" icon={<Layers size={15} className="text-primary-500" />} rows={byTeam} total={total} />
    </div>
  );
};
