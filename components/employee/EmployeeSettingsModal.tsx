
import React, { useState, useEffect } from 'react';
import { X, Save, CreditCard, ShieldCheck, AlertCircle, Clock, FileText, Lock, Smartphone, Check, KeyRound, User as UserIcon, Mail, Briefcase, Phone, HelpCircle, LogOut } from 'lucide-react';
import { User, UserFinance } from '../../types';
import { validatePLIBAN } from '../../services/payrollService';
import { useStrattonSystem } from '../../context/StrattonContext';
import { Tabs } from '../ui/Tabs';
import { MaskedData } from '../ui/MaskedData';

interface EmployeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (financeData: UserFinance) => void; // Legacy fallback
}

export const EmployeeSettingsModal: React.FC<EmployeeSettingsModalProps> = ({ 
  isOpen, onClose, user, onSave 
}) => {
  const { actions } = useStrattonSystem();
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'FINANCE' | 'SECURITY'>('PROFILE');
  
  // Finance State
  const [iban, setIban] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Security State
  const [showQr, setShowQr] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [is2FaEnabled, setIs2FaEnabled] = useState(user.isTwoFactorEnabled || false);

  const pendingChange = user.finance?.pendingChange;
  const isPending = pendingChange?.status === 'PENDING';
  const isRejected = pendingChange?.status === 'REJECTED';

  // Load existing data
  useEffect(() => {
    if (isOpen) {
        if (isPending && pendingChange) {
            setIban(pendingChange.newIban);
            setReason(pendingChange.reason);
        } else {
            setIban(user.finance?.payoutAccount?.iban || '');
            setReason('');
        }
        setIs2FaEnabled(user.isTwoFactorEnabled || false);
        setShowQr(false);
        setVerificationCode('');
        setActiveTab('PROFILE'); // Default to Profile on open
    }
    setError(null);
    setIsSaved(false);
  }, [isOpen, user, isPending]);

  if (!isOpen) return null;

  const handleRequestChange = () => {
      // Basic formatting
      const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
      const currentIban = user.finance?.payoutAccount?.iban;

      // Validation
      if (!validatePLIBAN(cleanIban)) {
          setError('Nieprawidłowy numer rachunku bankowego (IBAN). Sprawdź sumę kontrolną.');
          return;
      }

      if (cleanIban === currentIban) {
          setError('Podany numer jest identyczny z aktualnym.');
          return;
      }

      if (!reason || reason.length < 5) {
          setError('Proszę podać uzasadnienie zmiany konta (min. 5 znaków).');
          return;
      }

      // SEND REQUEST VIA CONTEXT
      actions.handleRequestIbanChange(user.id, cleanIban, reason);
      
      setIsSaved(true);
      setTimeout(() => {
          // Stay on modal but show success state
      }, 500);
  };

  const handleToggle2Fa = () => {
      if (!is2FaEnabled) {
          // Enable Flow: Show QR -> Verify Code
          setShowQr(true);
      } else {
          // Disable Flow: Confirm -> Disable
          if (confirm("Czy na pewno wyłączyć 2FA? Twoje konto będzie mniej bezpieczne.")) {
              actions.handleToggleTwoFactor(user.id, false);
              setIs2FaEnabled(false);
          }
      }
  };

  const handleVerifyCode = () => {
      if (verificationCode === '123456') {
          actions.handleToggleTwoFactor(user.id, true);
          setIs2FaEnabled(true);
          setShowQr(false);
      } else {
          alert("Błędny kod! (Demo: 123456)");
      }
  };

  const formatDisplayIban = (val: string) => {
      // Insert space every 4 chars for readability
      return val.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim().toUpperCase();
  };

  // --- RENDERERS ---

  const renderProfileTab = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Identity Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <div className="flex items-center gap-4 relative z-10">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-2xl font-bold border-4 border-slate-700 shadow-md">
                      {user.name.charAt(0)}
                  </div>
                  <div>
                      <h3 className="text-xl font-bold">{user.name}</h3>
                      <p className="text-slate-400 text-sm">{user.organization?.position || user.position || 'Pracownik'}</p>
                  </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700/50 flex flex-col gap-2 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                      <Mail size={14} className="opacity-70"/> {user.email}
                  </div>
                  <div className="flex items-center gap-2">
                      <Briefcase size={14} className="opacity-70"/> {user.organization?.department || user.department}
                  </div>
                  {user.pesel && (
                      <div className="flex items-center gap-2">
                          <UserIcon size={14} className="opacity-70"/> <span className="opacity-70">PESEL:</span> <MaskedData value={user.pesel} type="PESEL" />
                      </div>
                  )}
              </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-blue-800 text-xs">
              <HelpCircle size={20} className="shrink-0 mt-0.5"/>
              <p>
                  Twoje dane osobowe (Imię, Nazwisko, Stanowisko) są synchronizowane z systemem kadrowym. 
                  Jeśli widzisz błąd, skontaktuj się z działem HR.
              </p>
          </div>

          <button 
              onClick={() => { onClose(); actions.logout(); }}
              className="w-full py-3 border border-red-100 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold flex items-center justify-center gap-2 transition"
          >
              <LogOut size={18}/> Wyloguj się z tego urządzenia
          </button>
      </div>
  );

  const renderFinanceTab = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <CreditCard size={18} className="text-emerald-600"/> Twoje Konto do Wypłat
                  </h4>
                  {/* Status Badge */}
                  {isPending ? (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <Clock size={10}/> Weryfikacja
                      </span>
                  ) : user.finance?.payoutAccount?.isVerified ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <ShieldCheck size={10}/> Zweryfikowane
                      </span>
                  ) : (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full">
                          Brak danych
                      </span>
                  )}
              </div>

              {/* Current Data Display */}
              {!isPending && !isRejected && (
                  <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Aktualny numer IBAN</p>
                      <div className="font-mono text-sm text-slate-700 font-bold break-all">
                          <MaskedData value={user.finance?.payoutAccount?.iban || ''} type="IBAN" />
                      </div>
                  </div>
              )}

              {/* Status Messages */}
              {isPending && (
                  <div className="mb-4 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                      <strong>Wniosek w toku.</strong> Oczekujemy na zatwierdzenie zmiany na numer:
                      <br/><span className="font-mono mt-1 block font-bold">{formatDisplayIban(pendingChange?.newIban || '')}</span>
                  </div>
              )}

              {isRejected && (
                  <div className="mb-4 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-800 flex gap-2">
                      <AlertCircle size={16} className="shrink-0"/>
                      <div>
                          <strong>Wniosek odrzucony.</strong>
                          <br/>Powód: {pendingChange?.rejectionReason}
                      </div>
                  </div>
              )}

              {/* Form */}
              <div className={`space-y-4 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div>
                      <label className="label-text">Zmień Numer (IBAN)</label>
                      <input 
                          type="text" 
                          placeholder="PL 00 0000 0000 0000 0000 0000 0000"
                          value={iban}
                          onChange={(e) => { setIban(e.target.value); setError(null); }}
                          className={`input-field font-mono text-sm ${error ? 'border-red-300 bg-red-50' : ''}`}
                      />
                  </div>
                  <div>
                      <label className="label-text">Powód zmiany</label>
                      <textarea 
                          placeholder="Np. zmiana banku..."
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="input-field resize-none h-20 text-sm"
                      />
                  </div>
                  
                  {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

                  <button 
                      onClick={handleRequestChange}
                      disabled={isSaved || isPending}
                      className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${
                          isSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                  >
                      {isSaved ? <Check size={16}/> : <Save size={16}/>}
                      {isSaved ? 'Wniosek Wysłany' : 'Wyślij Wniosek'}
                  </button>
              </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center px-4">
              Wszystkie zmiany numerów kont podlegają weryfikacji przez Dział Kadr (HR) oraz audytowi bezpieczeństwa.
          </p>
      </div>
  );

  const renderSecurityTab = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          
          {/* 2FA Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Smartphone size={18} className="text-indigo-600"/> Weryfikacja 2-etapowa
                  </h4>
                  <button 
                      onClick={handleToggle2Fa}
                      className={`relative w-10 h-6 rounded-full transition-colors ${is2FaEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${is2FaEnabled ? 'translate-x-4' : ''}`}></div>
                  </button>
              </div>
              
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Zabezpiecz swoje konto kodem jednorazowym z aplikacji (Google Authenticator, Authy).
                  {is2FaEnabled 
                      ? <span className="text-emerald-600 font-bold block mt-1">Status: Aktywne</span> 
                      : <span className="text-slate-400 block mt-1">Status: Nieaktywne</span>
                  }
              </p>

              {showQr && !is2FaEnabled && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center animate-in fade-in">
                      <div className="w-32 h-32 bg-white mx-auto mb-3 flex items-center justify-center border border-slate-200 rounded-lg">
                          {/* Mock QR */}
                          <Smartphone size={40} className="text-slate-300"/>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-3">Zeskanuj kod w aplikacji i wpisz wynik:</p>
                      <div className="flex gap-2 justify-center">
                          <input 
                              type="text" 
                              maxLength={6}
                              value={verificationCode}
                              onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="123456" 
                              className="input-field w-24 text-center font-mono tracking-widest text-lg h-10 p-0"
                          />
                          <button 
                              onClick={handleVerifyCode}
                              className="bg-indigo-600 text-white px-3 rounded-lg font-bold text-sm hover:bg-indigo-700"
                          >
                              OK
                          </button>
                      </div>
                  </div>
              )}
          </div>

          {/* Password Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
                  <KeyRound size={18} className="text-slate-500"/> Zmiana Hasła
              </h4>
              <div className="space-y-3">
                  <input type="password" placeholder="Obecne hasło" className="input-field text-sm" />
                  <input type="password" placeholder="Nowe hasło" className="input-field text-sm" />
                  <button className="w-full py-2 bg-white border border-slate-300 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 transition">
                      Aktualizuj Hasło
                  </button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col h-[90vh] md:h-auto">
            
            {/* Header */}
            <div className="bg-white border-b border-slate-100 shrink-0">
                <div className="flex justify-between items-center px-5 py-4">
                    <h3 className="font-bold text-slate-800 text-lg">Mój Profil</h3>
                    <button onClick={onClose} className="bg-slate-50 hover:bg-slate-100 p-2 rounded-full text-slate-500 transition">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Navigation Tabs */}
                <div className="px-5 pb-0 flex gap-6 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('PROFILE')}
                        className={`pb-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'PROFILE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Wizytówka
                    </button>
                    <button 
                        onClick={() => setActiveTab('FINANCE')}
                        className={`pb-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'FINANCE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Finanse (Odkup)
                    </button>
                    <button 
                        onClick={() => setActiveTab('SECURITY')}
                        className={`pb-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'SECURITY' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Bezpieczeństwo
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/50">
                {activeTab === 'PROFILE' && renderProfileTab()}
                {activeTab === 'FINANCE' && renderFinanceTab()}
                {activeTab === 'SECURITY' && renderSecurityTab()}
            </div>
            
            {/* Safe Area */}
            <div className="pb-safe-bottom bg-white shrink-0"></div> 
        </div>
    </div>
  );
};
