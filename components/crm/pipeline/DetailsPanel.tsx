'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin, FileText, Loader2,
  ArrowUpRight, ArrowDownLeft, Building2, User, Phone, Mail, X,
  Users, Hash, Trash2, Sparkles, ExternalLink, FileBarChart, Inbox,
  Pencil, Save, UserPlus,
} from 'lucide-react';
import type { Lead, Contact } from './pipelineTypes';
import { COLUMNS, STATUS_LABEL, SOURCE_OPTIONS, SOURCE_LABEL } from './pipelineConfig';
import { OpiekunBlock } from './OpiekunBlock';

// ─── Panel boczny szczegółów ──────────────────────────────────────────────────

// Stałe + pomocnicze komponenty na poziomie modułu — MUSZĄ być poza DetailsPanel,
// inaczej re-render (np. przy wpisywaniu) przemontowuje inputy i gubi focus.
const DP_INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const DP_INPUT_SM = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-300';
const DP_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="mt-0.5 text-primary-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className={DP_LABEL}>{label}</p>
        <p className="text-sm text-slate-800 break-words">{value || <span className="text-slate-300">—</span>}</p>
      </div>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <p className={DP_LABEL}>{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function DetailsPanel({
  lead,
  onClose,
  onDeleted,
  onUpdated,
}: {
  lead: Lead | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated?: (lead: Lead) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const open = lead !== null;

  const [offers, setOffers] = useState<any[]>([]);
  const [corr, setCorr] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [loadingCorr, setLoadingCorr] = useState(false);

  // ── Tryb edycji ──
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const money = (n: number) => Math.round(n || 0).toLocaleString('pl-PL') + ' zł';

  useEffect(() => { setEditing(false); setForm(null); setSaveError(null); }, [lead?.id]);

  useEffect(() => {
    if (!lead) { setOffers([]); setCorr([]); return; }
    let cancelled = false;
    setLoadingOffers(true);
    fetch(`/api/crm/offers?leadId=${lead.id}`, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { offers: [] }))
      .then(d => { if (!cancelled) setOffers(d.offers || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingOffers(false); });

    if (lead.email) {
      setLoadingCorr(true);
      fetch(`/api/crm/mail/by-contact?email=${encodeURIComponent(lead.email)}`, { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : { messages: [] }))
        .then(d => { if (!cancelled) setCorr(d.messages || []); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoadingCorr(false); });
    } else {
      setCorr([]);
    }
    return () => { cancelled = true; };
  }, [lead?.id, lead?.email]);

  const startEdit = () => {
    if (!lead) return;
    setForm({
      name: lead.name ?? '', nip: lead.nip ?? '', city: lead.city ?? '',
      contact_person: lead.contact_person ?? '', email: lead.email ?? '', phone: lead.phone ?? '',
      source: lead.source ?? 'manual', status: lead.status, notes: lead.notes ?? '',
      contacts: Array.isArray(lead.contacts) ? lead.contacts.map(c => ({ ...c })) : [],
    });
    setSaveError(null);
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setForm(null); setSaveError(null); };
  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setContact = (i: number, k: string, v: string) => setForm((f: any) => {
    const c = [...f.contacts]; c[i] = { ...c[i], [k]: v }; return { ...f, contacts: c };
  });
  const addContact = () => setForm((f: any) => ({ ...f, contacts: [...f.contacts, { name: '', role: '', email: '', phone: '' }] }));
  const removeContact = (i: number) => setForm((f: any) => ({ ...f, contacts: f.contacts.filter((_: any, j: number) => j !== i) }));

  const save = async () => {
    if (!lead || !form) return;
    if (!form.name.trim()) { setSaveError('Nazwa firmy jest wymagana'); return; }
    setSaving(true); setSaveError(null);
    try {
      const payload = {
        name: form.name.trim(), nip: form.nip.trim() || null, city: form.city.trim() || null,
        contact_person: form.contact_person.trim() || null, email: form.email.trim() || null,
        phone: form.phone.trim() || null, source: form.source, status: form.status,
        notes: form.notes.trim() || null,
        contacts: form.contacts
          .map((c: any) => ({ name: (c.name || '').trim(), role: (c.role || '').trim(), email: (c.email || '').trim(), phone: (c.phone || '').trim() }))
          .filter((c: any) => c.name || c.email || c.phone || c.role),
      };
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd zapisu');
      setEditing(false); setForm(null);
      onUpdated?.(data);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    if (!confirm(`Usunąć klienta „${lead.name}"? Tej operacji nie można cofnąć.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Błąd usuwania');
      onDeleted(lead.id);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Nie udało się usunąć klienta');
    } finally {
      setDeleting(false);
    }
  };

  const inputCls = DP_INPUT;
  const inputSm = DP_INPUT_SM;
  const labelCls = DP_LABEL;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={() => { if (!editing) onClose(); }} />}
      <aside
        className={[
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header z gradientem brandu */}
        <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-primary-600 to-primary-500 px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{editing ? 'Edycja karty klienta' : 'Karta klienta'}</p>
            <h3 className="font-display text-lg font-bold leading-tight truncate">{(editing ? form?.name : lead?.name) || 'Karta klienta'}</h3>
            {lead && !editing && (
              <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                {STATUS_LABEL[lead.status]}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {lead && editing && form && (
            <>
              <EditField label="Nazwa firmy *"><input value={form.name} onChange={e => setField('name', e.target.value)} className={inputCls} placeholder="Np. ABC Sp. z o.o." /></EditField>
              <EditField label="NIP"><input value={form.nip} onChange={e => setField('nip', e.target.value)} className={inputCls} placeholder="0000000000" /></EditField>
              <EditField label="Miasto"><input value={form.city} onChange={e => setField('city', e.target.value)} className={inputCls} placeholder="Warszawa" /></EditField>
              <EditField label="Osoba decyzyjna"><input value={form.contact_person} onChange={e => setField('contact_person', e.target.value)} className={inputCls} placeholder="Jan Kowalski" /></EditField>
              <EditField label="E-mail"><input type="email" value={form.email} onChange={e => setField('email', e.target.value)} className={inputCls} placeholder="jan@firma.pl" /></EditField>
              <EditField label="Telefon"><input value={form.phone} onChange={e => setField('phone', e.target.value)} className={inputCls} placeholder="+48 000 000 000" /></EditField>
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Źródło">
                  <select value={form.source} onChange={e => setField('source', e.target.value)} className={inputCls}>
                    {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    {!SOURCE_OPTIONS.find(s => s.value === form.source) && <option value={form.source}>{form.source}</option>}
                  </select>
                </EditField>
                <EditField label="Status">
                  <select value={form.status} onChange={e => setField('status', e.target.value)} className={inputCls}>
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </EditField>
              </div>
              <EditField label="Notatki"><textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} className={inputCls + ' resize-y'} placeholder="Notatki o kliencie…" /></EditField>

              {/* Osoby kontaktowe — edycja */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className={labelCls + ' flex items-center gap-1.5'}><Users size={13} className="text-primary-500" /> Osoby kontaktowe</p>
                  <button onClick={addContact} className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"><UserPlus size={13} /> Dodaj</button>
                </div>
                {form.contacts.length === 0 && <p className="text-xs italic text-slate-300">Brak — kliknij „Dodaj"</p>}
                <div className="space-y-2">
                  {form.contacts.map((c: Contact, i: number) => (
                    <div key={i} className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Osoba {i + 1}</span>
                        <button onClick={() => removeContact(i)} className="text-red-400 hover:text-red-600" title="Usuń"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input value={c.name || ''} onChange={e => setContact(i, 'name', e.target.value)} placeholder="Imię i nazwisko" className={inputSm} />
                        <input value={c.role || ''} onChange={e => setContact(i, 'role', e.target.value)} placeholder="Stanowisko" className={inputSm} />
                        <input value={c.email || ''} onChange={e => setContact(i, 'email', e.target.value)} placeholder="E-mail" className={inputSm} />
                        <input value={c.phone || ''} onChange={e => setContact(i, 'phone', e.target.value)} placeholder="Telefon" className={inputSm} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {lead && !editing && (
            <>
              <div className="mb-4">
                <OpiekunBlock opiekun={lead.opiekun} />
              </div>

              <Row icon={<Building2 size={16} />} label="Nazwa firmy" value={lead.name} />
              <Row icon={<Hash size={16} />} label="NIP" value={lead.nip ?? undefined} />
              <Row icon={<MapPin size={16} />} label="Miasto" value={lead.city ?? undefined} />
              <Row icon={<User size={16} />} label="Osoba decyzyjna" value={lead.contact_person ?? undefined} />
              <Row icon={<Mail size={16} />} label="E-mail" value={lead.email ?? undefined} />
              <Row icon={<Phone size={16} />} label="Telefon" value={lead.phone ?? undefined} />
              <Row icon={<Sparkles size={16} />} label="Źródło" value={lead.source ? (SOURCE_LABEL[lead.source] ?? lead.source) : undefined} />

              {/* Osoby kontaktowe — podgląd */}
              {Array.isArray(lead.contacts) && lead.contacts.length > 0 && (
                <div className="mt-4">
                  <p className={labelCls + ' mb-2 flex items-center gap-1.5'}><Users size={13} className="text-primary-500" /> Osoby kontaktowe ({lead.contacts.length})</p>
                  <div className="space-y-1.5">
                    {lead.contacts.map((c, i) => (
                      <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <p className="text-sm font-semibold text-slate-800">
                          {c.name || '—'}{c.role && <span className="font-normal text-slate-400"> · {c.role}</span>}
                        </p>
                        {(c.email || c.phone) && <p className="text-xs text-slate-500">{[c.email, c.phone].filter(Boolean).join(' · ')}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <FileText size={13} className="text-primary-500" /> Notatki
                </p>
                {lead.notes ? (
                  <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-100">
                    {lead.notes}
                  </p>
                ) : (
                  <p className="text-sm italic text-slate-300">Brak notatek</p>
                )}
              </div>

              {/* Oferty */}
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                  <FileBarChart size={13} className="text-primary-500" /> Oferty
                  {offers.length > 0 && <span className="text-slate-300">({offers.length})</span>}
                </p>
                {loadingOffers ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" /> Ładowanie…</div>
                ) : offers.length === 0 ? (
                  <p className="text-sm italic text-slate-300">Brak ofert — wygeneruj w Kalkulatorze Ofertowym</p>
                ) : (
                  <div className="space-y-1.5">
                    {offers.map(o => (
                      <div key={o.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <FileText size={14} className="text-primary-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700">
                            {new Date(o.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[11px] text-slate-500">Oszczędność {money(o.total_savings_monthly)}/mies · {o.employees_count ?? '—'} prac.</p>
                        </div>
                        {o.pdf_url && (
                          <a href={o.pdf_url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg p-1.5 text-primary-600 hover:bg-primary-50" title="Otwórz PDF">
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Korespondencja */}
              {lead.email && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                    <Inbox size={13} className="text-primary-500" /> Korespondencja
                    {corr.length > 0 && <span className="text-slate-300">({corr.length})</span>}
                  </p>
                  {loadingCorr ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" /> Ładowanie z poczty…</div>
                  ) : corr.length === 0 ? (
                    <p className="text-sm italic text-slate-300">Brak wiadomości z {lead.email}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {corr.map(m => (
                        <div key={m.folder + ':' + m.uid} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                          <span className={`shrink-0 ${m.direction === 'in' ? 'text-teal-600' : 'text-amber-600'}`} title={m.direction === 'in' ? 'Odebrane' : 'Wysłane'}>
                            {m.direction === 'in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700 truncate">{m.subject}</p>
                            <p className="text-[11px] text-slate-400">
                              {m.date ? new Date(m.date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: '2-digit' }) : ''}
                              {m.hasAttachments ? ' · 📎' : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="mt-5 text-[11px] text-slate-400">
                Dodano:{' '}
                {new Date(lead.created_at).toLocaleDateString('pl-PL', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 space-y-2">
          {editing ? (
            <>
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Zapisz
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
              >
                <Pencil size={15} /> Edytuj dane
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={14} />} Usuń klienta
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
