'use client';

// Księgowość → Kontrahenci: nabywcy faktur firmy (dane ręczne lub z GUS po NIP).
import React, { useState, useEffect, useCallback } from 'react';
import { Contact, Plus, Loader2, X, Check, Trash2, Pencil, Search } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

export interface Contractor { id: string; name: string; nip?: string | null; address?: string | null; city?: string | null; postal_code?: string | null; email?: string | null; phone?: string | null; notes?: string | null }

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const EMPTY = { name: '', nip: '', address: '', city: '', postal_code: '', email: '', phone: '', notes: '' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

export function KsiegKontrahenci({ companyId }: { companyId: string }) {
  const [list, setList] = useState<Contractor[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<null | { id?: string; form: any }>(null);
  const [busy, setBusy] = useState(false);
  const [gusBusy, setGusBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/accounting/contractors?company_id=${companyId}`, { credentials: 'same-origin' });
      const d = await r.json();
      if (r.ok) { setList(d.contractors || []); setCanEdit(!!d.can_edit); }
    } catch { /* */ } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const gus = async () => {
    const nip = String(edit?.form.nip || '').replace(/\D/g, '');
    if (nip.length !== 10) { window.alert('Wpisz 10-cyfrowy NIP'); return; }
    setGusBusy(true);
    try {
      const r = await fetch(`/api/companies/gus-lookup?nip=${nip}`, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Nie znaleziono');
      setEdit(e => e && ({ ...e, form: { ...e.form, name: d.name || e.form.name, address: d.address_street || e.form.address, city: d.address_city || e.form.city, postal_code: d.address_zip || e.form.postal_code } }));
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd GUS'); }
    finally { setGusBusy(false); }
  };

  const save = async () => {
    if (!edit || !edit.form.name.trim() || busy) return;
    setBusy(true);
    try {
      const r = edit.id
        ? await fetch(`/api/accounting/contractors/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(edit.form) })
        : await fetch('/api/accounting/contractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ ...edit.form, company_id: companyId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd zapisu');
      setEdit(null); load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const remove = async (c: Contractor) => {
    if (!window.confirm(`Usunąć kontrahenta „${c.name}"?`)) return;
    const r = await fetch(`/api/accounting/contractors/${c.id}`, { method: 'DELETE', credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { window.alert(d.error || 'Błąd'); return; }
    load();
  };

  const filtered = list.filter(c => !q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || (c.nip || '').includes(q.replace(/\D/g, '')));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Contact size={18} className="text-primary-600" />
        <h3 className="font-sans text-sm font-bold text-slate-900">Kontrahenci</h3>
        <Hint text="Nabywcy tej firmy. Dane możesz pobrać z rejestrów państwowych po NIP (przycisk GUS). Kontrahenta z fakturami nie da się usunąć — historia musi zostać." />
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj (nazwa, NIP)…" className="rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        {canEdit && <button onClick={() => setEdit({ form: { ...EMPTY } })} className="flex items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={14} /> Dodaj</button>}
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : (
        <div className="space-y-1.5">
          {filtered.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{c.name}</p>
                <p className="text-xs text-slate-400">{[c.nip ? `NIP ${c.nip}` : null, [c.address, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null, c.email].filter(Boolean).join(' · ')}</p>
              </div>
              {canEdit && (
                <>
                  <button onClick={() => setEdit({ id: c.id, form: { name: c.name, nip: c.nip || '', address: c.address || '', city: c.city || '', postal_code: c.postal_code || '', email: c.email || '', phone: c.phone || '', notes: c.notes || '' } })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil size={15} /></button>
                  <button onClick={() => remove(c)} className="rounded-lg p-2 text-rose-400 hover:bg-rose-50"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))}
          {!filtered.length && <p className="py-6 text-center text-sm italic text-slate-300">Brak kontrahentów{q ? ' dla wyszukiwania' : ' — dodaj pierwszego'}</p>}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold text-slate-900">{edit.id ? 'Edytuj kontrahenta' : 'Nowy kontrahent'}</h3>
              <button onClick={() => setEdit(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="NIP" hint="Po wpisaniu 10 cyfr kliknij GUS — nazwa i adres uzupełnią się z rejestrów.">
                <div className="flex gap-1.5">
                  <input value={edit.form.nip} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, nip: e.target.value } }))} className={INPUT} />
                  <button onClick={gus} disabled={gusBusy} className="flex shrink-0 items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50">{gusBusy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} GUS</button>
                </div>
              </Field>
              <Field label="Telefon"><input value={edit.form.phone} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, phone: e.target.value } }))} className={INPUT} /></Field>
              <div className="sm:col-span-2"><Field label="Nazwa *"><input value={edit.form.name} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, name: e.target.value } }))} className={INPUT} /></Field></div>
              <div className="sm:col-span-2"><Field label="Adres"><input value={edit.form.address} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, address: e.target.value } }))} className={INPUT} /></Field></div>
              <Field label="Kod pocztowy"><input value={edit.form.postal_code} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, postal_code: e.target.value } }))} className={INPUT} /></Field>
              <Field label="Miejscowość"><input value={edit.form.city} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, city: e.target.value } }))} className={INPUT} /></Field>
              <Field label="E-mail"><input value={edit.form.email} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, email: e.target.value } }))} className={INPUT} /></Field>
              <Field label="Notatki"><input value={edit.form.notes} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, notes: e.target.value } }))} className={INPUT} /></Field>
            </div>
            <button onClick={save} disabled={!edit.form.name.trim() || busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Zapisz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
