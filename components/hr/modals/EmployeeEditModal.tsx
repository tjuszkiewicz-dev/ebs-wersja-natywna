
import React, { useState, useEffect } from 'react';
import { X, Save, User as UserIcon, Building2, CreditCard, Phone, AlertCircle, ShieldCheck, KeyRound, Eye, EyeOff, Copy, RefreshCw, Check } from 'lucide-react';
import { User, ContractType, UserStatus } from '../../../types';
import { validatePLIBAN } from '../../../services/payrollService';
import { Input } from '../../ui/Input';
import { PhoneInput } from '../../ui/PhoneInput';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

interface EmployeeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (userId: string, data: Partial<User>) => void;
}

export const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({ 
  isOpen, onClose, user, onSave 
}) => {
  // --- FORM STATES ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [privateEmail, setPrivateEmail] = useState('');
  const [pesel, setPesel] = useState('');
  const [phone, setPhone] = useState('');
  
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [costCenter, setCostCenter] = useState(''); 
  
  const [contractType, setContractType] = useState<ContractType>(ContractType.UOP);
  const [status, setStatus] = useState<UserStatus | 'NOTICE_PERIOD'>('ACTIVE');
  
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');

  const [iban, setIban] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsDate, setTermsDate] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [ibanError, setIbanError] = useState<string | undefined>(undefined);

  // --- PASSWORD MANAGEMENT ---
  const [credPassword, setCredPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Initialize form on open
  useEffect(() => {
    if (isOpen) {
        setName(user.name);
        setEmail(user.email);
        setPrivateEmail((user as any).identity?.privateEmail || '');
        setPesel(user.pesel || user.identity?.pesel || '');
        setPhone(user.identity?.phoneNumber || '');
        
        setDepartment(user.department || user.organization?.department || '');
        setPosition(user.position || user.organization?.position || '');
        setHireDate(user.organization?.hireDate || '');
        setCostCenter(user.organization?.costCenter || '');
        
        setContractType(user.contract?.type || ContractType.UOP);
        setStatus(user.status as any);
        
        setStreet(user.address?.street || '');
        setCity(user.address?.city || '');
        setZipCode(user.address?.zipCode || '');

        setIban(user.finance?.payoutAccount?.iban || '');
        setTermsAccepted(!!user.termsAccepted);
        setTermsDate(user.termsAcceptedAt || '');
        
        setIsSaved(false);
        setIbanError(undefined);
        setCredPassword((user as any).tempPassword ?? null);
        setShowPassword(false);
        setNewPasswordInput('');
        setIsPasswordEditing(false);
        setPasswordSaved(false);
        setCopiedCreds(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const generatePassword = () => {
    const pwd =
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      Math.random().toString(36).slice(2, 6) +
      Math.floor(10 + Math.random() * 90) +
      '!';
    setNewPasswordInput(pwd);
    setIsPasswordEditing(true);
  };

  const handleSavePassword = async () => {
    const pwd = newPasswordInput.trim();
    if (!pwd || pwd.length < 8) return;
    setIsSavingPassword(true);
    try {
      const res = await fetch(`/api/employees/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pwd }),
      });
      if (res.ok) {
        const data = await res.json();
        setCredPassword(data.newPassword);
        setIsPasswordEditing(false);
        setNewPasswordInput('');
        setPasswordSaved(true);
        setShowPassword(true);
        setTimeout(() => setPasswordSaved(false), 3000);
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCopyCredentials = () => {
    const pwd = credPassword ?? newPasswordInput;
    const text = `Login (e-mail): ${email}\nHasło: ${pwd}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2500);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const phoneDigits = phone.replace(/^\+?48\s*/, '').replace(/\D/g, '');
      if (phoneDigits.length > 0 && phoneDigits.length !== 9) {
          setIbanError('Numer telefonu musi zawierać 9 cyfr (format +48 XXX XXX XXX)');
          return;
      }

      const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
      if (cleanIban && !validatePLIBAN(cleanIban)) {
          setIbanError("Nieprawidłowy format IBAN (PL + 26 cyfr)");
          return;
      }

      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ');

      const updates: any = {
          name, email, department, position, pesel,
          status: status as UserStatus,
          termsAccepted,
          termsAcceptedAt: termsAccepted ? (termsDate || new Date().toISOString()) : undefined,
          termsAcceptedMethod: termsAccepted && !user.termsAccepted ? 'MANUAL' : user.termsAcceptedMethod,
          
          identity: {
              ...user.identity,
              firstName: firstName || name, lastName: lastName || '', email, pesel, phoneNumber: phone, privateEmail
          },
          organization: {
              ...user.organization, department, position, hireDate, costCenter
          },
          contract: {
              ...user.contract, type: contractType
          },
          finance: {
              ...user.finance,
              payoutAccount: {
                  iban: cleanIban, country: 'PL', isVerified: !!cleanIban, verificationMethod: 'MANUAL',
                  lastVerifiedAt: cleanIban ? new Date().toISOString() : undefined
              }
          },
          address: { street, city, zipCode }
      };

      onSave(user.id, updates);
      setIsSaved(true);
      setIbanError(undefined);
      
      setTimeout(() => { onClose(); }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center">
        <div className="bg-white w-full h-[95vh] md:h-[90vh] md:max-w-4xl rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <UserIcon size={20} className="text-emerald-600"/>
                        Edycja Kartoteki Pracownika
                    </h3>
                    <p className="text-xs text-slate-500 hidden md:block">Dane kadrowe, płacowe i kontaktowe</p>
                </div>
                <button 
                    onClick={onClose} 
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shadow-sm"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50/30">
                <form id="edit-form" onSubmit={handleSubmit} className="space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <Card title="Tożsamość i Kontakt" className="md:col-span-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Imię i Nazwisko *" value={name} onChange={e => setName(e.target.value)} required />
                                <Input label="PESEL" value={pesel} onChange={e => setPesel(e.target.value)} className="font-mono"/>
                                <Input label="Email Służbowy *" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                                <Input label="Email Prywatny" type="email" value={privateEmail} onChange={e => setPrivateEmail(e.target.value)} />
                                <PhoneInput label="Telefon" value={phone} onChange={setPhone} />
                            </div>
                        </Card>

                        <Card title="Zatrudnienie i Controlling" className="md:col-span-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input label="Dział" value={department} onChange={e => setDepartment(e.target.value)} />
                                <Input label="Stanowisko" value={position} onChange={e => setPosition(e.target.value)} />
                                <Input label="MPK (Cost Center)" value={costCenter} onChange={e => setCostCenter(e.target.value)} className="font-mono bg-indigo-50/30 border-indigo-200" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <Select 
                                    label="Rodzaj Umowy"
                                    value={contractType}
                                    onChange={e => setContractType(e.target.value as ContractType)}
                                    options={[
                                        { value: ContractType.UOP, label: 'UoP (Umowa o Pracę)' },
                                        { value: ContractType.UZ, label: 'UZ (Zlecenie)' }
                                    ]}
                                />
                                <Input label="Zatrudniono od" type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />
                            </div>
                        </Card>

                        <Card title="Dane Finansowe" className="md:col-span-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Input 
                                        label="Numer Konta (IBAN)" 
                                        value={iban} 
                                        onChange={e => { setIban(e.target.value); setIbanError(undefined); }} 
                                        error={ibanError}
                                        icon={<CreditCard size={16}/>}
                                        className="font-mono"
                                        placeholder="PL 00 0000 0000..."
                                    />
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col justify-center">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                            <ShieldCheck size={16} className={termsAccepted ? "text-emerald-600" : "text-slate-400"}/>
                                            Zgoda RODO / Regulamin
                                        </span>
                                        <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"/>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">
                                        {termsAccepted ? `Zaakceptowano: ${termsDate ? new Date(termsDate).toLocaleDateString() : 'Teraz'}` : 'Brak akceptacji.'}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* ── DOSTĘP DO PLATFORMY ── */}
                        <Card title="Dostęp do Platformy EBS" className="md:col-span-2">
                          <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* E-mail / login */}
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  Login (adres e-mail)
                                </label>
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                                  <span className="font-mono text-sm text-slate-800 flex-1 select-all">{email}</span>
                                  <button
                                    type="button"
                                    onClick={() => { navigator.clipboard.writeText(email); }}
                                    title="Kopiuj e-mail"
                                    className="text-slate-400 hover:text-slate-700 transition"
                                  >
                                    <Copy size={14}/>
                                  </button>
                                </div>
                              </div>

                              {/* Hasło */}
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  Hasło tymczasowe
                                </label>
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                                  {credPassword ? (
                                    <>
                                      <span className="font-mono text-sm text-slate-800 flex-1 select-all tracking-widest">
                                        {showPassword ? credPassword : '••••••••••'}
                                      </span>
                                      <button type="button" onClick={() => setShowPassword(v => !v)} title={showPassword ? 'Ukryj' : 'Pokaż'} className="text-slate-400 hover:text-slate-700 transition">
                                        {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                                      </button>
                                      <button type="button" onClick={handleCopyCredentials} title="Kopiuj dane logowania" className="text-slate-400 hover:text-slate-700 transition">
                                        {copiedCreds ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic flex-1">Nie ustawiono — użyj opcji poniżej</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Ustaw nowe hasło */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <KeyRound size={15} className="text-amber-600"/>
                                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Ustaw nowe hasło</span>
                              </div>
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={newPasswordInput}
                                    onChange={e => { setNewPasswordInput(e.target.value); setIsPasswordEditing(true); }}
                                    placeholder="Wpisz lub wygeneruj nowe hasło..."
                                    className="w-full font-mono text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-300"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={generatePassword}
                                  className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-white text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition whitespace-nowrap"
                                >
                                  <RefreshCw size={13}/> Generuj
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSavePassword}
                                  disabled={!newPasswordInput.trim() || newPasswordInput.length < 8 || isSavingPassword}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-40 transition whitespace-nowrap"
                                >
                                  {isSavingPassword ? <RefreshCw size={13} className="animate-spin"/> : (passwordSaved ? <Check size={13}/> : <Save size={13}/>)}
                                  {passwordSaved ? 'Zapisano' : 'Zapisz'}
                                </button>
                              </div>
                              <p className="text-[10px] text-amber-600 mt-2">
                                Hasło zostanie zmienione w systemie i zapisane w kartotece pracownika. Przekaż je pracownikowi — powinien je zmienić po pierwszym logowaniu.
                              </p>
                            </div>

                            {/* Kopiuj pełne dane logowania */}
                            {credPassword && (
                              <button
                                type="button"
                                onClick={handleCopyCredentials}
                                className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
                              >
                                {copiedCreds ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                                {copiedCreds ? 'Skopiowano dane logowania!' : 'Kopiuj pełne dane logowania (e-mail + hasło)'}
                              </button>
                            )}
                          </div>
                        </Card>

                    </div>

                    <Card className="bg-slate-50 border-slate-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white border rounded-lg shadow-sm">
                                    <Building2 size={20} className="text-slate-500"/>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700">Status Pracownika</h4>
                                    <p className="text-xs text-slate-500">Wpływa na możliwość otrzymywania benefitów.</p>
                                </div>
                            </div>
                            <Select 
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                                className="w-full md:w-64"
                                options={[
                                    { value: 'ACTIVE', label: 'AKTYWNY' },
                                    { value: 'NOTICE_PERIOD', label: 'W OKRESIE WYPOWIEDZENIA' },
                                    { value: 'INACTIVE', label: 'ZWOLNIONY (ARCHIWUM)' }
                                ]}
                            />
                        </div>
                    </Card>
                </form>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-white flex gap-3 flex-shrink-0 pb-6 md:pb-4">
                <Button variant="secondary" onClick={onClose} className="flex-1">Anuluj</Button>
                <Button 
                    type="submit" 
                    form="edit-form" 
                    variant={isSaved ? 'success' : 'primary'}
                    className="flex-1"
                    disabled={isSaved}
                    icon={isSaved ? undefined : <Save size={18} />}
                >
                    {isSaved ? 'Zapisano Zmiany' : 'Zapisz Zmiany'}
                </Button>
            </div>
        </div>
    </div>
  );
};
