'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, User, ShoppingBag, HeadphonesIcon, Save, Loader2,
  CheckCircle, AlertCircle, Ticket, RefreshCw,
  Phone, Mail, MapPin, CreditCard, Lock, Send, ChevronDown
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name: string;
  pesel?: string;
  email: string;
  phone_number?: string;
  department?: string;
  position?: string;
  contract_type?: string;
  hire_date?: string;
  status?: string;
  iban?: string;
  iban_verified?: boolean;
  address_street?: string;
  address_zip?: string;
  address_city?: string;
  voucherBalance?: number;
}

interface VoucherRow {
  id: string;
  code?: string;
  face_value?: number;
  status?: string;
  issued_at?: string;
  valid_until?: string;
  used_at?: string;
  buyback_amount?: number;
}

type Tab = 'profile' | 'orders' | 'bok';

const CATEGORY_OPTIONS = [
  { value: 'USTERKA',             label: 'Usterka' },
  { value: 'PROBLEM_TECHNICZNY',  label: 'Problem techniczny' },
  { value: 'PYTANIE',             label: 'Pytanie' },
  { value: 'INNE',                label: 'Inne' },
];

const STATUS_COLORS: Record<string, string> = {
  DISTRIBUTED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  USED:        'text-blue-400    bg-blue-400/10    border-blue-400/20',
  EXPIRED:     'text-red-400     bg-red-400/10     border-red-400/20',
  BOUGHT_BACK: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  PENDING:     'text-slate-400   bg-slate-400/10   border-slate-400/20',
};

const STATUS_LABELS: Record<string, string> = {
  DISTRIBUTED: 'Aktywny',
  USED:        'Wykorzystany',
  EXPIRED:     'Wygasły',
  BOUGHT_BACK: 'Odkupiony',
  PENDING:     'Oczekujący',
};

// ─── Field components ────────────────────────────────────────────────────────

function LockedField({ label, value, icon: Icon }: { label: string; value?: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-widest text-white/40 flex items-center gap-1.5">
        <Icon size={11} />
        {label}
        <Lock size={9} className="text-white/20 ml-0.5" />
      </label>
      <div className="px-3.5 py-2.5 rounded-xl border border-white/5 bg-white/5 text-white/50 text-sm select-none cursor-not-allowed">
        {value || '—'}
      </div>
    </div>
  );
}

function EditableField({
  label, value, onChange, icon: Icon, placeholder = '', type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ElementType;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-widest text-white/40 flex items-center gap-1.5">
        <Icon size={11} />
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-400/50 transition"
      />
    </div>
  );
}

// ─── Tab: Moje dane ───────────────────────────────────────────────────────────

