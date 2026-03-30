
import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Briefcase, MapPin, Settings, Database, Lock } from 'lucide-react';
import { Company, User, Role } from '../../../types';
import { Tabs } from '../../ui/Tabs';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';

interface CompanyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: Company; // If undefined -> Create Mode
  users: User[]; // For selecting CRM structure
  onSave: (data: Partial<Company>) => void;
}

export const CompanyEditModal: React.FC<CompanyEditModalProps> = ({ 
  isOpen, onClose, company, users, onSave 
}) => {
  const isEditMode = !!company;
  const isCrmSynced = company?.origin === 'CRM_SYNC';

  // --- FORM STATES ---
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'CRM' | 'SETTINGS'>('GENERAL');
  
  // General
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');

  // CRM
  const [directorId, setDirectorId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [advisorId, setAdvisorId] = useState('');

  // Settings
  const [customValidity, setCustomValidity] = useState<number | ''>('');
  const [customPayment, setCustomPayment] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
        if (company) {
            setName(company.name);
            setNip(company.nip);
            setStreet(company.address?.street || '');
            setCity(company.address?.city || '');
            setZipCode(company.address?.zipCode || '');
            
            setDirectorId(company.directorId || '');
            setManagerId(company.managerId || '');
            setAdvisorId(company.advisorId || '');
            
            setCustomValidity(company.customVoucherValidityDays ?? '');
            setCustomPayment(company.customPaymentTermsDays ?? '');
        } else {
            // Reset for new
            setName('');
            setNip('');
            setStreet(''); setCity(''); setZipCode('');
            setDirectorId(''); setManagerId(''); setAdvisorId('');
            setCustomValidity(''); setCustomPayment('');
        }
        setActiveTab('GENERAL');
    }
  }, [isOpen, company]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const payload: Partial<Company> = {
          name,
          nip,
          address: { street, city, zipCode },
          directorId,
          managerId,
          advisorId,
          customVoucherValidityDays: customValidity === '' ? undefined : Number(customValidity),
          customPaymentTermsDays: customPayment === '' ? undefined : Number(customPayment)
      };

      onSave(payload);
      onClose();
  };

  // --- HELPERS ---
  const directors = users.filter(u => u.role === Role.DIRECTOR && u.status === 'ACTIVE');
  const managers = users.filter(u => u.role === Role.MANAGER && u.status === 'ACTIVE');
  const advisors = users.filter(u => u.role === Role.ADVISOR && u.status === 'ACTIVE');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Building2 size={20} className="text-indigo-600"/>
                        {isEditMode ? 'Edycja Firmy' : 'Nowa Firma'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        Konfiguracja profilu klienta
                        {isCrmSynced && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-orange-200 flex items-center gap-1"><Database size={10}/> Sync: Central CRM</span>}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition">
                    <X size={20}/>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6 gap-6">
                <Tabs 
                    activeTab={activeTab}
                    onChange={(id) => setActiveTab(id as any)}
                    variant="underline"
                    items={[
                        { id: 'GENERAL', label: 'Dane Podstawowe', icon: <MapPin size={16}/> },
                        { id: 'CRM', label: 'Opiekunowie (CRM)', icon: <Briefcase size={16}/> },
                        { id: 'SETTINGS', label: 'Ustawienia', icon: <Settings size={16}/> },
                    ]}
                />
            </div>

            {/* Content */}
            <form id="company-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                
                {isCrmSynced && (
                    <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg mb-6 flex gap-3 text-sm text-orange-800">
                        <Lock size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Dane zarządzane przez zewnętrzny CRM</p>
                            <p className="text-xs opacity-80 mt-1">Pola takie jak Nazwa, NIP czy Opiekunowie są synchronizowane automatycznie. Ich edycja w EBS jest zablokowana, aby zachować spójność danych.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'GENERAL' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Input 
                                    label="Pełna Nazwa Firmy *" 
                                    required 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    disabled={isCrmSynced}
                                    placeholder="np. TechSolutions Sp. z o.o."
                                />
                            </div>
                            <div>
                                <Input 
                                    label="NIP *" 
                                    required 
                                    value={nip} 
                                    onChange={e => setNip(e.target.value)} 
                                    disabled={isCrmSynced}
                                    placeholder="000-000-00-00"
                                />
                            </div>
                            {isCrmSynced && (
                                <div>
                                    <Input 
                                        label="External ID (CRM)" 
                                        value={company?.externalCrmId || 'N/A'} 
                                        disabled
                                        className="font-mono text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><MapPin size={14}/> Adres Siedziby</h4>
                            <div className="space-y-3">
                                <div>
                                    <Input 
                                        label="Ulica i Numer" 
                                        value={street} 
                                        onChange={e => setStreet(e.target.value)} 
                                        disabled={isCrmSynced}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-1">
                                        <Input 
                                            label="Kod Pocztowy" 
                                            value={zipCode} 
                                            onChange={e => setZipCode(e.target.value)} 
                                            disabled={isCrmSynced}
                                            placeholder="00-000"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input 
                                            label="Miejscowość" 
                                            value={city} 
                                            onChange={e => setCity(e.target.value)} 
                                            disabled={isCrmSynced}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'CRM' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800">
                            Przypisz opiekunów, aby automatycznie naliczać prowizje od opłaconych zamówień tej firmy.
                        </div>

                        <div>
                            <Select 
                                label="Dyrektor Handlowy"
                                value={directorId} 
                                onChange={e => setDirectorId(e.target.value)} 
                                disabled={isCrmSynced}
                                options={[
                                    { value: '', label: '-- Brak --' },
                                    ...directors.map(u => ({ value: u.id, label: u.name }))
                                ]}
                            />
                        </div>

                        <div>
                            <Select 
                                label="Manager Regionu"
                                value={managerId} 
                                onChange={e => setManagerId(e.target.value)} 
                                disabled={isCrmSynced}
                                options={[
                                    { value: '', label: '-- Brak --' },
                                    ...managers.map(u => ({ value: u.id, label: u.name }))
                                ]}
                            />
                        </div>

                        <div>
                            <Select 
                                label="Doradca Klienta (Opiekun)"
                                value={advisorId} 
                                onChange={e => setAdvisorId(e.target.value)} 
                                disabled={isCrmSynced}
                                options={[
                                    { value: '', label: '-- Brak --' },
                                    ...advisors.map(u => ({ value: u.id, label: u.name }))
                                ]}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <h4 className="font-bold text-slate-800 text-sm mb-4">Parametry Indywidualne (EBS)</h4>
                            <p className="text-xs text-slate-500 mb-4">Te ustawienia są specyficzne dla platformy benefitowej i mogą być edytowane niezależnie od CRM.</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <Input 
                                        label="Ważność Vouchera (Dni)"
                                        type="number" 
                                        value={customValidity} 
                                        onChange={e => setCustomValidity(e.target.value === '' ? '' : Number(e.target.value))} 
                                        className="text-center font-bold"
                                        placeholder="Globalnie"
                                        rightElement={<span className="text-xs text-slate-500">Pozostaw puste = Globalne</span>}
                                    />
                                </div>

                                <div>
                                    <Input 
                                        label="Termin Płatności Faktur (Dni)"
                                        type="number" 
                                        value={customPayment} 
                                        onChange={e => setCustomPayment(e.target.value === '' ? '' : Number(e.target.value))} 
                                        className="text-center font-bold"
                                        placeholder="Globalnie"
                                        rightElement={<span className="text-xs text-slate-500">Kredyt Kupiecki</span>}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </form>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>Anuluj</Button>
                <Button 
                    type="submit"
                    form="company-form"
                    icon={<Save size={16}/>}
                >
                    {isEditMode ? 'Zapisz Zmiany' : 'Utwórz Firmę'}
                </Button>
            </div>
        </div>
    </div>
  );
};
