'use client';

import React from 'react';
import type { GlobalneWyniki, Pracownik } from '@/lib/agencja/tax-engine/types';
import { TrendingUp } from 'lucide-react';

const TEAL = '#4a95a9';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
}

interface Props {
  wyniki: GlobalneWyniki;
  pracownicy: Pracownik[];
}

export function Step2Standard({ wyniki, pracownicy }: Props) {
  const { szczegoly, podsumowanie } = wyniki;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100">
          <TrendingUp size={20} className="text-slate-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Model Standard — stan obecny</h2>
          <p className="text-sm text-slate-500">Aktualne koszty zatrudnienia bez optymalizacji</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Suma brutto', value: fmt(szczegoly.reduce((a, w) => a + w.standardBrutto, 0)) },
          { label: 'ZUS pracodawca', value: fmt(szczegoly.reduce((a, w) => a + w.standardZusPracodawca.suma, 0)) },
          { label: 'Suma PIT', value: fmt(szczegoly.reduce((a, w) => a + w.standardPit, 0)) },
          { label: 'Koszt łączny / mies.', value: fmt(podsumowanie.sumaKosztStandard), highlight: true },
        ].map(kpi => (
          <div
            key={kpi.label}
            className={`p-4 rounded-xl border ${kpi.highlight ? 'border-slate-300 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50'}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${kpi.highlight ? 'text-slate-400' : 'text-slate-500'}`}>{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.highlight ? 'text-white' : 'text-slate-800'}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Per-employee table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="px-4 py-3 text-left">Pracownik</th>
              <th className="px-4 py-3 text-right">Netto</th>
              <th className="px-4 py-3 text-right">Brutto</th>
              <th className="px-4 py-3 text-right">ZUS pracownik</th>
              <th className="px-4 py-3 text-right">ZUS pracodawca</th>
              <th className="px-4 py-3 text-right">PIT</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">Koszt pracodawcy</th>
            </tr>
          </thead>
          <tbody>
            {szczegoly.map((w, idx) => {
              const p = pracownicy.find(emp => emp.id === w.pracownikId);
              const name = p ? `${p.imie || 'Pracownik'} ${p.nazwisko || idx + 1}`.trim() : `#${idx + 1}`;
              return (
                <tr key={w.pracownikId} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">{name}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-mono">{fmt(w.standardNetto)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 font-mono">{fmt(w.standardBrutto)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono">{fmt(w.standardZusPracownik.suma)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono">{fmt(w.standardZusPracodawca.suma)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono">{fmt(w.standardPit)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 font-mono">{fmt(w.standardKosztPracodawcy)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold">
              <td className="px-4 py-3 text-slate-700">RAZEM</td>
              <td colSpan={5} />
              <td className="px-4 py-3 text-right text-slate-800 font-mono">{fmt(podsumowanie.sumaKosztStandard)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
