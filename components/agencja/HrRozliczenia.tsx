'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fullName } from '@/lib/hr/docPlaceholders';
import { Hint } from '@/components/ui/Hint';
import { Wallet, Loader2, Search, Plus, HandCoins, History, X, Trash2, Banknote, CalendarDays } from 'lucide-react';

interface Row {
  employee: { id: string; first_name: string; last_name: string; status: string; team?: string | null; contract?: { id: string; name: string } | null };
  rate: number; rate_type: 'hourly' | 'monthly'; hours: number;
  gross: number; advances: number; payouts: number; bonus: number; housing_deduction: number; other_deduction: number; other_note?: string | null; rent_share: number; accommodation_name?: string | null; remaining: number; schedule_hours: number; note?: string | null;
}
interface Edit { rate: string; rate_type: 'hourly' | 'monthly'; hours: string; bonus: string; housing: string; other: string; other_note: string }

const INPUT = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const money = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export const HrRozliczenia: React.FC = () => {
  const [period, setPeriod] = useState(thisMonth());
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [entryFor, setEntryFor] = useState<{ row: Row; kind: 'advance' | 'payout' } | null>(null);
  const [historyFor, setHistoryFor] = useState<Row | null>(null);
  const [canEdit, setCanEdit] = useState(true); // koordynator: tylko podgląd
  const [pageSize, setPageSize] = useState<number>(10); // 0 = wszyscy

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/settlements?period=${p}`, { credentials: 'same-origin' });
      const d = await r.json();
      const rs: Row[] = d.rows || [];
      setRows(rs);
      if (d.can_edit !== undefined) setCanEdit(!!d.can_edit);
      setEdits(Object.fromEntries(rs.map(x => [x.employee.id, { rate: String(x.rate), rate_type: x.rate_type, hours: String(x.hours), bonus: String(x.bonus || 0), housing: String(x.housing_deduction || 0), other: String(x.other_deduction || 0), other_note: x.other_note || '' }])));
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(period); }, [period, load]);

  const persist = async (id: string, e: Edit) => {
    if (!canEdit) return;
    try {
      await fetch('/api/hr/settlements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ employee_id: id, period, rate: Number(e.rate) || 0, rate_type: e.rate_type, hours: Number(e.hours) || 0, bonus: Number(e.bonus) || 0, housing_deduction: Number(e.housing) || 0, other_deduction: Number(e.other) || 0, other_note: e.other_note }),
      });
      setRows(prev => prev.map(r => {
        if (r.employee.id !== id) return r;
        const rate = Number(e.rate) || 0, hours = Number(e.hours) || 0, bonus = Number(e.bonus) || 0;
        const housing = Number(e.housing) || 0, other = Number(e.other) || 0;
        const gross = e.rate_type === 'monthly' ? rate : rate * hours;
        return { ...r, rate, hours, rate_type: e.rate_type, bonus, housing_deduction: housing, other_deduction: other, other_note: e.other_note || null, gross: Math.round(gross * 100) / 100, remaining: Math.round((gross + bonus - r.advances - r.payouts - housing - other - (r.rent_share || 0)) * 100) / 100 };
      }));
    } catch { /* */ }
  };

  const saveRow = async (id: string) => {
    const e = edits[id]; if (!e) return;
    const row = rows.find(r => r.employee.id === id);
    const newHours = Number(e.hours) || 0;
    // ostrzeżenie: ręczne godziny niezgodne z grafikiem
    if (e.rate_type !== 'monthly' && row && row.schedule_hours > 0 && newHours !== row.hours && newHours !== row.schedule_hours) {
      const ok = window.confirm(`Wpisane godziny (${newHours} h) różnią się od grafiku (${row.schedule_hours} h) dla ${fullName(row.employee)}.\n\nZapisać ręcznie mimo to?`);
      if (!ok) { setEdits(p => ({ ...p, [id]: { ...e, hours: String(row.hours) } })); return; }
    }
    await persist(id, e);
  };

  const pullFromSchedule = async (id: string) => {
    const row = rows.find(r => r.employee.id === id); if (!row || row.schedule_hours <= 0) return;
    const e: Edit = { ...(edits[id] || { rate: String(row.rate), rate_type: row.rate_type, hours: '', bonus: String(row.bonus || 0), housing: String(row.housing_deduction || 0), other: String(row.other_deduction || 0), other_note: row.other_note || '' }), hours: String(row.schedule_hours) };
    setEdits(p => ({ ...p, [id]: e }));
    await persist(id, e);
  };

  const pullAll = async () => {
    const targets = rows.filter(r => r.schedule_hours > 0 && r.rate_type !== 'monthly');
    if (!targets.length) { window.alert('Brak godzin w grafiku do przeniesienia w tym miesiącu.'); return; }
    if (!window.confirm(`Przenieść godziny z grafiku dla ${targets.length} pracowników? Nadpisze ręcznie wpisane godziny w tym miesiącu.`)) return;
    for (const r of targets) {
      const e: Edit = { rate: String(r.rate), rate_type: r.rate_type, hours: String(r.schedule_hours), bonus: String(r.bonus || 0), housing: String(r.housing_deduction || 0), other: String(r.other_deduction || 0), other_note: r.other_note || '' };
      setEdits(p => ({ ...p, [r.employee.id]: e }));
      await persist(r.employee.id, e);
    }
  };

  const contracts = Array.from(new Map(rows.filter(r => r.employee.contract).map(r => [r.employee.contract!.id, r.employee.contract!.name])).entries());
  const filtered = rows.filter(r => {
    const name = fullName(r.employee).toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (contractFilter && r.employee.contract?.id !== contractFilter) return false;
    return true;
  });

  const totals = filtered.reduce((a, r) => ({ gross: a.gross + r.gross, bonus: a.bonus + (r.bonus || 0), adv: a.adv + r.advances, pay: a.pay + r.payouts, rent: a.rent + (r.rent_share || 0), housing: a.housing + (r.housing_deduction || 0), other: a.other + (r.other_deduction || 0), rem: a.rem + r.remaining }), { gross: 0, bonus: 0, adv: 0, pay: 0, rent: 0, housing: 0, other: 0, rem: 0 });
  const visibleRows = pageSize > 0 ? filtered.slice(0, pageSize) : filtered;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-sans text-lg font-bold text-slate-900">Rozliczenia pracowników</h2>
          <p className="text-sm text-slate-500">Stawki, godziny, premie uznaniowe, zaliczki, wypłaty i potrącenia (mieszkanie, kary) w okresie rozliczeniowym</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Miesiąc <Hint text="Okres rozliczeniowy — stawki, godziny, zaliczki i potrącenia zapisują się osobno dla każdego miesiąca." /></p>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Filtry */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj pracownika…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <select value={contractFilter} onChange={e => setContractFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Wszystkie kontrakty</option>
          {contracts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} title="Ilu pracowników pokazać" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value={10}>Pokaż: 10</option>
          <option value={25}>Pokaż: 25</option>
          <option value={50}>Pokaż: 50</option>
          <option value={0}>Pokaż: wszystkich</option>
        </select>
        {canEdit && <button onClick={pullAll} title="Wlicz wszystkim sumę godzin z grafiku za ten miesiąc" className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"><CalendarDays size={15} /> Przenieś z grafiku</button>}
        <button onClick={() => {
          const esc2 = (v: any) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
          const header = ['Pracownik', 'Kontrakt', 'Grupa', 'Stawka', 'Typ', 'Godziny', 'Brutto', 'Premia', 'Zaliczki', 'Wypłacono', 'Nocleg', 'Mieszkanie', 'Inne', 'Pozostało'];
          const body = [header, ...filtered.map(r => [fullName(r.employee), r.employee.contract?.name || '', r.employee.team || '', r.rate, r.rate_type === 'monthly' ? 'miesięczna' : 'godzinowa', r.hours, r.gross, r.bonus || 0, r.advances, r.payouts, r.rent_share || 0, r.housing_deduction || 0, r.other_deduction || 0, r.remaining])].map(row => row.map(esc2).join(';')).join('\r\n');
          const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = Object.assign(document.createElement('a'), { href: url, download: `Rozliczenia_${period}.csv` });
          document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        }} title="Eksport rozliczeń do CSV (Excel)" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">CSV</button>
        <button type="button" disabled title="PDF list płac — wkrótce (E2c)" className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 opacity-60">PDF</button>
        {canEdit && <a href={`/api/hr/settlements/transfers?period=${period}&format=csv`} title="Paczka przelewów wynagrodzeń — kwota do wypłaty, tylko osoby z nr konta; import w bankowości elektronicznej" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"><Banknote size={15} /> Przelewy</a>}
        <Hint text="Eksport rozliczeń za wybrany miesiąc: CSV otwiera się w Excelu, PDF to gotowy wydruk (poziomy A4). Przelewy pobiera paczkę CSV do importu w banku (kwota do wypłaty, osoby z podanym nr konta). Zakres = to co widzisz (koordynator: tylko swoi pracownicy)." className="self-center" />
        {canEdit && <Hint text="Wpisuje WSZYSTKIM pracownikom sumę godzin z grafiku pracy za ten miesiąc (nadpisuje ręczne godziny). Pojedynczo robi to niebieski chip przy polu godzin." className="self-center" />}
        {!canEdit && <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">Tryb podglądu — stawki, godziny, zaliczki i potrącenia ustawia administrator</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5">Pracownik</th>
                <th className="px-3 py-2.5">Typ</th>
                <th className="px-3 py-2.5 w-24">Stawka</th>
                <th className="px-3 py-2.5 w-28">Godziny</th>
                <th className="px-3 py-2.5 text-right">Brutto</th>
                <th className="px-3 py-2.5 w-24"><span className="flex items-center gap-1">Premia + <Hint text="Premia uznaniowa za wyniki/osiągnięcia — DODAJE się do kwoty do wypłaty i wchodzi w koszty firmy." /></span></th>
                <th className="px-3 py-2.5 text-right">Zaliczki</th>
                <th className="px-3 py-2.5 text-right">Wypłacono</th>
                <th className="px-3 py-2.5 text-right w-24"><span className="flex items-center justify-end gap-1">Nocleg − <Hint text="Udział w czynszu = miesięczny czynsz obiektu ÷ całkowita liczba miejsc w lokalu (z Bazy noclegowej — także niezajętych). Liczony AUTOMATYCZNIE dla przypisanego noclegu i odejmowany od wypłaty. Aby zmienić — edytuj czynsz lub liczbę miejsc całkowitych w Bazie noclegowej." /></span></th>
                <th className="px-3 py-2.5 w-24"><span className="flex items-center gap-1">Mieszkanie − <Hint text="Ręczne potrącenie za zakwaterowanie (dodatkowe, poza automatycznym udziałem w czynszu) — ODEJMUJE się od wypłaty pracownika." /></span></th>
                <th className="px-3 py-2.5 w-28"><span className="flex items-center gap-1">Inne − <Hint text="Kary i inne nieprzewidziane koszty poniesione z winy pracownika — odejmowane od wypłaty; pod kwotą wpisz powód." /></span></th>
                <th className="px-3 py-2.5 text-right"><span className="flex items-center justify-end gap-1">Pozostało <Hint text="Do wypłaty = brutto + premia − zaliczki − wypłaty − nocleg (udział w czynszu) − potrącenia (mieszkanie i inne)." /></span></th>
                <th className="px-3 py-2.5 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(r => {
                const e: Edit = edits[r.employee.id] || { rate: '0', rate_type: 'hourly', hours: '0', bonus: '0', housing: '0', other: '0', other_note: '' };
                return (
                  <tr key={r.employee.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{fullName(r.employee)}</p>
                      <p className="text-xs text-slate-400">{r.employee.contract?.name || '—'}{r.employee.team ? ` · ${r.employee.team}` : ''}</p>
                    </td>
                    <td className="px-3 py-2">
                      <select value={e.rate_type} disabled={!canEdit} onChange={ev => setEdits(p => ({ ...p, [r.employee.id]: { ...e, rate_type: ev.target.value as any } }))} onBlur={() => saveRow(r.employee.id)} className={INPUT + (!canEdit ? ' bg-slate-50 text-slate-400' : '')}>
                        <option value="hourly">godzinowa</option>
                        <option value="monthly">miesięczna</option>
                      </select>
                    </td>
                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={e.rate} disabled={!canEdit} onChange={ev => setEdits(p => ({ ...p, [r.employee.id]: { ...e, rate: ev.target.value } }))} onBlur={() => saveRow(r.employee.id)} className={INPUT + (!canEdit ? ' bg-slate-50 text-slate-400' : '')} /></td>
                    <td className="px-3 py-2">
                      {/* godziny + przycisk grafiku W JEDNEJ LINII — niski wiersz */}
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" step="0.5" value={e.hours} disabled={!canEdit || e.rate_type === 'monthly'} onChange={ev => setEdits(p => ({ ...p, [r.employee.id]: { ...e, hours: ev.target.value } }))} onBlur={() => saveRow(r.employee.id)} className={INPUT + ((!canEdit || e.rate_type === 'monthly') ? ' bg-slate-50 text-slate-300' : '')} />
                        {canEdit && e.rate_type !== 'monthly' && r.schedule_hours > 0 && (
                          <button onClick={() => pullFromSchedule(r.employee.id)} title={`Przenieś godziny z grafiku (${r.schedule_hours} h)`}
                            className={`flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-semibold ring-1 transition ${Number(e.hours) === r.schedule_hours ? 'text-slate-400 ring-slate-200' : 'bg-primary-50 text-primary-700 ring-primary-200 hover:bg-primary-100'}`}>
                            <CalendarDays size={11} /> {r.schedule_hours}h
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{money(r.gross)}</td>
                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={e.bonus} disabled={!canEdit} title="Premia uznaniowa" onChange={ev => setEdits(p => ({ ...p, [r.employee.id]: { ...e, bonus: ev.target.value } }))} onBlur={() => saveRow(r.employee.id)} className={INPUT + (Number(e.bonus) > 0 ? ' font-semibold text-emerald-600' : '') + (!canEdit ? ' bg-slate-50' : '')} /></td>
                    <td className="px-3 py-2 text-right text-amber-600">{r.advances ? money(r.advances) : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.payouts ? money(r.payouts) : '—'}</td>
                    <td className="px-3 py-2 text-right" title={r.accommodation_name ? `Udział w czynszu: ${r.accommodation_name}` : 'Brak przypisanego noclegu'}>
                      {r.rent_share > 0 ? <span className="font-medium text-rose-600">{money(r.rent_share)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={e.housing} disabled={!canEdit} onChange={ev => setEdits(p => ({ ...p, [r.employee.id]: { ...e, housing: ev.target.value } }))} onBlur={() => saveRow(r.employee.id)} className={INPUT + (Number(e.housing) > 0 ? ' text-rose-600' : '') + (!canEdit ? ' bg-slate-50' : '')} /></td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={e.other} disabled={!canEdit} onChange={ev => setEdits(p => ({ ...p, [r.employee.id]: { ...e, other: ev.target.value } }))} onBlur={() => saveRow(r.employee.id)} className={INPUT + (Number(e.other) > 0 ? ' text-rose-600' : '') + (!canEdit ? ' bg-slate-50' : '')} />
                      {(Number(e.other) > 0 || e.other_note) && (
                        <input value={e.other_note} disabled={!canEdit} placeholder="powód (kara, koszt…)" onChange={ev => setEdits(p => ({ ...p, [r.employee.id]: { ...e, other_note: ev.target.value } }))} onBlur={() => saveRow(r.employee.id)} className="mt-1 w-full rounded border border-slate-100 px-2 py-1 text-[11px] text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-300 disabled:bg-slate-50" />
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${r.remaining > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{money(r.remaining)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && <button onClick={() => setEntryFor({ row: r, kind: 'advance' })} title="Dodaj zaliczkę" className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50"><HandCoins size={15} /></button>}
                        {canEdit && <button onClick={() => setEntryFor({ row: r, kind: 'payout' })} title="Wypłać" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><Banknote size={15} /></button>}
                        <button onClick={() => setHistoryFor(r)} title="Historia" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><History size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={13} className="px-4 py-10 text-center text-sm italic text-slate-300">Brak pracowników</td></tr>}
              {pageSize > 0 && filtered.length > pageSize && (
                <tr>
                  <td colSpan={13} className="px-3 py-2 text-center">
                    <button onClick={() => setPageSize(0)} className="text-xs font-semibold text-primary-600 hover:underline">Pokazano {pageSize} z {filtered.length} — pokaż wszystkich</button>
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-100 bg-slate-50/60 font-semibold text-slate-700">
                  <td className="px-3 py-2.5" colSpan={4}>Razem ({filtered.length})</td>
                  <td className="px-3 py-2.5 text-right">{money(totals.gross)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">{money(totals.bonus)}</td>
                  <td className="px-3 py-2.5 text-right text-amber-600">{money(totals.adv)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{money(totals.pay)}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600">{money(totals.rent)}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600">{money(totals.housing)}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600">{money(totals.other)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">{money(totals.rem)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Wynagrodzenia koordynatorów — ustawia administrator; auto-koszt w Księgowości */}
      <CoordinatorPay period={period} />

      {entryFor && <EntryModal row={entryFor.row} kind={entryFor.kind} period={period} onClose={() => setEntryFor(null)} onSaved={() => { setEntryFor(null); load(period); }} />}
      {historyFor && <HistoryModal row={historyFor} canEdit={canEdit} onClose={() => setHistoryFor(null)} onChanged={() => load(period)} />}
    </div>
  );
};

// ── Wynagrodzenia koordynatorów (stawka godzinowa lub kwota jednorazowa) ──────
interface CoordRow {
  user: { id: string; name: string; role: string };
  assigned_count: number; rate: number; rate_type: 'hourly' | 'flat'; hours: number; bonus: number; note?: string | null; amount: number;
}
interface CoordEdit { rate: string; rate_type: 'hourly' | 'flat'; hours: string; bonus: string; note: string }

function CoordinatorPay({ period }: { period: string }) {
  const [rows, setRows] = useState<CoordRow[]>([]);
  const [edits, setEdits] = useState<Record<string, CoordEdit>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/coordinator-pay?period=${period}`, { credentials: 'same-origin' });
      if (!r.ok) { setRows([]); return; }
      const d = await r.json();
      const rs: CoordRow[] = d.rows || [];
      setRows(rs);
      setCanEdit(!!d.canEdit);
      setEdits(Object.fromEntries(rs.map(x => [x.user.id, { rate: String(x.rate), rate_type: x.rate_type, hours: String(x.hours), bonus: String(x.bonus || 0), note: x.note || '' }])));
    } catch { /* */ } finally { setLoading(false); }
  }, [period]);
  useEffect(() => { load(); }, [load]);

  const save = async (id: string) => {
    const e = edits[id]; if (!e || !canEdit) return;
    try {
      const r = await fetch('/api/hr/coordinator-pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ user_id: id, period, rate: Number(e.rate) || 0, rate_type: e.rate_type, hours: Number(e.hours) || 0, bonus: Number(e.bonus) || 0, note: e.note }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); window.alert(d.error || 'Błąd zapisu'); return; }
      const d = await r.json();
      setRows(prev => prev.map(x => x.user.id === id ? { ...x, rate: Number(e.rate) || 0, rate_type: e.rate_type, hours: Number(e.hours) || 0, bonus: Number(e.bonus) || 0, note: e.note || null, amount: d.amount } : x));
    } catch { /* */ }
  };

  if (!loading && rows.length === 0) return null;
  const total = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <div className="mt-6">
      <div className="mb-2">
        <h3 className="font-sans text-base font-bold text-slate-900">Wynagrodzenia koordynatorów</h3>
        <p className="text-sm text-slate-500">Stawka godzinowa lub kwota jednorazowa za okres — {canEdit ? 'zapis od razu trafia do bilansu w Księgowości' : 'ustawia administrator; kwoty trafiają do Księgowości'}</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-8 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5">Koordynator</th>
                <th className="px-3 py-2.5"><span className="flex items-center gap-1">Typ wynagrodzenia <Hint text="Godzinowa: stawka × godziny. Jednorazowa: stała kwota za okres. Suma + premia trafia jako koszt do bilansu Księgowości." /></span></th>
                <th className="px-3 py-2.5 w-28">Stawka / kwota</th>
                <th className="px-3 py-2.5 w-24">Godziny</th>
                <th className="px-3 py-2.5 w-24"><span className="flex items-center gap-1">Premia + <Hint text="Premia uznaniowa za wyniki/osiągnięcia — DODAJE się do kwoty do wypłaty i wchodzi w koszty firmy." /></span></th>
                <th className="px-3 py-2.5">Notatka</th>
                <th className="px-3 py-2.5 text-right">Do wypłaty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const e = edits[r.user.id] || { rate: '0', rate_type: 'hourly' as const, hours: '0', bonus: '0', note: '' };
                return (
                  <tr key={r.user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{r.user.name}</p>
                      <p className="text-xs text-slate-400">{r.user.role}{r.assigned_count ? ` · ${r.assigned_count} przypisanych prac.` : ' · brak przypisanych'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <select value={e.rate_type} disabled={!canEdit} onChange={ev => setEdits(p => ({ ...p, [r.user.id]: { ...e, rate_type: ev.target.value as any } }))} onBlur={() => save(r.user.id)} className={INPUT + (!canEdit ? ' bg-slate-50 text-slate-400' : '')}>
                        <option value="hourly">godzinowa</option>
                        <option value="flat">jednorazowa</option>
                      </select>
                    </td>
                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={e.rate} disabled={!canEdit} onChange={ev => setEdits(p => ({ ...p, [r.user.id]: { ...e, rate: ev.target.value } }))} onBlur={() => save(r.user.id)} className={INPUT + (!canEdit ? ' bg-slate-50 text-slate-400' : '')} /></td>
                    <td className="px-3 py-2"><input type="number" min="0" step="0.5" value={e.hours} disabled={!canEdit || e.rate_type === 'flat'} onChange={ev => setEdits(p => ({ ...p, [r.user.id]: { ...e, hours: ev.target.value } }))} onBlur={() => save(r.user.id)} className={INPUT + ((!canEdit || e.rate_type === 'flat') ? ' bg-slate-50 text-slate-300' : '')} /></td>
                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={e.bonus} disabled={!canEdit} title="Premia uznaniowa" onChange={ev => setEdits(p => ({ ...p, [r.user.id]: { ...e, bonus: ev.target.value } }))} onBlur={() => save(r.user.id)} className={INPUT + (Number(e.bonus) > 0 ? ' font-semibold text-emerald-600' : '') + (!canEdit ? ' bg-slate-50' : '')} /></td>
                    <td className="px-3 py-2"><input value={e.note} disabled={!canEdit} placeholder="np. za wyniki, obsługa Radomska" onChange={ev => setEdits(p => ({ ...p, [r.user.id]: { ...e, note: ev.target.value } }))} onBlur={() => save(r.user.id)} className={INPUT + (!canEdit ? ' bg-slate-50 text-slate-400' : '')} /></td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{money(r.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-100 bg-slate-50/60 font-semibold text-slate-700">
                <td className="px-3 py-2.5" colSpan={6}>Razem ({rows.length})</td>
                <td className="px-3 py-2.5 text-right">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function EntryModal({ row, kind, period, onClose, onSaved }: { row: Row; kind: 'advance' | 'payout'; period: string; onClose: () => void; onSaved: () => void }) {
  const isAdvance = kind === 'advance';
  const [amount, setAmount] = useState(isAdvance ? '' : String(row.remaining > 0 ? row.remaining : ''));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) { setError('Podaj dodatnią kwotę'); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/hr/settlements/entry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ employee_id: row.employee.id, period, kind, amount: a, note }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Błąd'); }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={ev => ev.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-sans font-bold text-slate-900">{isAdvance ? 'Dodaj zaliczkę' : 'Wypłata'} — {fullName(row.employee)}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-slate-500">Pozostało do wypłaty: <span className="font-semibold text-slate-700">{money(row.remaining)}</span></p>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kwota (zł)</label>
        <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" autoFocus />
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notatka (opcjonalnie)</label>
        <input value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Anuluj</button>
          <button onClick={save} disabled={saving} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${isAdvance ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {isAdvance ? 'Dodaj zaliczkę' : 'Zapisz wypłatę'}</button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ row, canEdit, onClose, onChanged }: { row: Row; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/settlements/entry?employeeId=${row.employee.id}`, { credentials: 'same-origin' });
      const d = await r.json();
      setItems(d.items || []);
    } catch { /* */ } finally { setLoading(false); }
  }, [row.employee.id]);
  useEffect(() => { load(); }, [load]);

  const remove = async (it: any) => {
    if (!confirm('Usunąć ten wpis?')) return;
    await fetch(`/api/hr/settlements/entry?id=${it.id}&kind=${it.kind}`, { method: 'DELETE', credentials: 'same-origin' });
    await load(); onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={ev => ev.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-sans font-bold text-slate-900">Historia — {fullName(row.employee)}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8 text-slate-400"><Loader2 size={18} className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-300">Brak zaliczek i wypłat</p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {items.map(it => (
              <div key={it.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${it.kind === 'advance' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{it.kind === 'advance' ? 'Zaliczka' : 'Wypłata'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{money(Number(it.amount))}</p>
                  <p className="truncate text-xs text-slate-400">{it.period}{it.note ? ` · ${it.note}` : ''}</p>
                </div>
                {canEdit && <button onClick={() => remove(it)} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
