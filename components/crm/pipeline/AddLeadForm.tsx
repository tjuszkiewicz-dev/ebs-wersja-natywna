'use client';

import React, { useState } from 'react';
import { Plus, Loader2, ArrowUpRight } from 'lucide-react';
import type { GusResult } from './pipelineTypes';
import { SOURCE_OPTIONS } from './pipelineConfig';

// ─── Formularz nowego klienta ─────────────────────────────────────────────────

interface NewLeadForm {
  nip: string;
  name: string;
  city: string;
  contact_person: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
}

const EMPTY_FORM: NewLeadForm = {
  nip: '', name: '', city: '', contact_person: '',
  email: '', phone: '', source: 'manual', notes: '',
};

export function AddLeadForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<NewLeadForm>(EMPTY_FORM);
  const [gusLoading, setGusLoading] = useState(false);
  const [gusError, setGusError] = useState<string | null>(null);
  const [gusExtra, setGusExtra] = useState<{ regon?: string; krs?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const set = <K extends keyof NewLeadForm>(key: K, value: NewLeadForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleGus = async () => {
    const nip = form.nip.replace(/[^0-9]/g, '');
    if (nip.length !== 10) {
      setGusError('NIP musi mieć 10 cyfr.');
      return;
    }
    setGusLoading(true);
    setGusError(null);
    setGusExtra(null);
    try {
      const res = await fetch(`/api/companies/gus-lookup?nip=${nip}`, {
        credentials: 'same-origin',
      });
      const data: GusResult = await res.json().catch(() => ({} as GusResult));
      if (!res.ok || data.error) {
        setGusError(
          res.status === 404 ? 'Nie znaleziono firmy o tym NIP.'
          : res.status === 403 ? 'Brak dostępu do bazy GUS.'
          : (data.error ?? 'Nie udało się pobrać danych z GUS.'),
        );
        return;
      }
      setForm(prev => ({
        ...prev,
        name: data.name ?? prev.name,
        city: data.address_city ?? prev.city,
        nip: data.nip ?? prev.nip,
      }));
      setGusExtra({ regon: data.regon, krs: data.krs });
    } catch {
      setGusError('Błąd połączenia z GUS.');
    } finally {
      setGusLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Nazwa firmy jest wymagana.');
      return;
    }
    setSaving(true);
    setFormError(null);
    setOk(false);
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: form.name.trim(),
          nip: form.nip.trim(),
          contact_person: form.contact_person.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
          source: form.source,
          city: form.city.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { code?: string; error?: string }));
        if (res.status === 409 || err.code === 'DUPLICATE_NIP') {
          throw new Error('Klient z tym NIP już istnieje.');
        }
        throw new Error(err.error ?? 'Nie udało się zapisać klienta.');
      }
      setForm(EMPTY_FORM);
      setGusExtra(null);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Błąd zapisu.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 text-white">
          <Plus size={16} />
        </span>
        <h3 className="font-display font-bold text-slate-900">Wprowadź nowego klienta</h3>
      </div>

      {/* NIP + GUS */}
      <div className="mb-3">
        <label className={labelCls}>NIP</label>
        <div className="flex gap-2">
          <input
            value={form.nip}
            onChange={e => set('nip', e.target.value)}
            placeholder="0000000000"
            inputMode="numeric"
            className={inputCls}
          />
          <button
            type="button"
            onClick={handleGus}
            disabled={gusLoading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary-400 px-3 py-2 text-xs font-bold text-background hover:bg-secondary-500 disabled:opacity-60 transition-colors"
          >
            {gusLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
            Pobierz dane z GUS
          </button>
        </div>
        {gusError && <p className="mt-1.5 text-xs text-red-600">{gusError}</p>}
        {gusExtra && (gusExtra.regon || gusExtra.krs) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {gusExtra.regon && (
              <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">REGON</p>
                <p className="font-mono text-xs text-slate-700">{gusExtra.regon}</p>
              </div>
            )}
            {gusExtra.krs && (
              <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-400">KRS</p>
                <p className="font-mono text-xs text-slate-700">{gusExtra.krs}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nazwa */}
      <div className="mb-3">
        <label className={labelCls}>
          Nazwa firmy <span className="text-red-500">*</span>
        </label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="ABC Sp. z o.o."
          className={inputCls}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Miasto</label>
          <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Gdańsk" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Osoba decyzyjna</label>
          <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Jan Kowalski" className={inputCls} />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>E-mail</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jan@firma.pl" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefon</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+48 000 000 000" className={inputCls} />
        </div>
      </div>

      <div className="mb-3">
        <label className={labelCls}>Źródło</label>
        <select
          value={form.source}
          onChange={e => set('source', e.target.value)}
          className={inputCls}
        >
          {SOURCE_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className={labelCls}>Notatki</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          placeholder="Opcjonalnie…"
          className={`${inputCls} resize-none`}
        />
      </div>

      {formError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{formError}</p>
      )}
      {ok && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">
          Klient zapisany.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60 transition-colors"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        Dodaj i zapisz klienta
      </button>
    </form>
  );
}
