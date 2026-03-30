
import React, { useState, useRef, useEffect } from 'react';
import { Calculator, ArrowRight, Upload, CheckCircle, AlertTriangle, Download, UserCheck, X, Lock, ArrowLeft } from 'lucide-react';
import { PayrollEntry, User } from '../../types';
import { validateManualSplit, recalculateUzSplit, PAYROLL_CONFIG_2026, generatePayrollTemplate } from '../../services/payrollService';
import { useStrattonSystem } from '../../context/StrattonContext';

interface PayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToOrder: (amount: number, plan: PayrollEntry[]) => void;
  onParseAndMatch: (file: File) => Promise<PayrollEntry[]>;
  employees: User[]; // Added employees prop
}

export const PayrollModal: React.FC<PayrollModalProps> = ({ 
  isOpen, onClose, onApplyToOrder, onParseAndMatch, employees 
}) => {
  const { actions } = useStrattonSystem();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats — treat MISSING (valid amounts, user not yet in system) same as MATCHED
  const isEntryValid = (e: PayrollEntry) => (e.status === 'MATCHED' || e.status === 'MISSING') && !e.validationError;
  const matchedCount = payrollData.filter(isEntryValid).length;
  const invalidCount = payrollData.filter(e => e.status === 'INVALID_AMOUNT').length;
  const totalVouchers = payrollData.filter(isEntryValid).reduce((acc, curr) => acc + Math.floor(curr.voucherPartNet), 0);

  useEffect(() => {
    if (isOpen) {
        setStep(1);
        setPayrollData([]);
        setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    // Pass existing employees to pre-fill the template
    const success = generatePayrollTemplate(employees);
    if (!success) {
        actions.addToast("Błąd Biblioteki", "Biblioteka Excel (SheetJS) nie jest dostępna.", "ERROR");
    } else {
        actions.addToast("Pobrano Szablon", `Szablon zawiera ${employees.length} pracowników z kartoteki.`, "SUCCESS");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
        const data = await onParseAndMatch(file);
        setPayrollData(data);
        setStep(2);
    } catch (error) {
        console.error("Error parsing payroll:", error);
        actions.addToast("Błąd Pliku", "Nie udało się przetworzyć pliku Excel.", "ERROR");
    } finally {
        setIsProcessing(false);
        e.target.value = "";
    }
  };

  // UOP: Money Slider/Input
  const handleCashChange = (entryIndex: number, newCashAmount: number) => {
      setPayrollData(prev => {
          const newData = [...prev];
          const entry = newData[entryIndex];
          
          const validation = validateManualSplit(entry.declaredNetAmount, entry.statutoryMinNet, newCashAmount);
          
          if (validation.isValid) {
              entry.cashPartNet = newCashAmount;
              entry.voucherPartNet = validation.voucherPart!;
              entry.validationError = undefined;
              if (entry.status === 'INVALID_AMOUNT') entry.status = 'MATCHED';
          } else {
              entry.cashPartNet = newCashAmount;
              entry.voucherPartNet = entry.declaredNetAmount - newCashAmount;
              entry.validationError = validation.error;
          }
          return newData;
      });
  };

  // UZ: Hours Input (Hourly Split)
  const handleHoursChange = (entryIndex: number, newCashHours: number) => {
      setPayrollData(prev => {
          const newData = [...prev];
          const entry = newData[entryIndex];
          
          const validation = recalculateUzSplit(
              entry.declaredNetAmount, 
              entry.totalHours, 
              newCashHours, 
              entry.hasSicknessInsurance
          );

          entry.cashHours = newCashHours; 

          if (validation.isValid) {
              entry.cashPartNet = validation.cashPart!;
              entry.voucherPartNet = validation.voucherPart!;
              entry.validationError = undefined;
              if (entry.status === 'INVALID_AMOUNT') entry.status = 'MATCHED';
          } else {
              entry.validationError = validation.error;
          }
          return newData;
      });
  };

  const handleApply = () => {
    const validEntries = payrollData.filter(isEntryValid);
    const finalVoucherSum = validEntries.reduce((acc, curr) => acc + Math.floor(curr.voucherPartNet), 0);
    onApplyToOrder(finalVoucherSum, validEntries);
    onClose();
  };

  const hasAnyErrors = payrollData.some(e => e.validationError || e.status === 'INVALID_AMOUNT');

  // --- STEPS RENDERERS ---

  const renderStep1 = () => (
    <div className="flex flex-col items-center justify-center p-6 h-full text-center overflow-y-auto">
        <div className="bg-indigo-50 p-5 rounded-full mb-6 animate-pulse">
            <Calculator size={48} className="text-indigo-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Kalkulator Netto 2026</h3>
        <p className="text-slate-500 text-center text-sm max-w-lg mb-8 leading-relaxed">
            System operuje wyłącznie na kwotach <strong>NETTO (Do wypłaty)</strong>.<br/>
            Wgraj plik Excel, aby automatycznie wyliczyć optymalny podział.
        </p>

        <div className="flex flex-col w-full max-w-sm gap-3">
             <button 
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 transition text-sm font-medium shadow-sm"
             >
                <Download size={18}/> Pobierz Szablon (Z bazą pracowników)
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition text-sm font-bold shadow-lg shadow-indigo-900/20"
            >
                {isProcessing ? <span className="animate-spin">⌛</span> : <Upload size={20}/>}
                {isProcessing ? 'Analizowanie...' : 'Wgraj Uzupełniony Plik'}
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
            />
        </div>

        <button 
            onClick={onClose}
            className="mt-8 text-sm text-slate-400 underline p-4"
        >
            Anuluj
        </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
         {/* STATUS HEADER */}
         <div className="bg-white border-b border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center shrink-0 z-10">
             <div className="flex gap-4 w-full md:w-auto overflow-x-auto no-scrollbar">
                 <div className="flex flex-col">
                     <span className="label-text text-emerald-600">Poprawne</span>
                     <span className="text-xl font-bold text-emerald-700">{matchedCount}</span>
                 </div>
                 {invalidCount > 0 && (
                     <div className="flex flex-col border-l border-slate-100 pl-4">
                         <span className="label-text text-red-600">Błędy</span>
                         <span className="text-xl font-bold text-red-700">{invalidCount}</span>
                     </div>
                 )}
                 <div className="flex flex-col border-l border-slate-100 pl-4 flex-1 text-right md:text-left">
                     <span className="label-text">Suma Voucherów</span>
                     <span className="text-xl font-bold text-indigo-600">{totalVouchers} PLN</span>
                 </div>
             </div>
         </div>

         {/* CONTENT */}
         <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-hidden border border-slate-200 rounded-lg bg-white shadow-sm min-h-full">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-3 py-2 border-b w-[20%]">Pracownik</th>
                            <th className="px-3 py-2 border-b w-[10%]">Umowa</th>
                            <th className="px-3 py-2 border-b text-right w-[15%]">Netto Budżet</th>
                            <th className="px-3 py-2 border-b text-right w-[10%] text-slate-400">Min. (ZUS)</th>
                            <th className="px-3 py-2 border-b w-[25%] text-center bg-indigo-50/50">Edycja (Godziny / Kwota)</th>
                            <th className="px-3 py-2 border-b text-right w-[10%] text-emerald-600 font-bold">Voucher</th>
                            <th className="px-3 py-2 border-b text-center w-[10%]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {payrollData.map((entry, idx) => {
                            const isError = !!entry.validationError || entry.status === 'INVALID_AMOUNT';
                            const isEditable = entry.status === 'MATCHED' || entry.status === 'MISSING' || entry.status === 'INVALID_AMOUNT';
                            const isUZ = entry.contractType === 'UZ';

                            return (
                                <tr key={idx} className={isError ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}>
                                    <td className="px-3 py-2 font-medium text-slate-700">
                                        {entry.employeeName}
                                        <div className="text-[10px] text-slate-400 font-normal">{entry.email}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${isUZ ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {entry.contractType}
                                        </span>
                                        {isUZ && <span className="text-[9px] text-slate-400 block mt-0.5">{entry.totalHours}h</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700 font-semibold">{entry.declaredNetAmount}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-400 border-r border-slate-100">
                                        <div className="flex items-center justify-end gap-1">
                                            <Lock size={10} className="opacity-50"/> 
                                            {isUZ ? `${PAYROLL_CONFIG_2026.zlecenie.min_stawka_netto_h.chorobowe}/h` : entry.statutoryMinNet}
                                        </div>
                                    </td>
                                    
                                    <td className="px-3 py-2 bg-indigo-50/20 text-center align-middle">
                                        {isEditable ? (
                                            isUZ ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="relative group w-20">
                                                        <input 
                                                            type="number" 
                                                            value={entry.cashHours ?? entry.totalHours}
                                                            min={0}
                                                            max={entry.totalHours}
                                                            onChange={(e) => handleHoursChange(idx, parseInt(e.target.value) || 0)}
                                                            className={`input-field text-center font-mono focus:ring-blue-500 !py-1 !px-1 ${
                                                                isError ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500' : 'border-blue-200'
                                                            }`}
                                                        />
                                                        <span className="text-[9px] text-slate-400 absolute -bottom-3 left-0 right-0">godz. płatne</span>
                                                    </div>
                                                    <span className="text-slate-300">|</span>
                                                    <div className="text-[10px] text-slate-500 flex flex-col items-start leading-tight">
                                                        <span>Gotówka: {entry.cashPartNet.toFixed(0)}</span>
                                                        <span className="text-emerald-600 font-bold">Voucher: {(entry.totalHours - (entry.cashHours ?? entry.totalHours))}h</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative group">
                                                    <input 
                                                        type="number" 
                                                        value={entry.cashPartNet}
                                                        min={entry.statutoryMinNet}
                                                        max={entry.declaredNetAmount}
                                                        onChange={(e) => handleCashChange(idx, parseInt(e.target.value) || 0)}
                                                        className={`input-field text-right font-mono focus:ring-indigo-500 !py-1 !px-2 ${
                                                            isError ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500' : 'border-indigo-200'
                                                        }`}
                                                    />
                                                    <span className="text-[9px] text-slate-400 absolute right-8 top-1.5 pointer-events-none">PLN</span>
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>

                                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                                        {Math.floor(entry.voucherPartNet)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {entry.validationError ? (
                                            <div className="group relative flex justify-center">
                                                <AlertTriangle size={16} className="text-red-500 cursor-help"/>
                                                <div className="absolute bottom-full mb-2 right-0 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg hidden group-hover:block z-50">
                                                    {entry.validationError}
                                                </div>
                                            </div>
                                        ) : entry.status === 'MATCHED' ? (
                                            <CheckCircle size={16} className="text-emerald-500 mx-auto"/>
                                        ) : (
                                            <span className="text-[10px] text-slate-400">{entry.status}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
         </div>
         
         {/* FOOTER ACTIONS */}
         <div className="p-4 border-t border-slate-200 bg-white shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe-bottom flex gap-3">
            <button 
                onClick={() => setStep(1)}
                className="flex-1 md:flex-none md:w-auto px-6 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-2"
            >
                <ArrowLeft size={16}/> Wróć
            </button>
            <button 
                onClick={() => setStep(3)}
                disabled={matchedCount === 0 || hasAnyErrors}
                className="flex-1 md:flex-none md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Podsumowanie <ArrowRight size={20}/>
            </button>
         </div>
    </div>
  );

  const renderStep3 = () => (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 overflow-y-auto">
           <div className={`p-6 rounded-full mb-6 ${totalVouchers > 0 ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                <UserCheck size={64} className={totalVouchers > 0 ? 'text-emerald-600' : 'text-slate-400'} />
           </div>
           <h3 className="text-2xl font-bold text-slate-800 mb-2">
               {totalVouchers > 0 ? 'Gotowe do Zamówienia' : 'Wynik Netto Pusty'}
           </h3>
           <p className="text-slate-500 text-center text-sm max-w-md mb-8">
               {totalVouchers > 0 
                 ? <span>Plan dystrybucji zatwierdzony. Łączna wartość benefitów netto: <strong>{totalVouchers} PLN</strong>.</span>
                 : <span>Brak nadwyżki nad minimum ustawowe dla zaimportowanych pracowników.</span>
               }
           </p>

           <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                   <span className="label-text">Wartość Voucherów</span>
                   <span className="text-2xl font-bold text-slate-800">{totalVouchers} PLN</span>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                   <span className="label-text">Beneficjenci</span>
                   <span className="text-2xl font-bold text-slate-800">{matchedCount} os.</span>
               </div>
           </div>

           <div className="flex flex-col w-full max-w-sm gap-3">
               <button 
                  onClick={handleApply}
                  className="w-full px-8 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold shadow-lg flex items-center justify-center gap-2"
               >
                   Utwórz Zamówienie <ArrowRight size={18}/>
               </button>
               <button 
                  onClick={() => setStep(2)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl transition text-sm font-medium"
               >
                   Wróć do edycji
               </button>
           </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-white w-full h-[100dvh] md:h-[700px] md:max-w-5xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shadow-md z-30 shrink-0">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Calculator size={20}/> Kalkulator Płacowy</h3>
                    <p className="text-indigo-200 text-xs mt-0.5 hidden md:block">Import Netto &rarr; Walidacja Minimum &rarr; Podział</p>
                </div>
                <div className="flex items-center gap-4">
                     <div className="hidden md:flex gap-1">
                        <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-white' : 'bg-indigo-400'}`}></div>
                        <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-white' : 'bg-indigo-400'}`}></div>
                        <div className={`w-2 h-2 rounded-full ${step >= 3 ? 'bg-white' : 'bg-indigo-400'}`}></div>
                     </div>
                     <button 
                        onClick={onClose} 
                        className="text-indigo-200 hover:text-white p-2 hover:bg-indigo-500 rounded-full transition"
                        title="Zamknij"
                     >
                        <X size={24}/>
                     </button>
                </div>
            </div>
            
            {/* Content Body */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </div>
        </div>
    </div>
  );
};
