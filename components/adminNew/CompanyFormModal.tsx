import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { X, Loader2, AlertCircle, Search, CheckCircle2, Building2 } from 'lucide-react';

// ── Walidacja ─────────────────────────────────────────────────────────────────

const Schema = z.object({
  name:          z.string().min(2, 'Nazwa musi mieć min. 2 znaki'),
  nip:           z.string().length(10, 'NIP musi mieć dokładnie 10 cyfr').regex(/^\d{10}$/, 'NIP: tylko cyfry'),
  krs:           z.string().optional(),
  regon:         z.string().optional(),
  address_street: z.string().optional(),
  address_city:   z.string().optional(),
  address_zip:    z.string().optional(),
  fee_percent:    z.number().min(15, 'Min. 15%').max(31, 'Max. 31%').default(20),
});

type FormData = z.infer<typeof Schema>;

interface Props {
  onClose:   () => void;
  onCreated: (company: any) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CompanyFormModal: React.FC<Props> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState<FormData>({
    name:           '',
    nip:            '',
    krs:            '',
    regon:          '',
    address_street: '',
    address_city:   '',
    address_zip:    '',
    fee_percent:    20,
  });
  const [fieldErrors, setFieldErrors]  = useState<Partial<Record<keyof FormData, string>>>({});
  const [serverError, setServerError]  = useState<string | null>(null);
  const [saving,      setSaving]       = useState(false);
  const [crmSyncing,  setCrmSyncing]   = useState(false);

  // GUS lookup state
  const [gusLoading,  setGusLoading]   = useState(false);
  const [gusSuccess,  setGusSuccess]   = useState<string | null>(null);
  const [gusError,    setGusError]     = useState<string | null>(null);
  const gusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pokaż przycisk GUS gdy NIP ma 10 cyfr
  const nipIsValid = /^\d{10}$/.test(form.nip);

  // Auto-lookup po wpisaniu kompletnego NIP (z debounce 600ms)
  useEffect(() => {
    if (!nipIsValid) {
      setGusSuccess(null);
      setGusError(null);
      return;
    }
    // Nie auto-lookupuj jeśli nazwa już jest wpisana ręcznie
    if (form.name.trim()) return;

    if (gusTimerRef.current) clearTimeout(gusTimerRef.current);
    gusTimerRef.current = setTimeout(() => { handleGusLookup(); }, 600);

    return () => {
      if (gusTimerRef.current) clearTimeout(gusTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nip]);

  const handleGusLookup = async () => {
    if (!nipIsValid) return;
    setGusLoading(true);
    setGusError(null);
    setGusSuccess(null);
    try {
      const res  = await fetch(`/api/companies/gus-lookup?nip=${form.nip}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setForm(prev => ({
        ...prev,
        name:           data.name           || prev.name,
        krs:            data.krs            || prev.krs,
        regon:          data.regon          || prev.regon,
        address_street: data.address_street || prev.address_street,
        address_city:   data.address_city   || prev.address_city,
        address_zip:    data.address_zip    || prev.address_zip,
      }));
      // Wyczyść błędy pól które właśnie wypełniliśmy
      setFieldErrors({});
      const src = data.source === 'gus_bir' ? 'GUS BIR/REGON' : 'MF Biała Lista';
      setGusSuccess(`Dane pobrane z ${src}${data.regon ? ` (REGON: ${data.regon})` : ''}`);
    } catch (e: any) {
      setGusError(e.message ?? 'Błąd połączenia z GUS');
    } finally {
      setGusLoading(false);
    }
  };

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormData, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormData;
        errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/companies', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onCreated(data);
    } catch (e: any) {
      setServerError(e.message ?? 'Nieoczekiwany błąd');
    } finally {
      setSaving(false);
    }
  };

  const handleCrmSync = async () => {
    setCrmSyncing(true);
    setServerError(null);
    try {
      const res = await fetch('/api/companies/sync-crm', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onCreated(null); // odśwież listę
    } catch (e: any) {
      setServerError(e.message ?? 'Błąd syncronizacji CRM');
    } finally {
      setCrmSyncing(false);
    }
  };

  const field = (
    key: keyof FormData,
    label: string,
    placeholder?: string,
    required?: boolean,
  ) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        value={form[key] ?? ''}
        onChange={set(key)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          fieldErrors[key] ? 'border-red-300' : 'border-slate-200'
        }`}
      />
      {fieldErrors[key] && (
        <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors[key]}</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">Dodaj nową firmę</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle size={14} className="flex-shrink-0" />
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {field('name', 'Nazwa firmy', 'np. Stratton Prime S.A.', true)}

            {/* NIP z przyciskiem GUS */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                NIP (10 cyfr)<span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  value={form.nip}
                  onChange={set('nip')}
                  placeholder="1234567890"
                  maxLength={10}
                  className={`flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    fieldErrors.nip ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleGusLookup}
                  disabled={!nipIsValid || gusLoading}
                  title="Pobierz dane firmy z GUS / Białej Listy MF"
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 whitespace-nowrap"
                >
                  {gusLoading
                    ? <Loader2 size={13} className="animate-spin" />
                    : gusSuccess
                      ? <CheckCircle2 size={13} />
                      : <Search size={13} />
                  }
                  GUS
                </button>
              </div>
              {fieldErrors.nip && (
                <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.nip}</p>
              )}
            </div>
          </div>

          {/* Banner GUS */}
          {gusSuccess && (
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
              <Building2 size={14} className="flex-shrink-0 mt-0.5" />
              {gusSuccess}
            </div>
          )}
          {gusError && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {gusError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {field('krs', 'KRS', 'np. 0000123456')}
            {field('regon', 'REGON', 'np. 123456789')}
          </div>

          {field('address_street', 'Ulica i nr', 'np. ul. Kwiatowa 13')}
          <div className="grid grid-cols-2 gap-4">
            {field('address_city', 'Miasto', 'Warszawa')}
            {field('address_zip', 'Kod pocztowy', '00-000')}
          </div>

          {/* Opłata serwisowa */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Opłata serwisowa (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={15}
                max={31}
                step={0.5}
                value={form.fee_percent}
                onChange={e => setForm(f => ({ ...f, fee_percent: e.target.value === '' ? 20 : parseFloat(e.target.value) }))}
                className={`w-28 px-3 py-2 border rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  fieldErrors.fee_percent ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              <span className="text-xs text-slate-400">Zakres: 15–31%  |  Domyślnie: 20%</span>
            </div>
            {fieldErrors.fee_percent && (
              <p className="text-red-500 text-[11px] mt-0.5">{fieldErrors.fee_percent}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCrmSync}
              disabled={crmSyncing || saving}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition disabled:opacity-50"
            >
              {crmSyncing ? <Loader2 size={14} className="animate-spin" /> : null}
              Synchronizuj z CRM
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Zapisz firmę
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
