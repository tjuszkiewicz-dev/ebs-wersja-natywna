
import React, { useState, useEffect } from 'react';
import { User, Company, BuybackAgreement } from '../../../types';
import { X, Building2, CreditCard, ShieldCheck, History, User as UserIcon, AlertTriangle, Briefcase, Phone, Mail, ArrowRight, CheckCircle, XCircle, Edit2, Save, Ban, Clock, Send } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { useStrattonSystem } from '../../../context/StrattonContext';
import { validatePLIBAN } from '../../../services/payrollService';

interface UserInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  company?: Company;
  userBuybackHistory: BuybackAgreement[];
  currentAgreementId?: string;
  onApproveCurrent?: (id: string) => void;
}

export const UserInspectionModal: React.FC<UserInspectionModalProps> = ({
  isOpen, onClose, user, company, userBuybackHistory, currentAgreementId, onApproveCurrent
}) => {
  const { actions } = useStrattonSystem();
  
  // Resolve / Reject State
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // IBAN Edit State
  const [isEditingIban, setIsEditingIban] = useState(false);
  const [newIban, setNewIban] = useState('');
  const [ibanError, setIbanError] = useState<string | null>(null);

  // Reset state on open/user change
  useEffect(() => {
      if (isOpen) {
          setIsEditingIban(false);
          setNewIban(user.finance?.payoutAccount?.iban || '');
          setIbanError(null);
          setShowRejectInput(false);
      }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const totalBuybackValue = userBuybackHistory
    .filter(b => b.status === 'APPROVED' || b.status === 'PAID')
    .reduce((acc, b) => acc + b.totalValue, 0);

  const currentAgreement = userBuybackHistory.find(b => b.id === currentAgreementId);

  // Formatting Helper
  const formatDisplayIban = (iban: string) => {
      return iban ? iban.replace(/(.{4})/g, '$1 ').trim() : 'Brak danych';
  };

  const pendingChange = user.finance?.pendingChange;
  const hasPendingIbanChange = pendingChange?.status === 'PENDING';
  const hasIban = !!user.finance?.payoutAccount?.iban;
  const phoneNumber = user.identity?.phoneNumber;

  // --- ACTIONS ---

  const handleCallEmployee = () => {
      if (!phoneNumber) return;
      window.location.href = `tel:${phoneNumber}`;
  };

  const handleRequestConfirmationEmail = () => {
      const subject = encodeURIComponent("EBS: Weryfikacja danych bankowych - Pilne");
      const body = encodeURIComponent(
`Dzień dobry,

W systemie Eliton Benefits System (EBS) odnotowaliśmy wniosek o zmianę numeru konta bankowego do wypłat.

Ze względów bezpieczeństwa oraz procedur Compliance, proszę o potwierdzenie tej dyspozycji w odpowiedzi na ten e-mail lub kontakt telefoniczny.

Szczegóły wniosku:
Nowy IBAN: ${pendingChange?.newIban || user.finance?.payoutAccount?.iban || '...'}

Pozdrawiam,
Zespół Administratorów EBS`
      );
      window.location.href = `mailto:${user.email}?subject=${subject}&body=${body}`;
  };

  // --- HANDLERS ---

  const handleResolveChangeRequest = (approved: boolean) => {
      if (!approved && !rejectReason) {
          setShowRejectInput(true);
          return;
      }
      actions.handleResolveIbanChange(user.id, approved, approved ? undefined : rejectReason);
      setShowRejectInput(false);
      setRejectReason('');
  };

  const handleSaveIban = () => {
      const clean = newIban.replace(/\s+/g, '').toUpperCase();
      
      if (!validatePLIBAN(clean)) {
          setIbanError('Nieprawidłowy format IBAN (suma kontrolna).');
          return;
      }

      // Update User via Context Action
      actions.handleUpdateUserFinance(user.id, {
          payoutAccount: {
              iban: clean,
              country: 'PL',
              isVerified: true, // Admin entered it, so it is verified
              verificationMethod: 'MANUAL',
              lastVerifiedAt: new Date().toISOString()
          }
      });

      setIsEditingIban(false);
      setIbanError(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Gradient */}
        <div className="bg-slate-900 p-6 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4">
                <UserIcon size={120} />
            </div>
            
            <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-2xl font-bold border-4 border-slate-800 shadow-lg">
                        {user.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{user.name}</h2>
                        <div className="flex items-center gap-2 text-slate-300 text-sm mt-1 font-mono">
                            {user.email}
                        </div>
                        
                        {/* Quick Verification Actions */}
                        <div className="flex gap-2 mt-3">
                            <button 
                                onClick={handleCallEmployee}
                                disabled={!phoneNumber}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition border border-slate-600 ${phoneNumber ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-transparent text-slate-600 cursor-not-allowed'}`}
                                title={phoneNumber ? `Zadzwoń: ${phoneNumber}` : 'Brak numeru telefonu'}
                            >
                                <Phone size={12} /> {phoneNumber || 'Brak Telefonu'}
                            </button>
                            <button 
                                onClick={handleRequestConfirmationEmail}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-bold transition text-white"
                            >
                                <Send size={12} /> Poproś o potwierdzenie
                            </button>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
            
            {/* ALERT: PENDING IBAN CHANGE */}
            {hasPendingIbanChange && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm animate-pulse-slow">
                    <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <AlertTriangle size={16}/> Wniosek o Zmianę Konta
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white p-3 rounded border border-slate-200 opacity-60">
                            <p className="label-text">Obecny IBAN</p>
                            <p className="font-mono text-sm text-slate-600 truncate">{formatDisplayIban(user.finance?.payoutAccount?.iban || '')}</p>
                        </div>
                        <div className="bg-white p-3 rounded border border-emerald-300 ring-2 ring-emerald-100">
                            <p className="label-text text-emerald-600">Nowy IBAN (Wniosek)</p>
                            <p className="font-mono text-sm text-emerald-800 font-bold truncate">
                                {formatDisplayIban(pendingChange?.newIban || '')}
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-100/50 p-3 rounded border border-amber-100 mb-4">
                        <p className="label-text text-amber-600 mb-1">Powód zmiany (Uzasadnienie)</p>
                        <p className="text-sm text-slate-800 italic">"{pendingChange?.reason}"</p>
                    </div>

                    {showRejectInput ? (
                        <div className="bg-white p-3 rounded border border-red-200 animate-in fade-in">
                            <label className="label-text text-red-600">Powód odrzucenia (Widoczny dla pracownika)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={rejectReason} 
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Np. Błędny format..."
                                    className="input-field focus:ring-red-500"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => handleResolveChangeRequest(false)}
                                    className="bg-red-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-red-700"
                                >
                                    Potwierdź
                                </button>
                                <button 
                                    onClick={() => setShowRejectInput(false)}
                                    className="bg-slate-100 text-slate-600 px-3 py-2 rounded text-xs font-bold hover:bg-slate-200"
                                >
                                    Anuluj
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleResolveChangeRequest(true)}
                                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-sm"
                            >
                                <CheckCircle size={16}/> Zatwierdź Zmianę
                            </button>
                            <button 
                                onClick={() => handleResolveChangeRequest(false)}
                                className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-lg text-sm font-bold hover:bg-red-50 transition flex items-center justify-center gap-2"
                            >
                                <XCircle size={16}/> Odrzuć
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 1. COMPANY CONTEXT */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                <h3 className="label-text text-slate-400 mb-4 flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-600"/> Kontekst Zatrudnienia
                </h3>
                
                {company ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-500 mb-0.5">Firma / Pracodawca</p>
                            <p className="font-bold text-slate-800 text-sm">{company.name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">NIP: {company.nip}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-0.5">Stanowisko</p>
                            <p className="font-medium text-slate-700 text-sm">{user.organization?.position || user.position || '-'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{user.organization?.department || user.department}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded">
                        <AlertTriangle size={16} />
                        <span className="text-sm font-medium">Brak przypisanej firmy (Konto Sierocze)</span>
                    </div>
                )}
            </div>

            {/* 2. FINANCE & RISK */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bank Details - NOW EDITABLE */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="label-text text-slate-400 mb-4 flex items-center gap-2">
                            <CreditCard size={16} className="text-emerald-600"/> Dane do Przelewu
                        </h3>
                        {!isEditingIban && !hasPendingIbanChange && (
                            <button 
                                onClick={() => setIsEditingIban(true)}
                                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                            >
                                <Edit2 size={12}/> {hasIban ? 'Edytuj' : 'Uzupełnij'}
                            </button>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-slate-500">Numer IBAN</span>
                                {user.finance?.payoutAccount?.isVerified && !isEditingIban ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        <ShieldCheck size={10} /> Zweryfikowany
                                    </span>
                                ) : !isEditingIban && (
                                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                                        Brak / Niezweryfikowany
                                    </span>
                                )}
                            </div>

                            {isEditingIban ? (
                                <div className="animate-in fade-in">
                                    <input 
                                        type="text"
                                        value={newIban}
                                        onChange={(e) => { setNewIban(e.target.value); setIbanError(null); }}
                                        placeholder="PL 00 0000..."
                                        className={`input-field font-mono ${ibanError ? 'border-red-300 focus:ring-red-500' : 'focus:ring-emerald-500'}`}
                                    />
                                    {ibanError && <p className="text-xs text-red-500 mt-1">{ibanError}</p>}
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={handleSaveIban} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-emerald-700 flex items-center gap-1">
                                            <Save size={12}/> Zapisz
                                        </button>
                                        <button onClick={() => setIsEditingIban(false)} className="bg-slate-100 text-slate-600 px-3 py-1 rounded text-xs font-bold hover:bg-slate-200">
                                            Anuluj
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className={`font-mono font-bold text-sm tracking-wide break-all ${hasIban ? 'text-slate-800' : 'text-red-400 italic'}`}>
                                    {formatDisplayIban(user.finance?.payoutAccount?.iban || '')}
                                </p>
                            )}

                            {hasPendingIbanChange && (
                                <p className="text-[10px] text-amber-600 mt-2 font-bold bg-amber-50 p-1.5 rounded">
                                    <Clock size={10} className="inline mr-1"/> Wniosek o zmianę w toku
                                </p>
                            )}
                        </div>
                        
                        <div className="pt-2 border-t border-slate-100">
                            <p className="text-xs text-slate-500 mb-1">PESEL (Weryfikacja tożsamości)</p>
                            <p className="font-mono text-slate-700">{user.pesel || user.identity?.pesel || 'Brak'}</p>
                        </div>
                    </div>
                </div>

                {/* History Stats */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="label-text text-slate-400 mb-4 flex items-center gap-2">
                        <History size={16} className="text-blue-600"/> Historia Odkupów
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg text-center">
                            <span className="block text-2xl font-bold text-slate-800">{userBuybackHistory.length}</span>
                            <span className="text-[10px] text-slate-500 uppercase">Wniosków</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg text-center">
                            <span className="block text-2xl font-bold text-emerald-600">{totalBuybackValue.toFixed(0)}</span>
                            <span className="text-[10px] text-slate-500 uppercase">Wypłacono PLN</span>
                        </div>
                    </div>
                    
                    <div className="mt-4 text-xs text-center text-slate-400">
                        Ostatni wniosek: {userBuybackHistory.length > 0 
                            ? new Date(userBuybackHistory[0].dateGenerated).toLocaleDateString() 
                            : 'Brak'}
                    </div>
                </div>
            </div>

            {/* 3. CURRENT ACTION (Buyback Approval) */}
            {currentAgreement && currentAgreement.status === 'PENDING_APPROVAL' && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-2">
                    <div>
                        <h4 className="font-bold text-indigo-900">Wniosek nr {currentAgreement.id}</h4>
                        <p className="text-indigo-700 text-sm">Kwota do zwrotu: <strong>{currentAgreement.totalValue.toFixed(2)} PLN</strong></p>
                        {!hasIban && (
                            <p className="text-red-600 text-xs font-bold mt-1 flex items-center gap-1">
                                <Ban size={12}/> Brak IBAN. Uzupełnij dane powyżej, aby odblokować.
                            </p>
                        )}
                    </div>
                    <button 
                        disabled={!hasIban}
                        onClick={() => { onApproveCurrent && onApproveCurrent(currentAgreement.id); onClose(); }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 transition w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {hasIban ? 'Zatwierdź ten zwrot' : 'Zablokowane (Brak danych)'}
                        {hasIban && <ArrowRight size={16}/>}
                    </button>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