function ProfileTab({ userId }: { userId: string }) {
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState('');

  const [phone,  setPhone]  = useState('');
  const [street, setStreet] = useState('');
  const [zip,    setZip]    = useState('');
  const [city,   setCity]   = useState('');
  const [iban,   setIban]   = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/me');
      if (!res.ok) throw new Error('Błąd pobierania danych');
      const data: UserProfile = await res.json();
      setProfile(data);
      setPhone(data.phone_number   ?? '');
      setStreet(data.address_street ?? '');
      setZip(data.address_zip       ?? '');
      setCity(data.address_city     ?? '');
      setIban(data.iban             ?? '');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Błąd');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number:   phone  || undefined,
          address_street: street || undefined,
          address_zip:    zip    || undefined,
          address_city:   city   || undefined,
          iban:           iban   || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Błąd zapisu');
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Błąd');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-emerald-400" />
    </div>
  );

  if (!profile) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      <AlertCircle size={20} className="mr-2" /> Nie udało się załadować profilu
    </div>
  );

  const nameParts = profile.full_name?.split(' ') ?? [];
  const firstName = nameParts[0] ?? '';
  const lastName  = nameParts.slice(1).join(' ') ?? '';

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
          <Lock size={10} />
          Dane chronione — nieedytowalne
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LockedField label="Imię"       value={firstName}       icon={User} />
          <LockedField label="Nazwisko"   value={lastName}        icon={User} />
          <LockedField label="PESEL"      value={profile.pesel}   icon={User} />
          <LockedField label="Stanowisko" value={profile.position} icon={User} />
        </div>
      </section>

      <div className="border-t border-white/5" />

      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
          <Phone size={10} />
          Dane kontaktowe
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LockedField label="Adres e-mail" value={profile.email} icon={Mail} />
          <EditableField label="Numer telefonu" value={phone} onChange={setPhone} icon={Phone} placeholder="+48 500 000 000" type="tel" />
        </div>
      </section>

      <div className="border-t border-white/5" />

      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
          <MapPin size={10} />
          Adres zamieszkania
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <EditableField label="Ulica i numer" value={street} onChange={setStreet} icon={MapPin} placeholder="ul. Przykładowa 1/2" />
          </div>
          <EditableField label="Kod pocztowy" value={zip} onChange={setZip} icon={MapPin} placeholder="00-000" />
          <EditableField label="Miasto"       value={city} onChange={setCity} icon={MapPin} placeholder="Warszawa" />
        </div>
      </section>

      <div className="border-t border-white/5" />

      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
          <CreditCard size={10} />
          Konto bankowe (IBAN)
          {profile.iban_verified && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
              zweryfikowane
            </span>
          )}
        </h3>
        <EditableField label="Numer IBAN" value={iban} onChange={setIban} icon={CreditCard} placeholder="PL00 0000 0000 0000 0000 0000 0000" />
      </section>

      <div className="flex items-center justify-between pt-2">
        <div className="min-h-6">
          {error && (
            <p className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={14} /> {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle size={14} /> Dane zostały zapisane
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Historia zamówień ───────────────────────────────────────────────────

function OrdersTab({ userId }: { userId: string }) {
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/vouchers?userId=${userId}`);
      if (!res.ok) throw new Error('Błąd pobierania historii');
      const data = await res.json();
      setVouchers(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Błąd');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const fmtMoney = (v?: number) =>
    v != null ? `${v.toLocaleString('pl-PL')} pkt` : '—';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-emerald-400" />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      <AlertCircle size={20} className="mr-2" /> {error}
    </div>
  );

  if (vouchers.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-white/30 gap-3">
      <Ticket size={40} className="opacity-20" />
      <p className="text-sm">Brak voucherów w historii</p>
    </div>
  );

  const active     = vouchers.filter(v => v.status === 'DISTRIBUTED');
  const historical = vouchers.filter(v => v.status !== 'DISTRIBUTED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">{vouchers.length} voucherów łącznie</p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-emerald-400 transition px-2 py-1 rounded-lg hover:bg-white/5"
        >
          <RefreshCw size={12} /> Odśwież
        </button>
      </div>

      {active.length > 0 && (
        <section>
          <h3 className="text-[11px] uppercase tracking-widest text-emerald-400/60 mb-3">
            Aktywne vouchery ({active.length})
          </h3>
          <div className="space-y-2">
            {active.map(v => (
              <VoucherCard key={v.id} voucher={v} fmt={fmt} fmtMoney={fmtMoney} />
            ))}
          </div>
        </section>
      )}

      {historical.length > 0 && (
        <section>
          <h3 className="text-[11px] uppercase tracking-widest text-white/30 mb-3">
            Historia ({historical.length})
          </h3>
          <div className="space-y-2">
            {historical.map(v => (
              <VoucherCard key={v.id} voucher={v} fmt={fmt} fmtMoney={fmtMoney} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VoucherCard({
  voucher, fmt, fmtMoney,
}: {
  voucher: VoucherRow;
  fmt: (s?: string) => string;
  fmtMoney: (n?: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const status     = voucher.status ?? 'PENDING';
  const colorClass = STATUS_COLORS[status] ?? STATUS_COLORS.PENDING;

  return (
    <div
      className="rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Ticket size={16} className="text-white/30 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white/80 truncate">
            {voucher.code ?? `#${voucher.id.slice(0, 8)}`}
          </p>
          <p className="text-xs text-white/30 mt-0.5">Wystawiono: {fmt(voucher.issued_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-white">{fmtMoney(voucher.face_value)}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
          <ChevronDown
            size={14}
            className={`text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Ważny do</p>
            <p className="text-sm text-white/70">{fmt(voucher.valid_until)}</p>
          </div>
          {voucher.used_at && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Wykorzystano</p>
              <p className="text-sm text-white/70">{fmt(voucher.used_at)}</p>
            </div>
          )}
          {voucher.buyback_amount != null && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Kwota odkupu</p>
              <p className="text-sm text-amber-400 font-semibold">{fmtMoney(voucher.buyback_amount)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Kontakt z BOK ───────────────────────────────────────────────────────

function BokTab() {
  const [category, setCategory] = useState('USTERKA');
  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');

  const handleSend = async () => {
    setError('');
    if (!subject.trim()) { setError('Podaj temat wiadomości'); return; }
    if (message.trim().length < 10) { setError('Wiadomość musi mieć co najmniej 10 znaków'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/contact-bok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Błąd wysyłki');
      }
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Błąd');
    } finally {
      setSending(false);
    }
  };

  if (sent) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
        <CheckCircle size={32} className="text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white">Wiadomość wysłana!</p>
        <p className="text-sm text-white/40 mt-1">Otrzymasz odpowiedź na e-mail w ciągu 24h roboczych.</p>
      </div>
      <button onClick={() => setSent(false)} className="text-sm text-emerald-400 hover:underline">
        Wyślij kolejne zgłoszenie
      </button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="p-4 rounded-xl border border-white/8 bg-white/3 flex gap-3">
        <HeadphonesIcon size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-white">Biuro Obsługi Klienta</p>
          <p className="text-xs text-white/40 mt-0.5">
            Twoje zgłoszenie zostanie przesłane na{' '}
            <span className="text-emerald-400/70">bok@stratton-prime.pl</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-widest text-white/40">Kategoria zgłoszenia</label>
        <div className="relative">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-emerald-400/50 transition"
          >
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-[#0f0f0f] text-white">
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-widest text-white/40">Temat</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Krótki opis problemu…"
          maxLength={200}
          className="px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-400/50 transition"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-widest text-white/40 flex justify-between">
          <span>Wiadomość</span>
          <span className={message.length > 4800 ? 'text-amber-400' : ''}>{message.length}/5000</span>
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Opisz dokładnie swój problem lub pytanie…"
          maxLength={5000}
          rows={6}
          className="px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-400/50 transition resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          {error && (
            <p className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface EmployeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export const EmployeeSettingsModal: React.FC<EmployeeSettingsModalProps> = ({
  isOpen, onClose, userId, userName,
}) => {
  const [tab, setTab] = useState<Tab>('profile');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Moje dane',        icon: User },
    { id: 'orders',  label: 'Historia zamówień', icon: ShoppingBag },
    { id: 'bok',     label: 'Kontakt z BOK',     icon: HeadphonesIcon },
  ];

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 text-sm font-bold">
              {userName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{userName}</p>
              <p className="text-[11px] text-white/30 uppercase tracking-wider">Konto pracownika</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 px-6 flex-shrink-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-1 py-3 mr-6 text-xs font-semibold border-b-2 transition ${
                  active
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'profile' && <ProfileTab userId={userId} />}
          {tab === 'orders'  && <OrdersTab  userId={userId} />}
          {tab === 'bok'     && <BokTab />}
        </div>
      </div>
    </div>
  );
};
