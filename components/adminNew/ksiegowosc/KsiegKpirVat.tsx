'use client';

// Księgowość → KPiR i Rejestry VAT: widoki pochodne (wpisy + faktury) z eksportem CSV
// dla biura rachunkowego. Bez ręcznej edycji — źródłem są Bilans i Faktury.
import React, { useState, useEffect, useCallback } from 'react';
import { BookOpenCheck, Loader2, Download, Percent } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

const money = (n: number) => Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INPUT = 'rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const MONTHS = ['— cały rok —', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

function csvDownload(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: any) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = [header, ...rows].map(r => r.map(escape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }); // BOM dla Excela
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function PeriodBar({ year, setYear, month, setMonth }: any) {
  const now = new Date().getFullYear();
  return (
    <div className="flex items-center gap-2">
      <select value={year} onChange={e => setYear(e.target.value)} className={INPUT}>
        {[now, now - 1, now - 2].map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select value={month} onChange={e => setMonth(e.target.value)} className={INPUT}>
        {MONTHS.map((m, i) => <option key={i} value={i === 0 ? '' : String(i)}>{m}</option>)}
      </select>
    </div>
  );
}

// ── KPiR ──
export function KsiegKpir({ companyId }: { companyId: string }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/kpir?company_id=${companyId}&year=${year}${month ? `&month=${month}` : ''}`, { credentials: 'same-origin' });
      const d = await r.json();
      setData(r.ok ? d : null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [companyId, year, month]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    csvDownload(`KPiR_${year}${month ? '-' + String(month).padStart(2, '0') : ''}.csv`,
      ['Lp', 'Data zdarzenia', 'Nr dowodu', 'Kontrahent', 'Adres kontrahenta', 'Opis zdarzenia', 'Sprzedaż (7)', 'Pozostałe przychody (8)', 'Razem przychód (9)', 'Wynagrodzenia (12)', 'Pozostałe wydatki (13)', 'Razem wydatki (14)'],
      data.rows.map((r: any) => [r.lp, r.date, r.doc, r.contractor, r.contractor_addr, r.description, r.col7_sprzedaz, r.col8_pozostale, r.col9_przychod_razem, r.col12_wynagrodzenia, r.col13_pozostale_wydatki, r.col14_wydatki_razem]));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BookOpenCheck size={18} className="text-primary-600" />
        <h3 className="font-sans text-sm font-bold text-slate-900">Książka Przychodów i Rozchodów</h3>
        <Hint text="Widok pochodny — buduje się automatycznie z Bilansu (wpisy) i zapłaconych faktur sprzedaży (kwoty NETTO w kol. 7). Kolumny wg wzoru KPiR: 7 sprzedaż, 8 pozostałe przychody, 12 wynagrodzenia, 13 pozostałe wydatki. Eksport CSV otwiera się w Excelu — do przekazania biuru rachunkowemu." />
        <div className="ml-auto flex items-center gap-2">
          <PeriodBar year={year} setYear={setYear} month={month} setMonth={setMonth} />
          <button onClick={exportCsv} disabled={!data?.rows?.length} className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-40"><Download size={13} /> CSV</button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : !data ? <p className="py-6 text-center text-sm italic text-slate-300">Brak danych</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">Lp</th><th className="px-2 py-2">Data</th><th className="px-2 py-2">Dowód</th>
                  <th className="px-2 py-2">Kontrahent</th><th className="px-2 py-2">Opis</th>
                  <th className="px-2 py-2 text-right">Sprzedaż (7)</th><th className="px-2 py-2 text-right">Pozost. przych. (8)</th>
                  <th className="px-2 py-2 text-right">Przychód (9)</th><th className="px-2 py-2 text-right">Wynagr. (12)</th>
                  <th className="px-2 py-2 text-right">Pozost. wyd. (13)</th><th className="px-2 py-2 text-right">Wydatki (14)</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.lp} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-2 py-1.5 text-slate-400">{r.lp}</td>
                    <td className="px-2 py-1.5">{new Date(r.date).toLocaleDateString('pl-PL')}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.doc || '—'}</td>
                    <td className="max-w-[160px] truncate px-2 py-1.5">{r.contractor || '—'}</td>
                    <td className="max-w-[200px] truncate px-2 py-1.5 text-slate-500">{r.description}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-700">{r.col7_sprzedaz ? money(r.col7_sprzedaz) : ''}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-700">{r.col8_pozostale ? money(r.col8_pozostale) : ''}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{money(r.col9_przychod_razem)}</td>
                    <td className="px-2 py-1.5 text-right text-rose-700">{r.col12_wynagrodzenia ? money(r.col12_wynagrodzenia) : ''}</td>
                    <td className="px-2 py-1.5 text-right text-rose-700">{r.col13_pozostale_wydatki ? money(r.col13_pozostale_wydatki) : ''}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{money(r.col14_wydatki_razem)}</td>
                  </tr>
                ))}
                {!data.rows.length && <tr><td colSpan={11} className="px-3 py-8 text-center text-sm italic text-slate-300">Brak zdarzeń w okresie</td></tr>}
              </tbody>
              {data.rows.length > 0 && (
                <tfoot><tr className="border-t-2 border-slate-100 bg-slate-50/60 font-semibold">
                  <td className="px-2 py-2" colSpan={5}>Razem</td>
                  <td className="px-2 py-2 text-right">{money(data.sums.col7)}</td>
                  <td className="px-2 py-2 text-right">{money(data.sums.col8)}</td>
                  <td className="px-2 py-2 text-right text-emerald-700">{money(data.sums.col9)}</td>
                  <td className="px-2 py-2 text-right">{money(data.sums.col12)}</td>
                  <td className="px-2 py-2 text-right">{money(data.sums.col13)}</td>
                  <td className="px-2 py-2 text-right text-rose-700">{money(data.sums.col14)}</td>
                </tr></tfoot>
              )}
            </table>
          </div>
          {data.rows.length > 0 && (
            <p className="mt-3 text-right text-sm">Dochód (przychody − wydatki): <strong className={data.dochod >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{money(data.dochod)} zł</strong></p>
          )}
        </>
      )}
    </div>
  );
}

// ── Rejestry VAT ──
export function KsiegVat({ companyId }: { companyId: string }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/vat?company_id=${companyId}&year=${year}${month ? `&month=${month}` : ''}`, { credentials: 'same-origin' });
      const d = await r.json();
      setData(r.ok ? d : null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [companyId, year, month]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    csvDownload(`RejestrVAT_sprzedaz_${year}${month ? '-' + String(month).padStart(2, '0') : ''}.csv`,
      ['Data', 'Numer', 'Kontrahent', 'NIP', 'Status', 'Netto', 'VAT', 'Brutto'],
      data.sales.map((s: any) => [s.date, s.number, s.contractor, s.nip, s.status, s.net, s.vat, s.gross]));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Percent size={18} className="text-primary-600" />
          <h3 className="font-sans text-sm font-bold text-slate-900">Rejestr VAT sprzedaży</h3>
          <Hint text="Faktury wystawione/zapłacone/przeterminowane w okresie (bez szkiców i anulowanych), z rozbiciem VAT wg stawek z pozycji. Eksport CSV dla biura rachunkowego. VAT należny = suma z faktur." />
          <div className="ml-auto flex items-center gap-2">
            <PeriodBar year={year} setYear={setYear} month={month} setMonth={setMonth} />
            <button onClick={exportCsv} disabled={!data?.sales?.length} className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-40"><Download size={13} /> CSV</button>
          </div>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : !data ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100 text-left text-[10px] uppercase text-slate-400">
                <th className="px-2 py-2">Data</th><th className="px-2 py-2">Numer</th><th className="px-2 py-2">Kontrahent</th><th className="px-2 py-2">NIP</th>
                <th className="px-2 py-2">Stawki</th><th className="px-2 py-2 text-right">Netto</th><th className="px-2 py-2 text-right">VAT</th><th className="px-2 py-2 text-right">Brutto</th>
              </tr></thead>
              <tbody>
                {data.sales.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-2 py-1.5">{new Date(s.date).toLocaleDateString('pl-PL')}</td>
                    <td className="px-2 py-1.5 font-medium">{s.number}</td>
                    <td className="max-w-[180px] truncate px-2 py-1.5">{s.contractor || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{s.nip || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{Object.entries(s.rates).map(([r, v]: any) => `${r}%: ${money(v.net)}+${money(v.vat)}`).join(' · ')}</td>
                    <td className="px-2 py-1.5 text-right">{money(s.net)}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{money(s.vat)}</td>
                    <td className="px-2 py-1.5 text-right">{money(s.gross)}</td>
                  </tr>
                ))}
                {!data.sales.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm italic text-slate-300">Brak faktur w okresie</td></tr>}
              </tbody>
              {data.sales.length > 0 && (
                <tfoot><tr className="border-t-2 border-slate-100 bg-slate-50/60 font-semibold">
                  <td className="px-2 py-2" colSpan={5}>Razem — VAT należny</td>
                  <td className="px-2 py-2 text-right">{money(data.sales_sums.net)}</td>
                  <td className="px-2 py-2 text-right text-primary-700">{money(data.sales_sums.vat)}</td>
                  <td className="px-2 py-2 text-right">{money(data.sales_sums.gross)}</td>
                </tr></tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-sans text-sm font-bold text-slate-900">Rejestr zakupów (koszty)</h3>
          <Hint text="Wpisy kosztowe z Bilansu w okresie — kwoty BRUTTO. VAT naliczony do odliczenia wymaga rozbicia z faktur zakupu — te kwoty przekazuje się biuru razem ze skanami faktur (podpięte przy wpisach)." />
        </div>
        {!loading && data && (
          <div className="max-h-72 overflow-y-auto">
            {data.purchases.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 border-b border-slate-50 py-1.5 text-xs last:border-0">
                <span className="w-20 shrink-0 text-slate-400">{new Date(p.date).toLocaleDateString('pl-PL')}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600">{[p.contractor, p.number ? `FV ${p.number}` : null, p.description].filter(Boolean).join(' · ')}</span>
                <span className="shrink-0 font-medium">{money(p.gross)} zł</span>
              </div>
            ))}
            {!data.purchases.length && <p className="py-4 text-center text-sm italic text-slate-300">Brak wpisów kosztowych w okresie</p>}
            {data.purchases.length > 0 && <p className="mt-2 text-right text-sm font-semibold">Razem brutto: {money(data.purchases_gross_sum)} zł</p>}
          </div>
        )}
      </div>
    </div>
  );
}
