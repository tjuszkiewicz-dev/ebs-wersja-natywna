
import React, { useState } from 'react';
import { X, Copy, Check, CreditCard, Building2, FileText, AlertTriangle, Info } from 'lucide-react';
import { Order, Company } from '../../../types';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  company: Company;
}

export const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({ isOpen, onClose, order, company }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const bankAccount = "PL 12 1020 3040 0000 9999 8888 7777";
  const recipientName = "Stratton Prime S.A.";
  const transferTitle = `Zasilenie EBS - Zamówienie ${order.id}`;
  const totalAmount = order.totalValue.toFixed(2);
  
  // Split Payment Calculation
  // Voucher Note is VAT exempt. Service Fee has 23% VAT.
  const vatAmount = (order.feeValue - (order.feeValue / 1.23)).toFixed(2);
  const netAmount = (order.totalValue - parseFloat(vatAmount)).toFixed(2);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const Row = ({ label, value, fieldId, highlight = false, subValue }: { label: string, value: string, fieldId: string, highlight?: boolean, subValue?: string }) => (
      <div className={`flex flex-col mb-3 p-3 rounded-lg border transition-colors ${highlight ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
          <span className="label-text">{label}</span>
          <div className="flex justify-between items-center gap-2">
              <div className="flex flex-col">
                  <span className={`font-mono text-sm md:text-base font-bold break-all ${highlight ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {value}
                  </span>
                  {subValue && <span className="text-[10px] text-slate-500">{subValue}</span>}
              </div>
              <button 
                onClick={() => handleCopy(value, fieldId)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition flex-shrink-0"
                title="Skopiuj"
              >
                  {copiedField === fieldId ? <Check size={18} className="text-emerald-500"/> : <Copy size={18}/>}
              </button>
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-center shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard size={20} className="text-indigo-600"/>
                        Dane do przelewu
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Zamówienie: {order.id}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 transition">
                    <X size={24}/>
                </button>
            </div>

            {/* Content */}
            <div className="p-6 bg-slate-50/30 overflow-y-auto custom-scrollbar">
                
                {/* Warning Box */}
                <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 mb-6">
                    <AlertTriangle size={24} className="shrink-0 text-amber-600"/>
                    <div>
                        <p className="font-bold mb-1">Wymagany Mechanizm Podzielonej Płatności (MPP)</p>
                        <p>
                            Faktura zawiera VAT. Prosimy o realizację przelewu z wykorzystaniem komunikatu Split Payment.
                        </p>
                    </div>
                </div>

                <div className="mb-2">
                    <Row label="Odbiorca" value={recipientName} fieldId="recipient" />
                    <Row label="Numer Rachunku (IBAN)" value={bankAccount} fieldId="iban" highlight />
                    <Row label="Tytuł Przelewu" value={transferTitle} fieldId="title" />
                    <Row 
                        label="Łączna kwota do zapłaty (Brutto)" 
                        value={`${totalAmount} PLN`} 
                        fieldId="amount" 
                        highlight 
                        subValue={`W tym VAT: ${vatAmount} PLN | Netto: ${netAmount} PLN`}
                    />
                </div>

                {/* VAT Details for Accountant */}
                <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Szczegóły do księgowania (MPP)</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-2 rounded border border-slate-200 text-center">
                            <span className="text-[10px] text-slate-500 block">Kwota Brutto</span>
                            <span className="font-mono font-bold text-slate-800">{totalAmount}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200 text-center">
                            <span className="text-[10px] text-slate-500 block">Kwota VAT</span>
                            <span className="font-mono font-bold text-slate-800">{vatAmount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 text-center shrink-0">
                <button 
                    onClick={onClose}
                    className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg w-full md:w-auto"
                >
                    Zamknij okno
                </button>
            </div>
        </div>
    </div>
  );
};
