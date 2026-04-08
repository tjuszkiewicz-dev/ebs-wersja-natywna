import React, { useState, useEffect } from 'react';
import { X, Save, User as UserIcon, Mail, Phone, Building2, Hash, MapPin, Check, Loader2 } from 'lucide-react';
import { User } from '../../types';
import { useStrattonSystem } from '../../context/StrattonContext';

interface HRSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  company: unknown;
}

type Tab = 'PROFILE' | 'COMPANY';

interface CompanyForm {
  name: string;
  nip: string;
  krs: string;
  regon: string;
  address_street: string;
  address_city: string;
  address_zip: string;
}

export const HRSettingsModal: React.FC<HRSettingsModalProps> = ({
  isOpen, onClose, currentUser,
}) => {
  const { actions } = useStrattonSystem();
  const [activeTab, setActiveTab] = useState<Tab>('PROFILE');

  // Profile
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Company
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: '', nip: '', krs: '', regon: '',
    address_street: '', address_city: '', address_zip: '',
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(currentUser.name || '');
    setPhone(currentUser.identity?.phoneNumber || '');
    setProfileSaved(false);
    setProfileError(null);
    setActiveTab('PROFILE');

    // Fetch company via API (proxy → Next.js)
    if (!currentUser.companyId) return;
    setCompanyLoading(true);
    fetch(`/api/companies/${currentUser.companyId}`)
      .then(r => r.json())
      .then(row => {
        setCompanyLoading(false);
        if (!row || row.error) return;
        setCompanyId(row.id);
        setCompanyForm({
          name:           row.name ?? '',
          nip:            row.nip ?? '',
          krs:            row.krs ?? '',
          regon:          row.regon ?? '',
          address_street: row.address_street ?? '',
          address_city:   row.address_city ?? '',
          address_zip:    row.address_zip ?? '',
        });
      })
      .catch(() => setCompanyLoading(false));
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSaveProfile = async () => {
    if (!name.trim()) { setProfileError('Imię i nazwisko nie może być puste.'); return; }
    setProfileError(null);
    setProfileSaving(true);
    await actions.handleUpdateEmployee(currentUser.id, {
      name: name.trim(),
      identity: currentUser.identity
        ? { ...currentUser.identity, phoneNumber: phone.trim() }
        : undefined,
    });
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleSaveCompany = async () => {
    if (!companyId) return;
    setCompanyError(null);
    setCompanySaving(true);
    const res = await fetch(`/api/companies/${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:         'update_settings',
        name:           companyForm.name.trim(),
        krs:            companyForm.krs.trim() || null,
        regon:          companyForm.regon.trim() || null,
        address_street: companyForm.address_street.trim() || null,
        address_city:   companyForm.address_city.trim() || null,
        address_zip:    companyForm.address_zip.trim() || null,
      }),
    });
    setCompanySaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setCompanyError('Błąd zapisu: ' + (err?.error ?? res.statusText));
      return;
    }
    setCompanySaved(true);
    setTimeout(() => setCompanySaved(false), 2500);
  };

  const cf = (field: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCompanyForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Ustawienia konta</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 shrink-0">
          {(['PROFILE', 'COMPANY'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 mr-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'PROFILE' ? 'Mój profil' : 'Dane firmy'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              <Field label="Adres e-mail">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
                  <Mail size={15} className="shrink-0 text-slate-400" />
                  <span className="text-sm">{currentUser.email}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Adres e-mail jest zarządzany przez administratora.</p>
              </Field>

              <Field label="Imię i nazwisko">
                <InputRow icon={<UserIcon size={15} />}>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800"
                    placeholder="Imię i nazwisko" />
                </InputRow>
              </Field>

              <Field label="Telefon">
                <InputRow icon={<Phone size={15} />}>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800"
                    placeholder="+48 000 000 000" />
                </InputRow>
              </Field>

              {profileError && <p className="text-xs text-red-500">{profileError}</p>}

              <button onClick={handleSaveProfile} disabled={profileSaving}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                  profileSaved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}>
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : profileSaved ? <><Check size={16} /> Zapisano</> : <><Save size={16} /> Zapisz zmiany</>}
              </button>
            </div>
          )}

          {activeTab === 'COMPANY' && (
            companyLoading ? (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : !currentUser.companyId ? (
              <p className="text-sm text-slate-500 text-center py-6">Brak przypisanej firmy.</p>
            ) : (
              <div className="space-y-4">
                <Field label="Nazwa firmy">
                  <InputRow icon={<Building2 size={15} />}>
                    <input type="text" value={companyForm.name} onChange={cf('name')}
                      className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800" />
                  </InputRow>
                </Field>

                <Field label="NIP">
                  <InputRow icon={<Hash size={15} />}>
                    <input type="text" value={companyForm.nip} readOnly
                      className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-400 cursor-not-allowed" />
                  </InputRow>
                  <p className="text-[11px] text-slate-400 mt-1">NIP jest zarządzany przez administratora.</p>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="KRS">
                    <InputRow icon={<Hash size={15} />}>
                      <input type="text" value={companyForm.krs} onChange={cf('krs')}
                        className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800"
                        placeholder="—" />
                    </InputRow>
                  </Field>
                  <Field label="REGON">
                    <InputRow icon={<Hash size={15} />}>
                      <input type="text" value={companyForm.regon} onChange={cf('regon')}
                        className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800"
                        placeholder="—" />
                    </InputRow>
                  </Field>
                </div>

                <Field label="Ulica">
                  <InputRow icon={<MapPin size={15} />}>
                    <input type="text" value={companyForm.address_street} onChange={cf('address_street')}
                      className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800"
                      placeholder="ul. Przykładowa 1" />
                  </InputRow>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kod pocztowy">
                    <InputRow icon={<MapPin size={15} />}>
                      <input type="text" value={companyForm.address_zip} onChange={cf('address_zip')}
                        className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800"
                        placeholder="00-000" />
                    </InputRow>
                  </Field>
                  <Field label="Miasto">
                    <InputRow icon={<MapPin size={15} />}>
                      <input type="text" value={companyForm.address_city} onChange={cf('address_city')}
                        className="w-full text-sm py-2.5 outline-none bg-transparent text-slate-800"
                        placeholder="Warszawa" />
                    </InputRow>
                  </Field>
                </div>

                {companyError && <p className="text-xs text-red-500">{companyError}</p>}

                <button onClick={handleSaveCompany} disabled={companySaving}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                    companySaved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}>
                  {companySaving ? <Loader2 size={16} className="animate-spin" /> : companySaved ? <><Check size={16} /> Zapisano</> : <><Save size={16} /> Zapisz dane firmy</>}
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
    {children}
  </div>
);

const InputRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center gap-2.5 px-3 py-0.5 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition bg-white">
    <span className="shrink-0 text-slate-400">{icon}</span>
    {children}
  </div>
);
