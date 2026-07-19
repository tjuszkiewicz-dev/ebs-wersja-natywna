'use client';

// Księgowość → Magazyn (produkty, stany, przyjęcia/wydania) + Środki trwałe (amortyzacja liniowa).
import React, { useState, useEffect, useCallback } from 'react';
import { Package, Landmark, Plus, Loader2, X, Check, Trash2, Pencil, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const money = (n: number) => Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

// ── MAGAZYN ──
export function KsiegMagazyn({ companyId }: { companyId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<null | { id?: string; form: any }>(null);
  const [move, setMove] = useState<null | { product: any; dir: 1 | -1; qty: string; reason: string }>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/products?company_id=${companyId}`, { credentials: 'same-origin' });
      const d = await r.json();
      if (r.ok) { setProducts(d.products || []); setCanEdit(!!d.can_edit); }
    } catch { /* */ } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit || !edit.form.name.trim() || busy) return;
    setBusy(true);
    try {
      const r = edit.id
        ? await fetch(`/api/accounting/products/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(edit.form) })
        : await fetch('/api/accounting/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ ...edit.form, company_id: companyId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setEdit(null); load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const doMove = async () => {
    if (!move || busy) return;
    const qty = Number(move.qty);
    if (!(qty > 0)) { window.alert('Podaj dodatnią ilość'); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/accounting/products/${move.product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ stock_delta: qty * move.dir, reason: move.reason || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setMove(null); load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const remove = async (p: any) => {
    if (!window.confirm(`Usunąć produkt „${p.name}"?`)) return;
    await fetch(`/api/accounting/products/${p.id}`, { method: 'DELETE', credentials: 'same-origin' });
    load();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Package size={18} className="text-primary-600" />
        <h3 className="font-sans text-sm font-bold text-slate-900">Magazyn</h3>
        <Hint text="Ewidencja produktów i stanów. Strzałki = przyjęcie/wydanie z magazynu (ruch loguje się w Rejestrze zdarzeń). Czerwony wykrzyknik = stan poniżej minimum." />
        {canEdit && <button onClick={() => setEdit({ form: { name: '', sku: '', unit: 'szt.', purchase_price: '', sale_price: '', vat_rate: '23', stock_qty: '0', min_qty: '' } })} className="ml-auto flex items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={14} /> Dodaj produkt</button>}
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Produkt</th><th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2 text-right">Cena zakupu</th><th className="px-3 py-2 text-right">Cena sprzedaży</th>
              <th className="px-3 py-2 text-right">Stan</th><th className="px-3 py-2 text-right">Wartość (zakup)</th><th className="px-3 py-2 text-right">Akcje</th>
            </tr></thead>
            <tbody>
              {products.map(p => {
                const low = p.min_qty != null && Number(p.stock_qty) < Number(p.min_qty);
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="px-3 py-2 text-slate-400">{p.sku || '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{p.purchase_price != null ? money(p.purchase_price) : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{p.sale_price != null ? money(p.sale_price) : '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {low && <AlertTriangle size={13} className="mr-1 inline text-rose-500" />}
                      <span className={low ? 'text-rose-600' : 'text-slate-800'}>{Number(p.stock_qty)} {p.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{p.purchase_price != null ? money(Number(p.stock_qty) * Number(p.purchase_price)) : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button onClick={() => setMove({ product: p, dir: 1, qty: '', reason: '' })} title="Przyjęcie na magazyn" className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50"><ArrowDownToLine size={15} /></button>
                            <button onClick={() => setMove({ product: p, dir: -1, qty: '', reason: '' })} title="Wydanie z magazynu" className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50"><ArrowUpFromLine size={15} /></button>
                            <button onClick={() => setEdit({ id: p.id, form: { name: p.name, sku: p.sku || '', unit: p.unit, purchase_price: p.purchase_price ?? '', sale_price: p.sale_price ?? '', vat_rate: String(p.vat_rate ?? 23), min_qty: p.min_qty ?? '' } })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Pencil size={15} /></button>
                            <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50"><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!products.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm italic text-slate-300">Magazyn pusty — dodaj pierwszy produkt</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold text-slate-900">{edit.id ? 'Edytuj produkt' : 'Nowy produkt'}</h3>
              <button onClick={() => setEdit(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Nazwa *"><input value={edit.form.name} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, name: e.target.value } }))} className={INPUT} /></Field></div>
              <Field label="SKU / kod"><input value={edit.form.sku} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, sku: e.target.value } }))} className={INPUT} /></Field>
              <Field label="Jednostka"><input value={edit.form.unit} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, unit: e.target.value } }))} className={INPUT} /></Field>
              <Field label="Cena zakupu netto"><input type="number" min="0" step="0.01" value={edit.form.purchase_price} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, purchase_price: e.target.value } }))} className={INPUT} /></Field>
              <Field label="Cena sprzedaży netto"><input type="number" min="0" step="0.01" value={edit.form.sale_price} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, sale_price: e.target.value } }))} className={INPUT} /></Field>
              {!edit.id && <Field label="Stan początkowy"><input type="number" min="0" step="0.001" value={edit.form.stock_qty} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, stock_qty: e.target.value } }))} className={INPUT} /></Field>}
              <Field label="Stan minimalny" hint="Poniżej tej ilości produkt podświetla się na czerwono."><input type="number" min="0" step="0.001" value={edit.form.min_qty} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, min_qty: e.target.value } }))} className={INPUT} /></Field>
            </div>
            <button onClick={save} disabled={!edit.form.name.trim() || busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Zapisz
            </button>
          </div>
        </div>
      )}

      {move && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold text-slate-900">{move.dir > 0 ? 'Przyjęcie' : 'Wydanie'} — {move.product.name}</h3>
              <button onClick={() => setMove(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <p className="mb-2 text-xs text-slate-400">Obecny stan: {Number(move.product.stock_qty)} {move.product.unit}</p>
            <Field label={`Ilość (${move.product.unit}) *`}><input type="number" min="0" step="0.001" autoFocus value={move.qty} onChange={e => setMove(m => m && ({ ...m, qty: e.target.value }))} className={INPUT} /></Field>
            <div className="mt-2"><Field label="Powód / dokument"><input value={move.reason} onChange={e => setMove(m => m && ({ ...m, reason: e.target.value }))} className={INPUT} placeholder="np. WZ 12/2026, zakup FV…" /></Field></div>
            <button onClick={doMove} disabled={busy} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40 ${move.dir > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {move.dir > 0 ? 'Przyjmij' : 'Wydaj'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ŚRODKI TRWAŁE ──
const ASSET_STATUS: Record<string, [string, string]> = {
  active: ['w użyciu', 'bg-emerald-50 text-emerald-700'],
  sold: ['sprzedany', 'bg-slate-100 text-slate-500'],
  liquidated: ['zlikwidowany', 'bg-slate-100 text-slate-400'],
  fully_amortized: ['umorzony', 'bg-sky-50 text-sky-700'],
};

export function KsiegSrodkiTrwale({ companyId }: { companyId: string }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<null | any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/assets?company_id=${companyId}`, { credentials: 'same-origin' });
      const d = await r.json();
      if (r.ok) { setAssets(d.assets || []); setCanEdit(!!d.can_edit); }
    } catch { /* */ } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form?.name?.trim() || !form?.purchase_date || !(Number(form.initial_value) > 0) || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/accounting/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ ...form, company_id: companyId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd');
      setForm(null); load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const setStatus = async (a: any, status: string) => {
    await fetch(`/api/accounting/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status }) });
    load();
  };
  const remove = async (a: any) => {
    if (!window.confirm(`Usunąć środek trwały „${a.name}"?`)) return;
    await fetch(`/api/accounting/assets/${a.id}`, { method: 'DELETE', credentials: 'same-origin' });
    load();
  };

  const sums = assets.filter(a => a.status === 'active').reduce((s, a) => ({ init: s.init + Number(a.initial_value), rem: s.rem + Number(a.remaining), mon: s.mon + Number(a.monthly_write) }), { init: 0, rem: 0, mon: 0 });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Landmark size={18} className="text-primary-600" />
        <h3 className="font-sans text-sm font-bold text-slate-900">Środki trwałe</h3>
        <Hint text="Ewidencja majątku z amortyzacją liniową: odpis miesięczny = wartość × stawka roczna ÷ 12, naliczany od miesiąca po zakupie. Odpis za bieżący miesiąc wchodzi AUTOMATYCZNIE w koszty bilansu. Typowe stawki: komputery 30%, samochody 20%, maszyny 10-20%, budynki 2,5%." />
        {canEdit && <button onClick={() => setForm({ name: '', purchase_date: new Date().toISOString().slice(0, 10), initial_value: '', amortization_rate: '20', notes: '' })} className="ml-auto flex items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={14} /> Dodaj środek</button>}
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Nazwa</th><th className="px-3 py-2">Zakup</th>
              <th className="px-3 py-2 text-right">Wartość pocz.</th><th className="px-3 py-2 text-right">Stawka</th>
              <th className="px-3 py-2 text-right">Odpis/mc</th><th className="px-3 py-2 text-right">Umorzone</th>
              <th className="px-3 py-2 text-right">Pozostało</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Akcje</th>
            </tr></thead>
            <tbody>
              {assets.map(a => {
                const [sl, sc] = ASSET_STATUS[a.fully_amortized && a.status === 'active' ? 'fully_amortized' : a.status] || ASSET_STATUS.active;
                return (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-800">{a.name}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(a.purchase_date).toLocaleDateString('pl-PL')}</td>
                    <td className="px-3 py-2 text-right">{money(a.initial_value)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{a.amortization_rate}%</td>
                    <td className="px-3 py-2 text-right text-slate-600">{money(a.monthly_write)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{money(a.written_off)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(a.remaining)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sc}`}>{sl}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && a.status === 'active' && (
                          <>
                            <button onClick={() => setStatus(a, 'sold')} title="Oznacz jako sprzedany (koniec odpisów)" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100">sprzedany</button>
                            <button onClick={() => setStatus(a, 'liquidated')} title="Likwidacja" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100">likwidacja</button>
                          </>
                        )}
                        {canEdit && <button onClick={() => remove(a)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!assets.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm italic text-slate-300">Brak środków trwałych</td></tr>}
            </tbody>
            {assets.length > 0 && (
              <tfoot><tr className="border-t-2 border-slate-100 bg-slate-50/60 font-semibold text-slate-700">
                <td className="px-3 py-2" colSpan={2}>Razem (w użyciu)</td>
                <td className="px-3 py-2 text-right">{money(sums.init)}</td><td />
                <td className="px-3 py-2 text-right text-rose-600">{money(sums.mon)}</td><td />
                <td className="px-3 py-2 text-right">{money(sums.rem)}</td><td colSpan={2} />
              </tr></tfoot>
            )}
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold text-slate-900">Nowy środek trwały</h3>
              <button onClick={() => setForm(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <div className="space-y-3">
              <Field label="Nazwa *"><input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className={INPUT} placeholder="np. Laptop Dell, Ford Transit…" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data zakupu *"><input type="date" value={form.purchase_date} onChange={e => setForm((f: any) => ({ ...f, purchase_date: e.target.value }))} className={INPUT} /></Field>
                <Field label="Wartość początkowa (zł) *"><input type="number" min="0" step="0.01" value={form.initial_value} onChange={e => setForm((f: any) => ({ ...f, initial_value: e.target.value }))} className={INPUT} /></Field>
                <Field label="Stawka roczna (%)" hint="Amortyzacja liniowa. Komputery 30%, auta 20%, maszyny 10-20%, budynki 2,5%."><input type="number" min="0.1" max="100" step="0.1" value={form.amortization_rate} onChange={e => setForm((f: any) => ({ ...f, amortization_rate: e.target.value }))} className={INPUT} /></Field>
                <Field label="Notatki"><input value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} className={INPUT} /></Field>
              </div>
              {Number(form.initial_value) > 0 && <p className="text-xs text-slate-500">Odpis miesięczny: <strong>{money(Number(form.initial_value) * (Number(form.amortization_rate) || 20) / 100 / 12)} zł</strong> — wejdzie automatycznie w koszty bilansu od miesiąca po zakupie.</p>}
            </div>
            <button onClick={save} disabled={!form.name.trim() || !(Number(form.initial_value) > 0) || busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Zapisz środek trwały
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
