import React, { useState } from 'react';
import {
  X, UserPlus, Users, Building2, FileText, CreditCard, Save,
  Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { User, Company, Role, ContractType, ImportRow } from '@/types';
import { useStrattonSystem } from '@/context/StrattonContext';
import { supabaseProfileToUser } from '@/lib/supabaseToUser';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddEmployeeForm {
  firstName: string;
  lastName: string;
  email: string;
  pesel: string;
  phoneNumber: string;
  department: string;
  position: string;
  contractType: 'UOP' | 'UZ';
  iban: string;
}

const EMPTY_FORM: AddEmployeeForm = {
  firstName: '', lastName: '', email: '', pesel: '',
  phoneNumber: '', department: '', position: '',
  contractType: 'UOP', iban: '',
};

interface HRAddEmployeeModalProps {
  company: Company;
  onClose: () => void;
  onSaved: (user: User) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const HRAddEmployeeModal: React.FC<HRAddEmployeeModalProps> = ({ company, onClose, onSaved }) => {
  const { actions } = useStrattonSystem();
  const [form, setForm] = useState<AddEmployeeForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<AddEmployeeForm>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; tempPassword: string; name: string } | null>(null);

  const set = (field: keyof AddEmployeeForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const validate = (): boolean => {
    const e: Partial<AddEmployeeForm> = {};
    if (!form.firstName.trim()) e.firstName = 'Imię jest wymagane';
    if (!form.lastName.trim()) e.lastName = 'Nazwisko jest wymagane';
    if (!form.email.trim()) {
      e.email = 'Email jest wymagany';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Nieprawidłowy format adresu email';
    }
    if (form.pesel && !/^\d{11}$/.test(form.pesel.trim())) {
      e.pesel = 'PESEL musi mieć dokładnie 11 cyfr';
    }
    if (form.iban) {
      const raw = form.iban.replace(/\s+/g, '');
      if (!/^[A-Z]{2}\d+$/.test(raw) || raw.length < 15 || raw.length > 34) {
        e.iban = 'Nieprawidłowy format numeru IBAN';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSaving(true);
    setServerError(null);

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const normalizedEmail = form.email.trim().toLowerCase();

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId:    company.id,
          firstName:    form.firstName.trim(),
          lastName:     form.lastName.trim(),
          email:        normalizedEmail,
          pesel:        form.pesel.trim() || undefined,
          department:   form.department.trim() || undefined,
          position:     form.position.trim() || undefined,
          phoneNumber:  form.phoneNumber.trim() || undefined,
          iban:         form.iban.replace(/\s+/g, '') || undefined,
          contractType: form.contractType,
        }),
      });

      let userId = `new-${Date.now()}`;
      let tempPassword: string | null = null;

      if (res.ok) {
        const data = await res.json();
        userId = data.id ?? userId;
        tempPassword = data.tempPassword ?? null;
      } else {
        // Fallback lokalny gdy API niedostępne (tryb demo)
        const importRow: ImportRow = {
          rowId: 1, name: form.firstName.trim(), surname: form.lastName.trim(),
          email: normalizedEmail, pesel: form.pesel.trim(),
          department: form.department.trim(), position: form.position.trim(),
          isValid: true, errors: [],
          phoneNumber: form.phoneNumber.trim() || undefined,
          iban: form.iban.replace(/\s+/g, '') || undefined,
          contractType: form.contractType,
        };
        await actions.handleBulkImport([importRow], company.id);
      }

      // Odśwież listę pracowników z Supabase
      fetch('/api/users')
        .then(r => r.ok ? r.json() : [])
        .then((profiles: any[]) => {
          const mapped = profiles.map((p: any) =>
            supabaseProfileToUser(p, p.email ?? '', p.company_id ?? '')
          );
          actions.setUsers(mapped);
        })
        .catch(() => {});

      if (tempPassword) {
        setCreatedCredentials({ email: normalizedEmail, tempPassword, name: fullName });
        return;
      }

      const newUser: User = {
        id: userId,
        role: Role.EMPLOYEE,
        companyId: company.id,
        name: fullName,
        email: normalizedEmail,
        pesel: form.pesel.trim() || undefined,
        department: form.department.trim() || undefined,
        position: form.position.trim() || undefined,
        voucherBalance: 0,
        status: 'ACTIVE',
        isTwoFactorEnabled: false,
        identity: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          pesel: form.pesel.trim(),
          email: form.email.trim().toLowerCase(),
          phoneNumber: form.phoneNumber.trim() || undefined,
        },
        organization: {
          department: form.department.trim(),
          position: form.position.trim(),
        },
        contract: {
          type: form.contractType === 'UZ' ? ContractType.UZ : ContractType.UOP,
        },
        finance: form.iban ? {
          payoutAccount: {
            iban: form.iban.replace(/\s+/g, ''),
            country: 'PL',
            isVerified: true,
            verificationMethod: 'MANUAL',
          },
        } : undefined,
      } as unknown as User;

      onSaved(newUser);
    } catch {
      setServerError('Wystąpił błąd podczas zapisywania pracownika. Spróbuj ponownie.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = (field: keyof AddEmployeeForm) =>
    `w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-1 transition-colors ${
      errors[field] ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-200'
    }`;

  // Widok danych logowania po pomyślnym utworzeniu konta
  if (createdCredentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-green-100 rounded-lg">
              <CheckCircle2 size={18} className="text-green-600"/>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Konto zostało utworzone</h2>
              <p className="text-xs text-gray-500 mt-0.5">{createdCredentials.name}</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
              Zapisz te dane teraz — hasło dostępowe będzie widoczne również w karcie pracownika.
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Login (email)</p>
                <p className="text-sm font-mono font-bold text-gray-900 select-all">{createdCredentials.email}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Hasło dostępowe</p>
                <p className="text-sm font-mono font-bold text-gray-900 select-all tracking-widest">{createdCredentials.tempPassword}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Hasło jest widoczne w karcie pracownika w Kartotece.
            </p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end">
            <button
              onClick={() => {
                const newUser: User = {
                  id: `new-${Date.now()}`, role: Role.EMPLOYEE, companyId: company.id,
                  name: createdCredentials.name, email: createdCredentials.email,
                  voucherBalance: 0, status: 'ACTIVE', isTwoFactorEnabled: false,
                };
                onSaved(newUser as any);
              }}
              className="px-5 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-lg">
              <UserPlus size={18} className="text-blue-600"/>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Dodaj pracownika</h2>
              <p className="text-xs text-gray-500 mt-0.5">{company.name}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">

          {serverError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={15} className="shrink-0"/>
              {serverError}
            </div>
          )}

          {/* Dane osobowe */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Users size={13}/> Dane osobowe
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Imię<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" placeholder="np. Jan" value={form.firstName} onChange={set('firstName')} className={inputCls('firstName')}/>
                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nazwisko<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" placeholder="np. Kowalski" value={form.lastName} onChange={set('lastName')} className={inputCls('lastName')}/>
                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email<span className="text-red-500 ml-0.5">*</span></label>
                <input type="email" placeholder="jan.kowalski@firma.pl" value={form.email} onChange={set('email')} className={inputCls('email')}/>
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">PESEL</label>
                <input type="text" placeholder="12345678901" value={form.pesel} onChange={set('pesel')} className={inputCls('pesel')}/>
                {errors.pesel ? <p className="mt-1 text-xs text-red-600">{errors.pesel}</p> : <p className="mt-1 text-xs text-gray-400">Opcjonalnie — 11 cyfr</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Numer telefonu</label>
                <input type="text" placeholder="+48 600 000 000" value={form.phoneNumber} onChange={set('phoneNumber')} className={inputCls('phoneNumber')}/>
                <p className="mt-1 text-xs text-gray-400">Opcjonalnie</p>
              </div>
            </div>
          </div>

          {/* Dane organizacyjne */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Building2 size={13}/> Dane organizacyjne
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Dział</label>
                <input type="text" placeholder="np. Księgowość" value={form.department} onChange={set('department')} className={inputCls('department')}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Stanowisko</label>
                <input type="text" placeholder="np. Specjalista ds. kadr" value={form.position} onChange={set('position')} className={inputCls('position')}/>
              </div>
            </div>
          </div>

          {/* Typ umowy */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText size={13}/> Typ umowy
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Typ umowy</label>
              <select
                value={form.contractType}
                onChange={set('contractType')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              >
                <option value="UOP">Umowa o Pracę (UoP)</option>
                <option value="UZ">Umowa Zlecenie (UZ)</option>
              </select>
            </div>
          </div>

          {/* Konto bankowe */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CreditCard size={13}/> Konto bankowe
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Numer IBAN</label>
              <input type="text" placeholder="PL 61 1090 1014 0000 0712 1981 2874" value={form.iban} onChange={set('iban')} className={inputCls('iban')}/>
              {errors.iban ? <p className="mt-1 text-xs text-red-600">{errors.iban}</p> : <p className="mt-1 text-xs text-gray-400">Opcjonalnie — numer rachunku do wypłat voucherów</p>}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl shrink-0">
          <p className="text-xs text-gray-400">
            Pracownik otrzyma email z hasłem tymczasowym do logowania.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={isSaving}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-60">
              Anuluj
            </button>
            <button onClick={handleSubmit} disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {isSaving
                ? <><Loader2 size={14} className="animate-spin"/> Zapisywanie...</>
                : <><Save size={14}/> Utwórz konto</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
