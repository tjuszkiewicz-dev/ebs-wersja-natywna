import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Building2, MapPin, Hash, Loader2, AlertCircle,
  Users, ShoppingCart, Phone, Mail, Lock, PhoneCall
} from 'lucide-react';
import { AdminEmployeeTable, AdminEmployee } from './AdminEmployeeTable';
import { AdminOrdersSection, AdminOrder } from './AdminOrdersSection';
import { ContactsSection } from './ContactsSection';
import { useStrattonSystem } from '../../context/StrattonContext';
import { Role } from '../../types';

// ── Typy ─────────────────────────────────────────────────────────────────────

export interface CustomerCompany {
  id:             string;
  name:           string;
  nip:            string;
  krs:            string | null;
  regon:          string | null;
  address_street: string | null;
  address_city:   string | null;
  address_zip:    string | null;
  balance_pending: number;
  balance_active:  number;
  origin:         'NATIVE' | 'CRM_SYNC';
  created_at:     string;
  fee_percent:        number | null;
  voucher_expiry_day:    number | null;
  voucher_expiry_hour:   number | null;
  voucher_expiry_minute: number | null;
}

interface Props {
  company:  CustomerCompany;
  onClose:  () => void;
}

type Section = 'info' | 'contacts' | 'employees' | 'orders';

// ── Main Component ────────────────────────────────────────────────────────────

