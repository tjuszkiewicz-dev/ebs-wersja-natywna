'use client';

// Księgowość → Sprawozdania: rachunek wyników roku po miesiącach (z auto-składnikami) + CSV.
import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, Download } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

const money = (n: number) => Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

export function KsiegSprawozdania({ companyId }: { companyId: string }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/report?company_id=${companyId}&year=${year}`, { credentials: 'same-origin' });
      const d = await r.json();
      setData(r.ok ? d : null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [companyId, year]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const esc = (v: any) => String(v ?? '');
    const header = ['Miesiąc', 'Przychody', 'Koszty ręczne', 'Zaliczki', 'Wypłaty', 'Koordynatorzy', 'Czynsze', 'Amortyzacja', 'Koszty razem', 'Wynik'];
    const rows = data.months.map((m: any, i: number) => [m.future ? `${MONTHS[i]} (prognoza)` : MONTHS[i], m.income, m.manual, m.advances, m.payouts, m.coordinator, m.rents, m.amortization, m.costs, m.result]);
    rows.push(['RAZEM (bez prognoz)', data.totals.income, data.totals.manual, data.totals.advances, data.totals.payouts, data.totals.coordinator, data.totals.rents, data.totals.amortization, data.totals.costs, data.totals.result]);
    const body = [header, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `RachunekWynikow_${year}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const now = new Date().getFullYear();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BarChart3 size={18} className="text-primary-600" />
        <h3 className="font-sans text-sm font-bold text-slate-900">Rachunek wyników — {year}</h3>
        <Hint text="Zestawienie roku po miesiącach: przychody i wszystkie koszty (ręczne + automatyczne z modułów: wypłaty, zaliczki, koordynatorzy, czynsze noclegów, amortyzacja). Wynik = przychody − koszty. CSV do przekazania księgowej/zarządowi." />
        <div className="ml-auto flex items-center gap-2">
          <select value={year} onChange={e => setYear(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {[now, now - 1, now - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCsv} disabled={!data} className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-40"><Download size={13} /> CSV</button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : !data ? <p className="py-6 text-center text-sm italic text-slate-300">Brak danych</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Miesiąc</th><th className="px-2 py-2 text-right">Przychody</th>
              <th className="px-2 py-2 text-right">Koszty ręczne</th>
              {data.hr_linked && <><th className="px-2 py-2 text-right">Zaliczki</th><th className="px-2 py-2 text-right">Wypłaty</th><th className="px-2 py-2 text-right">Koordyn.</th><th className="px-2 py-2 text-right">Czynsze</th></>}
              <th className="px-2 py-2 text-right">Amortyzacja</th>
              <th className="px-2 py-2 text-right">Koszty razem</th><th className="px-2 py-2 text-right">Wynik</th>
            </tr></thead>
            <tbody>
              {data.months.map((m: any, i: number) => (
                <tr key={m.month} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 ${m.future ? 'text-slate-400 opacity-60' : ''}`}>
                  <td className="px-2 py-1.5 font-medium text-slate-700">{MONTHS[i]}{m.future && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">prognoza</span>}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-700">{m.income ? money(m.income) : ''}</td>
                  <td className="px-2 py-1.5 text-right">{m.manual ? money(m.manual) : ''}</td>
                  {data.hr_linked && <>
                    <td className="px-2 py-1.5 text-right">{m.advances ? money(m.advances) : ''}</td>
                    <td className="px-2 py-1.5 text-right">{m.payouts ? money(m.payouts) : ''}</td>
                    <td className="px-2 py-1.5 text-right">{m.coordinator ? money(m.coordinator) : ''}</td>
                    <td className="px-2 py-1.5 text-right">{m.rents ? money(m.rents) : ''}</td>
                  </>}
                  <td className="px-2 py-1.5 text-right">{m.amortization ? money(m.amortization) : ''}</td>
                  <td className="px-2 py-1.5 text-right text-rose-700">{m.costs ? money(m.costs) : ''}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${m.result > 0 ? 'text-emerald-700' : m.result < 0 ? 'text-rose-700' : 'text-slate-400'}`}>{m.income || m.costs ? money(m.result) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-slate-100 bg-slate-50/60 font-semibold">
              <td className="px-2 py-2">RAZEM <span className="font-normal text-slate-400">(bez prognoz)</span></td>
              <td className="px-2 py-2 text-right text-emerald-700">{money(data.totals.income)}</td>
              <td className="px-2 py-2 text-right">{money(data.totals.manual)}</td>
              {data.hr_linked && <>
                <td className="px-2 py-2 text-right">{money(data.totals.advances)}</td>
                <td className="px-2 py-2 text-right">{money(data.totals.payouts)}</td>
                <td className="px-2 py-2 text-right">{money(data.totals.coordinator)}</td>
                <td className="px-2 py-2 text-right">{money(data.totals.rents)}</td>
              </>}
              <td className="px-2 py-2 text-right">{money(data.totals.amortization)}</td>
              <td className="px-2 py-2 text-right text-rose-700">{money(data.totals.costs)}</td>
              <td className={`px-2 py-2 text-right ${data.totals.result >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(data.totals.result)}</td>
            </tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
