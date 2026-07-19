'use client';

// Księgowość → Firmy: lista firm użytkownika (admin widzi wszystkie), zakładanie,
// edycja danych i zarządzanie członkami (właściciel/księgowa/podgląd).
// KSeF (token/środowisko) świadomie wykluczone z E4 — faktury sprzedażowe idą przez Fakturownię.
import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Loader2, X, Check, Trash2, Users, Pencil, Search } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

export interface Company { id: string; name: string; nip?: string | null; regon?: string | null; address?: string | null; city?: string | null; postal_code?: string | null; email?: string | null; phone?: string | null; bank_account?: string | null; invoice_prefix?: string; hr_linked?: boolean; member_role: string }
interface Member { user_id: string; role: string; name: string }

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const ROLE_PL: Record<string, string> = { owner: 'właściciel', ksiegowa: 'księgowa', podglad: 'podgląd', admin: 'admin systemu' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className={LABEL + ' flex items-center gap-1'}>{label}{hint && <Hint text={hint} />}</p><div className="mt-1">{children}</div></div>;
}

const EMPTY = { name: '', nip: '', address: '', city: '', postal_code: '', email: '', phone: '', bank_account: '', invoice_prefix: 'FV' };

export function KsiegFirmy({ onChanged }: { onChanged: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<null | { id?: string; form: any }>(null);
  const [membersFor, setMembersFor] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const [gusBusy, setGusBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/accounting/companies', { credentials: 'same-origin' });
      const d = await r.json();
      if (r.ok) { setCompanies(d.companies || []); setCanCreate(!!d.can_create); }
    } catch { /* */ } finally { setLoading(false); }
  }, []);
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
        ? await fetch(`/api/accounting/companies/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(edit.form) })
        : await fetch('/api/accounting/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(edit.form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd zapisu');
      setEdit(null); load(); onChanged();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Building2 size={18} className="text-primary-600" />
        <h3 className="font-sans text-sm font-bold text-slate-900">Firmy w Księgowości</h3>
        <Hint text="Każda firma ma osobne wpisy, kontrahentów, bilans i numerację. Członkowie: właściciel (pełna edycja + zarządzanie), księgowa (prowadzi księgi), podgląd (tylko odczyt). Administratorzy systemu widzą wszystkie firmy." />
        {canCreate && (
          <button onClick={() => setEdit({ form: { ...EMPTY } })} className="ml-auto flex items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={14} /> Załóż firmę</button>
        )}
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-slate-300" /></div> : (
        <div className="space-y-2">
          {companies.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{c.name} {c.hr_linked && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-600" title="Bilans tej firmy dolicza automatyczne składniki Agencji Pracy (wypłaty, czynsze, koordynatorzy)">Agencja</span>}</p>
                <p className="text-xs text-slate-400">{[c.nip ? `NIP ${c.nip}` : null, [c.postal_code, c.city].filter(Boolean).join(' ') || null, `numeracja ${c.invoice_prefix || 'FV'}/N/RRRR`].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{ROLE_PL[c.member_role] || c.member_role}</span>
              {(c.member_role === 'owner' || c.member_role === 'admin') && (
                <>
                  <button onClick={() => setEdit({ id: c.id, form: { name: c.name, nip: c.nip || '', address: c.address || '', city: c.city || '', postal_code: c.postal_code || '', email: c.email || '', phone: c.phone || '', bank_account: c.bank_account || '', invoice_prefix: c.invoice_prefix || 'FV' } })} title="Edytuj dane firmy" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil size={15} /></button>
                  <button onClick={() => setMembersFor(c)} title="Członkowie (kto prowadzi firmę)" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Users size={15} /></button>
                </>
              )}
            </div>
          ))}
          {!companies.length && <p className="py-6 text-center text-sm italic text-slate-300">Nie należysz do żadnej firmy — poproś właściciela o dodanie albo załóż własną.</p>}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-sans text-sm font-bold text-slate-900">{edit.id ? 'Edytuj firmę' : 'Nowa firma'}</h3>
              <button onClick={() => setEdit(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Nazwa *" hint="Pełna nazwa firmy."><input value={edit.form.name} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, name: e.target.value } }))} className={INPUT} /></Field></div>
              <Field label="NIP" hint="10 cyfr. Przycisk GUS pobierze nazwę i adres z rejestrów państwowych.">
                <div className="flex gap-1.5">
                  <input value={edit.form.nip} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, nip: e.target.value } }))} className={INPUT} placeholder="5252992995" />
                  <button onClick={gus} disabled={gusBusy} className="flex shrink-0 items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50">{gusBusy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} GUS</button>
                </div>
              </Field>
              <Field label="Prefiks numeracji" hint="np. FV/12/2026."><input value={edit.form.invoice_prefix} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, invoice_prefix: e.target.value } }))} className={INPUT} /></Field>
              <div className="sm:col-span-2"><Field label="Adres"><input value={edit.form.address} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, address: e.target.value } }))} className={INPUT} placeholder="ul. Przykładowa 1" /></Field></div>
              <Field label="Kod pocztowy"><input value={edit.form.postal_code} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, postal_code: e.target.value } }))} className={INPUT} /></Field>
              <Field label="Miejscowość"><input value={edit.form.city} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, city: e.target.value } }))} className={INPUT} /></Field>
              <Field label="E-mail"><input value={edit.form.email} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, email: e.target.value } }))} className={INPUT} /></Field>
              <Field label="Telefon"><input value={edit.form.phone} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, phone: e.target.value } }))} className={INPUT} /></Field>
              <div className="sm:col-span-2"><Field label="Rachunek bankowy"><input value={edit.form.bank_account} onChange={e => setEdit(p => p && ({ ...p, form: { ...p.form, bank_account: e.target.value } }))} className={INPUT} /></Field></div>
            </div>
            <button onClick={save} disabled={!edit.form.name.trim() || busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Zapisz firmę
            </button>
          </div>
        </div>
      )}

      {membersFor && <MembersModal company={membersFor} onClose={() => setMembersFor(null)} />}
    </div>
  );
}

function MembersModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; role: string }[]>([]);
  const [sel, setSel] = useState('');
  const [selRole, setSelRole] = useState('ksiegowa');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rm, ru] = await Promise.all([
        fetch(`/api/accounting/companies/${company.id}`, { credentials: 'same-origin' }),
        fetch('/api/users', { credentials: 'same-origin' }),
      ]);
      const dm = rm.ok ? await rm.json() : { members: [] };
      const du = ru.ok ? await ru.json() : [];
      setMembers(dm.members || []);
      setContacts((Array.isArray(du) ? du : []).map((u: any) => ({ id: u.id, name: u.full_name || u.email || u.id, role: u.role })));
    } catch { /* */ } finally { setLoading(false); }
  }, [company.id]);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string, user_id: string, member_role?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/accounting/companies/${company.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action, user_id, member_role }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Błąd');
      load();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setBusy(false); }
  };

  const available = contacts.filter(c => !members.some(m => m.user_id === c.id));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sans text-sm font-bold text-slate-900">Członkowie — {company.name}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-slate-300" /></div> : (
          <>
            <div className="space-y-1.5">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{m.name}</p>
                  <select value={m.role} disabled={busy} onChange={e => act('set_role', m.user_id, e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                    <option value="owner">właściciel</option><option value="ksiegowa">księgowa</option><option value="podglad">podgląd</option>
                  </select>
                  <button onClick={() => window.confirm(`Usunąć ${m.name} z firmy?`) && act('remove', m.user_id)} disabled={busy} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-3">
              <select value={sel} onChange={e => setSel(e.target.value)} className={INPUT}>
                <option value="">— wybierz osobę —</option>
                {available.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
              </select>
              <select value={selRole} onChange={e => setSelRole(e.target.value)} className={INPUT + ' w-32'}>
                <option value="ksiegowa">księgowa</option><option value="owner">właściciel</option><option value="podglad">podgląd</option>
              </select>
              <button onClick={() => sel && act('add', sel, selRole)} disabled={!sel || busy} className="shrink-0 rounded-lg bg-primary-600 px-3 text-white disabled:opacity-40"><Plus size={15} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
