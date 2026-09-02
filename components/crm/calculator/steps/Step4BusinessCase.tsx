'use client';

import React from 'react';
import type { GlobalneWyniki, Firma } from '@/lib/agencja/tax-engine/types';
import { TrendingDown, Award, Calendar, RefreshCw } from 'lucide-react';

const TEAL = '#4a95a9';
const GOLD = '#f0a500';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
}

interface Props {
  wyniki: GlobalneWyniki;
  firma: Firma;
  provisionPct: number;
  onProvisionChange: (v: number) => void;
  onRecalculate: () => void;
  isCalculating: boolean;
}

export function Step4BusinessCase({ wyniki, firma, provisionPct, onProvisionChange, onRecalculate, isCalculating }: Props) {
  const { podsumowanie: p } = wyniki;

  const kpis = [
    { icon: <TrendingDown size={20} />, label: 'Oszczędność całkowita', value: fmt(p.oszczednoscBrutto), color: TEAL },
    { icon: <Award size={20} />, label: 'Prowizja / mies.', value: fmt(p.prowizja), color: GOLD },
    { icon: <TrendingDown size={20} />, label: 'Oszczędność po prowizji BBS / mies.', value: fmt(p.oszczednoscNetto), color: '#22c55e' },
    { icon: <Calendar size={20} />, label: 'Oszczędność roczna', value: fmt(p.oszczednoscRoczna), color: '#22c55e' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TEAL}20` }}>
          <TrendingDown size={20} style={{ color: TEAL }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Business Case — oszczędności</h2>
          <p className="text-sm text-slate-500">Porównanie kosztów i zwrot z wdrożenia</p>
        </div>
      </div>

      {/* Provision input */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-4">
        <Award size={20} className="text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">Prowizja BBS (%)</p>
          <p className="text-xs text-amber-600">Zmień procent prowizji aby zobaczyć wpływ na oszczędności netto</p>
        </div>
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={provisionPct}
          onChange={e => onProvisionChange(parseFloat(e.target.value) || 0)}
          onKeyDown={e => e.key === 'Enter' && onRecalculate()}
          className="w-24 px-3 py-2 text-sm border border-amber-300 rounded-xl font-bold text-center focus:outline-none focus:ring-2"
        />
        <span className="text-amber-700 font-bold">%</span>
        <button
          onClick={onRecalculate}
          disabled={isCalculating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: TEAL }}
          title="Przelicz z nową prowizją (Enter)"
        >
          <RefreshCw size={14} className={isCalculating ? 'animate-spin' : ''} />
          {isCalculating ? 'Liczę…' : 'Przelicz'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">{kpi.label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Comparison bar */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white">
        <h3 className="font-semibold text-slate-700 mb-4">Koszt miesięczny — porównanie</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-500">Model Standard</span>
              <span className="font-bold text-slate-700">{fmt(p.sumaKosztStandard)}</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: TEAL }}>Model Ofertowy</span>
              <span className="font-bold" style={{ color: TEAL }}>{fmt(p.sumaKosztSplit)}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(p.sumaKosztSplit / p.sumaKosztStandard) * 100}%`, backgroundColor: TEAL }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-slate-600">Średnia oszczędność na etat</span>
            <span className="font-bold text-green-600">{fmt(p.sredniaOszczednoscNaEtat)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="font-semibold text-slate-600">ROI roczny</span>
            <span className="font-bold text-green-600">{fmt(p.oszczednoscRoczna)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
