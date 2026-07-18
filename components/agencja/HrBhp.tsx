'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HardHat, Loader2, Plus, Trash2, PackageCheck, RotateCcw, Boxes, X } from 'lucide-react';
import { fullName } from '@/lib/hr/docPlaceholders';

interface Item { id: string; name: string; category: string | null; unit_cost: number; stock: number | null; sizes: string | null }
interface Issue { id: string; employee_id: string; employee_name: string; item_name: string; size: string | null; quantity: number; unit_cost: number; wartosc: number; issued_at: string; returned_at: string | null; acc_entry_id: string | null }
interface EmpOpt { id: string; name: string; shoe_size?: string | null; clothing_size?: string | null }

const zl = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const d = (s: string) => new Date(s).toLocaleDateString('pl-PL');
const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300';

export function HrBhp() {
  const [items, setItems] = useState<Item[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  // formularz wydania
  const [empId, setEmpId] = useState('');
  const [empQ, setEmpQ] = useState('');
  const [itemName, setItemName] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  // formularz katalogu
  const [newItem, setNewItem] = useState({ name: '', category: '', unit_cost: '', stock: '', sizes: '' });

  const load = useCallback(async () => {
    try {
      const [ri, rs, re] = await Promise.all([
        fetch('/api/hr/bhp/items', { credentials: 'same-origin' }),
        fetch('/api/hr/bhp/issues', { credentials: 'same-origin' }),
        fetch('/api/hr/employees', { credentials: 'same-origin' }),
      ]);
      const [di, ds, de] = await Promise.all([ri.json(), rs.json(), re.json()]);
      if (ri.ok) setItems(di.items || []);
      if (rs.ok) { setIssues(ds.issues || []); setCanDelete(!!ds.can_delete); }
      if (re.ok) setEmps((de.employees || []).map((e: any) => ({ id: e.id, name: fullName(e), shoe_size: e.shoe_size, clothing_size: e.clothing_size })));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selectedEmp = emps.find(e => e.id === empId);

  const pickCatalog = (name: string) => {
    const it = items.find(i => i.name === name);
    setItemName(name);
    if (it) setUnitCost(it.unit_cost ? String(it.unit_cost) : '');
  };

  const issue = async () => {
    if (!empId || !itemName.trim() || busy) return;
    setBusy(true);
    try {
      const item = items.find(i => i.name === itemName);
      const r = await fetch('/api/hr/bhp/issues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ employee_id: empId, item_id: item?.id, item_name: itemName.trim(), size: size.trim() || null, quantity: Number(qty) || 1, unit_cost: Number(unitCost) || 0 }) });
      const dj = await r.json();
      if (!r.ok) throw new Error(dj.error || 'Błąd');
      setItemName(''); setSize(''); setQty('1'); setUnitCost('');
      await load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); } finally { setBusy(false); }
  };

  const toggleReturn = async (i: Issue) => {
    await fetch(`/api/hr/bhp/issues?id=${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ returned_at: i.returned_at ? null : undefined }) });
    load();
  };
  const del = async (i: Issue) => { if (!window.confirm('Usunąć wydanie (usunie też koszt z bilansu)?')) return; await fetch(`/api/hr/bhp/issues?id=${i.id}`, { method: 'DELETE', credentials: 'same-origin' }); load(); };

  const addItem = async () => {
    if (!newItem.name.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/hr/bhp/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(newItem) });
      if (!r.ok) throw new Error((await r.json()).error || 'Błąd');
      setNewItem({ name: '', category: '', unit_cost: '', stock: '', sizes: '' }); await load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); } finally { setBusy(false); }
  };
  const delItem = async (id: string) => { if (!window.confirm('Usunąć pozycję z katalogu?')) return; await fetch(`/api/hr/bhp/items?id=${id}`, { method: 'DELETE', credentials: 'same-origin' }); load(); };

  if (loading) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Ładowanie magazynu BHP…</div>;

  const filteredEmps = emps.filter(e => !empQ.trim() || e.name.toLowerCase().includes(empQ.toLowerCase()));
  const wydano = issues.filter(i => !i.returned_at).reduce((a, i) => a + i.wartosc, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><HardHat size={19} className="text-primary-600" /> Magazyn BHP / sprzętu</h2>
          <p className="text-sm text-slate-500">Wydawanie odzieży, obuwia i sprzętu pracownikom. Koszty trafiają automatycznie do bilansu Księgowości.</p>
        </div>
        <button onClick={() => setShowCatalog(v => !v)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Boxes size={15} /> Katalog ({items.length})</button>
      </div>

      {/* Katalog (zwijany) */}
      {showCatalog && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-sans font-bold text-slate-900">Katalog pozycji</h3>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
            <input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Nazwa*" className={INPUT + ' sm:col-span-2'} />
            <input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="Kategoria" className={INPUT} />
            <input value={newItem.unit_cost} onChange={e => setNewItem({ ...newItem, unit_cost: e.target.value })} placeholder="Cena/szt" type="number" className={INPUT} />
            <input value={newItem.stock} onChange={e => setNewItem({ ...newItem, stock: e.target.value })} placeholder="Stan" type="number" className={INPUT} />
            <button onClick={addItem} disabled={!newItem.name.trim() || busy} className="flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus size={15} /> Dodaj</button>
          </div>
          <div className="divide-y divide-slate-100">
            {items.length === 0 && <p className="py-3 text-sm italic text-slate-300">Katalog pusty — dodaj pozycje (np. „Buty robocze S3", „Kurtka zimowa").</p>}
            {items.map(it => (
              <div key={it.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="flex-1 font-medium text-slate-700">{it.name}{it.category ? <span className="ml-2 text-xs text-slate-400">{it.category}</span> : null}</span>
                {it.unit_cost > 0 && <span className="text-slate-500">{zl(it.unit_cost)}</span>}
                {it.stock != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">stan: {it.stock}</span>}
                <button onClick={() => delItem(it.id)} className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wydanie */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 font-sans font-bold text-slate-900"><PackageCheck size={17} className="text-emerald-500" /> Wydaj sprzęt / odzież</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pracownik</p>
            <input value={empQ} onChange={e => setEmpQ(e.target.value)} placeholder="Szukaj pracownika…" className={INPUT} />
            {empQ.trim() && !empId && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-100">
                {filteredEmps.slice(0, 30).map(e => (
                  <button key={e.id} onClick={() => { setEmpId(e.id); setEmpQ(e.name); }} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50">{e.name}</button>
                ))}
              </div>
            )}
            {empId && selectedEmp && (
              <p className="mt-1 flex items-center gap-2 text-[12px] text-slate-500">
                Wybrany: <b>{selectedEmp.name}</b>
                {(selectedEmp.shoe_size || selectedEmp.clothing_size) && <span className="text-slate-400">(but {selectedEmp.shoe_size || '—'} / ubranie {selectedEmp.clothing_size || '—'})</span>}
                <button onClick={() => { setEmpId(''); setEmpQ(''); }} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pozycja</p>
            <input list="bhp-items" value={itemName} onChange={e => pickCatalog(e.target.value)} placeholder="Nazwa (lub z katalogu)" className={INPUT} />
            <datalist id="bhp-items">{items.map(i => <option key={i.id} value={i.name} />)}</datalist>
          </div>
          <div className="grid grid-cols-3 gap-2 md:col-span-2">
            <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rozmiar</p><input value={size} onChange={e => setSize(e.target.value)} placeholder="np. 42 / L" className={INPUT} /></div>
            <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ilość</p><input value={qty} onChange={e => setQty(e.target.value)} type="number" min={1} className={INPUT} /></div>
            <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cena/szt (zł)</p><input value={unitCost} onChange={e => setUnitCost(e.target.value)} type="number" placeholder="0" className={INPUT} /></div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">Wartość: <b className="text-slate-800">{zl((Number(unitCost) || 0) * (Number(qty) || 1))}</b> {(Number(unitCost) || 0) > 0 && <span className="text-[12px] text-slate-400">→ koszt w bilansie</span>}</p>
          <button onClick={issue} disabled={!empId || !itemName.trim() || busy} className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />} Wydaj</button>
        </div>
      </div>

      {/* Historia wydań */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-sans font-bold text-slate-900">Wydania ({issues.length})</h3>
          <span className="text-sm text-slate-500">Na stanie u pracowników: <b>{zl(wydano)}</b></span>
        </div>
        {issues.length === 0 ? <p className="py-4 text-sm italic text-slate-300">Brak wydań</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2">Pracownik</th><th className="pr-2">Pozycja</th><th className="pr-2">Rozm.</th><th className="pr-2">Il.</th><th className="pr-2">Wartość</th><th className="pr-2">Wydano</th><th className="pr-2">Status</th><th></th>
              </tr></thead>
              <tbody>
                {issues.map(i => (
                  <tr key={i.id} className="border-b border-slate-50">
                    <td className="py-2 pr-2 font-medium text-slate-700">{i.employee_name}</td>
                    <td className="pr-2 text-slate-600">{i.item_name}</td>
                    <td className="pr-2 text-slate-500">{i.size || '—'}</td>
                    <td className="pr-2 text-slate-500">{i.quantity}</td>
                    <td className="pr-2 text-slate-600">{i.wartosc ? zl(i.wartosc) : '—'}</td>
                    <td className="pr-2 text-slate-500">{d(i.issued_at)}</td>
                    <td className="pr-2">
                      {i.returned_at
                        ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">zwrócono {d(i.returned_at)}</span>
                        : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">u pracownika</span>}
                    </td>
                    <td className="whitespace-nowrap pr-1 text-right">
                      <button onClick={() => toggleReturn(i)} title={i.returned_at ? 'Cofnij zwrot' : 'Oznacz zwrot'} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><RotateCcw size={14} /></button>
                      {canDelete && <button onClick={() => del(i)} title="Usuń" className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
