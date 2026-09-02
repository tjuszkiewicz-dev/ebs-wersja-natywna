'use client';

import React, { useState } from 'react';
import type { Firma } from '@/lib/agencja/tax-engine/types';
import { Building2, Search, Users, X, CheckCircle2 } from 'lucide-react';

interface Props {
  firma: Firma;
  onFirmaChange: (f: Firma) => void;
  onLeadPicked?: (leadId: string | null) => void;
}

const TEAL = '#4a95a9';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all"
      style={{ '--tw-ring-color': TEAL } as React.CSSProperties}
    />
  );
}

// ─── Lead picker modal ────────────────────────────────────────────────────────

interface LeadRaw {
  id: string;
  name: string;
  nip?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Nowy', qualified: 'Zakwalifikowany', converted: 'Pozyskany', rejected: 'Odrzucony',
};
const STATUS_COLOR: Record<string, string> = {
  new: '#64748b', qualified: TEAL, converted: '#22c55e', rejected: '#ef4444',
};

function LeadPickerModal({ onClose, onPick }: {
  onClose: () => void;
  onPick: (lead: LeadRaw) => void;
}) {
  const [leads, setLeads] = useState<LeadRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/crm/leads')
      .then(r => r.json())
      .then(data => { setLeads(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.nip ?? '').includes(search)
  );

  const handlePick = (lead: LeadRaw) => {
    setPicked(lead.id);
    setTimeout(() => { onPick(lead); onClose(); }, 300);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Wybierz firmę z leadów</h3>
            <p className="text-xs text-slate-500 mt-0.5">Dane zostaną przeniesione do formularza</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj po nazwie lub NIP…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading && (
            <div className="text-center py-8 text-slate-400 text-sm">Ładowanie leadów…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">Brak leadów</div>
          )}
          {filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => handlePick(lead)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-start gap-3 ${
                picked === lead.id
                  ? 'border-[#4a95a9] bg-[#4a95a9]/5'
                  : 'border-slate-200 hover:border-[#4a95a9]/40 hover:bg-slate-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800 truncate">{lead.name}</span>
                  {lead.nip && <span className="text-xs text-slate-400 font-mono">NIP: {lead.nip}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {lead.contact_person && (
                    <span className="text-xs text-slate-500">👤 {lead.contact_person}</span>
                  )}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: STATUS_COLOR[lead.status] ?? '#64748b' }}
                  >
                    {STATUS_LABEL[lead.status] ?? lead.status}
                  </span>
                </div>
              </div>
              {picked === lead.id && <CheckCircle2 size={18} className="text-[#4a95a9] flex-shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export function Step0Company({ firma, onFirmaChange, onLeadPicked }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const set = (key: keyof Firma) => (val: string | number) =>
    onFirmaChange({ ...firma, [key]: val });

  const lookupGus = async () => {
    if (!firma.nip) return;
    try {
      const res = await fetch(`/api/companies/gus-lookup?nip=${firma.nip}`);
      if (res.ok) {
        const data = await res.json();
        onFirmaChange({
          ...firma,
          nazwa: data.name ?? firma.nazwa,
          adres: data.street ?? firma.adres,
          kodPocztowy: data.zip ?? firma.kodPocztowy,
          miasto: data.city ?? firma.miasto,
        });
      }
    } catch { /* ignore */ }
  };

  const handlePickLead = (lead: LeadRaw) => {
    onFirmaChange({
      ...firma,
      nazwa:           lead.name,
      nip:             lead.nip ?? firma.nip,
      osobaKontaktowa: lead.contact_person ?? firma.osobaKontaktowa,
      telefon:         lead.phone ?? firma.telefon,
      email:           lead.email ?? firma.email,
    });
    onLeadPicked?.(lead.id);
  };

  return (
    <div>
      {/* Header + "Dodaj z leadów" */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TEAL}20` }}>
            <Building2 size={20} style={{ color: TEAL }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Dane firmy</h2>
            <p className="text-sm text-slate-500">Wprowadź dane klienta lub wyszukaj po NIP</p>
          </div>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: TEAL }}
        >
          <Users size={15} />
          Dodaj z leadów
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="NIP">
          <div className="flex gap-2">
            <Input value={firma.nip} onChange={set('nip')} placeholder="0000000000" />
            <button
              onClick={lookupGus}
              title="Pobierz z GUS"
              className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Search size={16} className="text-slate-500" />
            </button>
          </div>
        </Field>

        <Field label="Nazwa firmy *">
          <Input value={firma.nazwa} onChange={set('nazwa')} placeholder="Np. ABC Sp. z o.o." />
        </Field>

        <Field label="Adres">
          <Input value={firma.adres ?? ''} onChange={set('adres')} placeholder="ul. Przykładowa 1" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kod pocztowy">
            <Input value={firma.kodPocztowy ?? ''} onChange={set('kodPocztowy')} placeholder="00-000" />
          </Field>
          <Field label="Miasto">
            <Input value={firma.miasto ?? ''} onChange={set('miasto')} placeholder="Warszawa" />
          </Field>
        </div>

        <Field label="Osoba kontaktowa">
          <Input value={firma.osobaKontaktowa ?? ''} onChange={set('osobaKontaktowa')} placeholder="Jan Kowalski" />
        </Field>

        <Field label="Email kontaktowy">
          <Input value={firma.email ?? ''} onChange={set('email')} placeholder="jan@firma.pl" type="email" />
        </Field>

        <Field label="Telefon">
          <Input value={firma.telefon ?? ''} onChange={set('telefon')} placeholder="+48 000 000 000" />
        </Field>

        <Field label="Okres rozliczeniowy">
          <Input value={firma.okres} onChange={set('okres')} type="month" />
        </Field>

        <Field label="Stawka wypadkowa (%)">
          <input
            type="number"
            step="0.01"
            min="0"
            max="10"
            value={firma.stawkaWypadkowa}
            onChange={e => set('stawkaWypadkowa')(parseFloat(e.target.value) || 1.67)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition-all"
          />
        </Field>
      </div>

      {showPicker && (
        <LeadPickerModal
          onClose={() => setShowPicker(false)}
          onPick={handlePickLead}
        />
      )}
    </div>
  );
}
