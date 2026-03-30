
import React, { useState, useEffect } from 'react';
import { X, Save, User as UserIcon, Building2, CreditCard, Phone, AlertCircle, ShieldCheck } from 'lucide-react';
import { User, ContractType, UserStatus } from '../../../types';
import { validatePLIBAN } from '../../../services/payrollService';
import { Input } from '../../ui/Input';
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
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
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
                                <Input label="Telefon" type="tel" value={phone} onChange={e => setPhone(e.target.value)} icon={<Phone size={16}/>} />
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
