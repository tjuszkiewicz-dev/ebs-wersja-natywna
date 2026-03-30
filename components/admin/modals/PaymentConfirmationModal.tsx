
import React, { useState } from 'react';
import { CreditCard, Calendar, Hash, AlertCircle, ArrowRight } from 'lucide-react';
import { BuybackAgreement, User } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyback: BuybackAgreement;
  user?: User;
  onConfirm: (buybackId: string, transactionDetails: { date: string; reference?: string }) => void;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen, onClose, buyback, user, onConfirm
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = () => {
      setIsSubmitting(true);
      // Simulate API call
      setTimeout(() => {
          onConfirm(buyback.id, { date, reference });
          setIsSubmitting(false);
          onClose();
      }, 800);
  };

  // Determine displayed name/iban (Snapshot vs Live)
  const displayName = buyback.snapshot?.user.name || user?.name || 'Nieznany';
  const displayIban = buyback.snapshot?.user.iban || user?.finance?.payoutAccount?.iban || 'BRAK IBAN';

  return (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Księgowanie Wypłaty"
        icon={<CreditCard size={20} className="text-emerald-600"/>}
        maxWidth="max-w-md"
        footer={
            <>
                <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Anuluj</Button>
                <Button 
                    variant="primary" 
                    onClick={handleConfirm} 
                    isLoading={isSubmitting}
                    icon={!isSubmitting ? <ArrowRight size={16}/> : undefined}
                >
                    Potwierdzam Przelew
                </Button>
            </>
        }
    >
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <p className="label-text text-emerald-600">Kwota Przelewu</p>
                <p className="text-3xl font-bold text-emerald-700">{buyback.totalValue.toFixed(2)} PLN</p>
            </div>

            {/* Recipient Details */}
            <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Odbiorca:</span>
                    <span className="font-bold text-slate-700">{displayName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Rachunek (IBAN):</span>
                    <span className="font-mono text-slate-700 text-xs">{displayIban}</span>
                </div>
                <div className="flex justify-between pb-2">
                    <span className="text-slate-500">Tytuł przelewu:</span>
                    <span className="font-mono text-slate-500 text-xs">Odkup Voucherow {buyback.id}</span>
                </div>
            </div>

            {/* Inputs */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-200">
                <div>
                    <label className="label-text flex items-center gap-1">
                        <Calendar size={12}/> Data Operacji Bankowej
                    </label>
                    <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="input-field bg-white focus:ring-emerald-500"
                    />
                </div>
                <div>
                    <label className="label-text flex items-center gap-1">
                        <Hash size={12}/> ID Transakcji (Opcjonalne)
                    </label>
                    <input 
                        type="text" 
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="np. ELIXIR-12345678"
                        className="input-field font-mono focus:ring-emerald-500"
                    />
                </div>
            </div>

            {/* Warning */}
            <div className="flex gap-2 items-start text-xs text-amber-600 bg-amber-50 p-2 rounded">
                <AlertCircle size={14} className="shrink-0 mt-0.5"/>
                <p>Potwierdzenie jest nieodwracalne. Status zmieni się na <strong>OPŁACONE</strong>, a system wyśle powiadomienie do pracownika.</p>
            </div>
        </div>
    </Modal>
  );
};