export const CustomerCard: React.FC<Props> = ({ company, onClose }) => {
  const { state } = useStrattonSystem();
  const [section,      setSection]      = useState<Section>('contacts');
  const [contactCount, setContactCount] = useState<number | null>(null); // null = loading
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [orders,    setOrders]    = useState<AdminOrder[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [ordLoading, setOrdLoading] = useState(false);
  const [empError,  setEmpError]  = useState<string | null>(null);
  const [ordError,  setOrdError]  = useState<string | null>(null);

  // fee_percent edit state
  const [feeEdit,    setFeeEdit]    = useState(false);
  const [feeValue,   setFeeValue]   = useState<string>(String(company.fee_percent ?? 20));
  const [feeSaving,  setFeeSaving]  = useState(false);
  const [feeError,   setFeeError]   = useState<string | null>(null);

  // voucher expiry (day + hour + minute) edit state
  const [expiryEdit,    setExpiryEdit]    = useState(false);
  const [expiryDay,     setExpiryDay]     = useState<string>(String(company.voucher_expiry_day ?? 10));
  const [expiryHour,    setExpiryHour]    = useState<string>(String(company.voucher_expiry_hour ?? 0).padStart(2, '0'));
  const [expiryMinute,  setExpiryMinute]  = useState<string>(String(company.voucher_expiry_minute ?? 5).padStart(2, '0'));
  const [expirySaving,  setExpirySaving]  = useState(false);
  const [expiryError,   setExpiryError]   = useState<string | null>(null);

  const handleFeeSubmit = useCallback(async () => {
    const num = parseFloat(feeValue);
    if (isNaN(num) || num < 15 || num > 31) {
      setFeeError('Wartość musi być między 15 a 31');
      return;
    }
    setFeeSaving(true);
    setFeeError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_settings', fee_percent: num }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setFeeEdit(false);
    } catch (e: any) {
      setFeeError(e.message ?? 'Błąd zapisu');
    } finally {
      setFeeSaving(false);
    }
  }, [company.id, feeValue]);

  const handleExpirySubmit = useCallback(async () => {
    const dayNum    = parseInt(expiryDay, 10);
    const hourNum   = parseInt(expiryHour, 10);
    const minuteNum = parseInt(expiryMinute, 10);
    if (isNaN(dayNum)    || dayNum    < 1  || dayNum    > 31) { setExpiryError('Dzień musi być między 1 a 31'); return; }
    if (isNaN(hourNum)   || hourNum   < 0  || hourNum   > 23) { setExpiryError('Godzina musi być między 0 a 23'); return; }
    if (isNaN(minuteNum) || minuteNum < 0  || minuteNum > 59) { setExpiryError('Minuta musi być między 0 a 59'); return; }
    setExpirySaving(true);
    setExpiryError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          voucher_expiry_day:    dayNum,
          voucher_expiry_hour:   hourNum,
          voucher_expiry_minute: minuteNum,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setExpiryEdit(false);
    } catch (e: any) {
      setExpiryError(e.message ?? 'Błąd zapisu');
    } finally {
      setExpirySaving(false);
    }
  }, [company.id, expiryDay, expiryHour, expiryMinute]);

  // Lokalni pracownicy z StrattonContext (localStorage) — fallback gdy Supabase nie ma danych
  const localEmployees: AdminEmployee[] = state.users
    .filter(u => u.companyId === company.id && u.role === Role.EMPLOYEE)
    .map(u => ({
      id:            u.id,
      full_name:     u.name ?? null,
      email:         u.email ?? '',
      pesel:         u.pesel ?? null,
      phone_number:  u.identity?.phoneNumber ?? null,
      department:    u.department ?? u.organization?.department ?? null,
      position:      u.position   ?? u.organization?.position   ?? null,
      contract_type: (u.contract?.type === 'UZ' ? 'UZ' : 'UOP') as 'UOP' | 'UZ',
      hire_date:     u.contract?.contractDateStart ?? null,
      status:        (u.status?.toLowerCase() ?? 'active') as 'active' | 'inactive' | 'anonymized',
      iban:          u.finance?.payoutAccount?.iban ?? null,
      iban_verified: false,
      created_at:    new Date().toISOString(),
    }));

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    setEmpError(null);
    try {
      const res = await fetch(`/api/employees?companyId=${company.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setEmpError(e.message ?? 'Błąd pobierania pracowników');
    } finally {
      setEmpLoading(false);
    }
  }, [company.id]);

  const fetchOrders = useCallback(async () => {
    setOrdLoading(true);
    setOrdError(null);
    try {
      const res = await fetch(`/api/orders?companyId=${company.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch (e: any) {
      setOrdError(e.message ?? 'Błąd pobierania zamówień');
    } finally {
      setOrdLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    fetchEmployees();
    fetchOrders();
  }, [fetchEmployees, fetchOrders]);

  const hrOperators = employees.filter((e) => e['role' as keyof AdminEmployee] === 'pracodawca');

  // Połącz pracowników z Supabase z lokalnymi (localStorage) — deduplikacja po ID
  const supabaseIds = new Set(employees.map(e => e.id));
  const mergedEmployees: AdminEmployee[] = [
    ...employees,
    ...localEmployees.filter(le => !supabaseIds.has(le.id)),
  ];

  const tabs: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'info',      label: 'Informacje',    icon: <Building2 size={13} /> },
    { id: 'contacts',  label: 'Kontakty',      icon: <Phone size={13} /> },
    { id: 'employees', label: `Kartoteka pracowników (${mergedEmployees.length})`, icon: <Users size={13} /> },
    { id: 'orders',    label: `Zamówienia (${orders.length})`,    icon: <ShoppingCart size={13} /> },
  ];

  // Zakładki wymagające co najmniej 1 kontaktu (jako warunek założenia konta HR)
  const lockedTabs: Section[] = contactCount === 0 ? ['employees', 'orders'] : [];
  const isLocked = (id: Section) => lockedTabs.includes(id);

  return (
    <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold">{company.name}</h2>
            <div className="flex items-center gap-3 mt-0.5 text-blue-100 text-xs">
              <span className="flex items-center gap-1"><Hash size={10} />{company.nip}</span>
              {(company.address_city || company.address_street) && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />
                  {[company.address_street, company.address_city, company.address_zip].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
          <X size={16} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto">
        {tabs.map((t) => {
          const locked = isLocked(t.id);
          return (
            <button
              key={t.id}
              onClick={() => !locked && setSection(t.id)}
              disabled={locked}
              title={locked ? 'Najpierw dodaj osobę kontaktową (konto HR)' : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                locked
                  ? 'text-slate-300 cursor-not-allowed'
                  : section === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              {locked ? <Lock size={11} className="text-slate-300" /> : t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Informacje */}
        {section === 'info' && (
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Nazwa" value={company.name} />
            <InfoRow label="NIP" value={company.nip} />
            <InfoRow label="KRS" value={company.krs} />
            <InfoRow label="REGON" value={company.regon} />
            <InfoRow label="Ulica" value={company.address_street} />
            <InfoRow label="Miasto" value={company.address_city} />
            <InfoRow label="Kod pocztowy" value={company.address_zip} />
            <InfoRow label="Pochodzenie" value={company.origin} />
            <InfoRow label="Saldo (pending)" value={`${company.balance_pending?.toLocaleString('pl-PL') ?? 0} pkt`} />
            <InfoRow label="Saldo (aktywne)" value={`${company.balance_active?.toLocaleString('pl-PL') ?? 0} pkt`} />

            {/* Fee percent — inline edit */}
            <div className="col-span-2 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Opłata serwisowa</p>
              {feeEdit ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={15}
                    max={31}
                    step={0.5}
                    value={feeValue}
                    onChange={e => { setFeeValue(e.target.value); setFeeError(null); }}
                    className="w-24 px-2 py-1 border border-blue-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <span className="text-sm text-slate-500">% (zakres 15–31)</span>
                  <button
                    onClick={handleFeeSubmit}
                    disabled={feeSaving}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                  >
                    {feeSaving ? 'Zapisuję...' : 'Zapisz'}
                  </button>
                  <button
                    onClick={() => { setFeeEdit(false); setFeeValue(String(company.fee_percent ?? 20)); setFeeError(null); }}
                    className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                  >
                    Anuluj
                  </button>
                  {feeError && <span className="text-red-500 text-xs">{feeError}</span>}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-800">{feeValue}%</span>
                  <button
                    onClick={() => setFeeEdit(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edytuj
                  </button>
                </div>
              )}
            </div>

            {/* Voucher expiry day + time — inline edit */}
            <div className="col-span-2 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Data i godzina wygaśnięcia voucherów</p>
              {expiryEdit ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Day */}
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Dzień:</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        step={1}
                        value={expiryDay}
                        onChange={e => { setExpiryDay(e.target.value); setExpiryError(null); }}
                        className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                        autoFocus
                      />
                    </div>
                    {/* Hour */}
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Godz.:</label>
                      <select
                        value={expiryHour}
                        onChange={e => { setExpiryHour(e.target.value); setExpiryError(null); }}
                        className="w-20 px-2 py-1 border border-amber-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                    {/* Minute */}
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Min.:</label>
                      <select
                        value={expiryMinute}
                        onChange={e => { setExpiryMinute(e.target.value); setExpiryError(null); }}
                        className="w-20 px-2 py-1 border border-amber-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExpirySubmit}
                      disabled={expirySaving}
                      className="px-3 py-1 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition disabled:opacity-60"
                    >
                      {expirySaving ? 'Zapisuję...' : 'Zapisz'}
                    </button>
                    <button
                      onClick={() => {
                        setExpiryEdit(false);
                        setExpiryDay(String(company.voucher_expiry_day ?? 10));
                        setExpiryHour(String(company.voucher_expiry_hour ?? 0).padStart(2, '0'));
                        setExpiryMinute(String(company.voucher_expiry_minute ?? 5).padStart(2, '0'));
                        setExpiryError(null);
                      }}
                      className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                    >
                      Anuluj
                    </button>
                    {expiryError && <span className="text-red-500 text-xs">{expiryError}</span>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-800">
                    {expiryDay}. dzień miesiąca, godz. {expiryHour}:{expiryMinute}
                  </span>
                  <button
                    onClick={() => setExpiryEdit(true)}
                    className="text-xs text-amber-600 hover:underline"
                  >
                    Edytuj
                  </button>
                </div>
              )}
            </div>

            {hrOperators.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Konto HR (Pracodawca)
                </p>
                <div className="space-y-2">
                  {hrOperators.map((hr) => (
                    <div key={hr.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                        {(hr.full_name ?? '?').charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{hr.full_name ?? 'Brak nazwy'}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail size={10} />{hr.email}
                          {hr.phone_number && <><Phone size={10} className="ml-2" />{hr.phone_number}</>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Kontakty */}
        {section === 'contacts' && (
          <ContactsSection
            companyId={company.id}
            onCountChange={setContactCount}
          />
        )}

        {/* Zablokowana zakładka — brak kontaktu/konta HR */}
        {(section === 'employees' || section === 'orders') && contactCount === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <PhoneCall size={24} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Brak osoby kontaktowej</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Przed dostępem do tej sekcji musisz dodać kontakt firmy
                i założyć konto <span className="font-semibold text-blue-600">Operatora HR</span>,
                który będzie zarządzał zamówieniami i katalogiem pracowników.
              </p>
            </div>
            <button
              onClick={() => setSection('contacts')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
            >
              <PhoneCall size={14} />
              Przejdź do Kontaktów
            </button>
          </div>
        )}

        {/* Pracownicy */}
        {section === 'employees' && contactCount !== 0 && (
          <>
            {empLoading && (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-blue-500" />
              </div>
            )}
            {empError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                <AlertCircle size={14} />{empError}
              </div>
            )}
            {!empLoading && (
              <AdminEmployeeTable
                employees={mergedEmployees}
                onRefresh={fetchEmployees}
              />
            )}
          </>
        )}

        {/* Zamówienia */}
        {section === 'orders' && contactCount !== 0 && (
          <>
            {ordLoading && (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-blue-500" />
              </div>
            )}
            {ordError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                <AlertCircle size={14} />{ordError}
              </div>
            )}
            {!ordLoading && (
              <AdminOrdersSection
                orders={orders}
                companyId={company.id}
                onRefresh={fetchOrders}
              />
            )}
          </>
        )}

      </div>
    </div>
  );
};

// ── Helper ───────────────────────────────────────────────────────────────────

const InfoRow: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-sm text-slate-800">{value ?? '—'}</p>
  </div>
);
