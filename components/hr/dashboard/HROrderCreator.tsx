
import React, { useState } from 'react';
import { FileText, Info, Upload, ArrowRight, X, CheckCircle2, Calculator, ArrowLeft, Eye, Printer, ShieldCheck, FileSpreadsheet, AlertCircle, ChevronRight, Download, Maximize2, ZoomIn, ZoomOut, Clock } from 'lucide-react';
import { PayrollEntry, Company } from '../../../types';
import { calculateOrderTotals } from '../../../utils/financialMath';
import { formatCurrency } from '../../../utils/formatters';

interface HROrderCreatorProps {
  orderAmount: number;
  onOrderAmountChange: (val: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPayrollCalculating: boolean;
  onSimulatePayroll: () => void;
  successFeePercentage: number;
  onExportTemplate: () => void;
  distributionPlan?: PayrollEntry[];
  onClearDistributionPlan?: () => void;
  company: Company;
}

type CreatorStep = 'INPUT' | 'PREVIEW';
type PreviewDoc = 'NOTE' | 'INVOICE';

export const HROrderCreator: React.FC<HROrderCreatorProps> = ({
  orderAmount,
  onOrderAmountChange,
  onSubmit,
  isPayrollCalculating,
  onSimulatePayroll,
  successFeePercentage,
  distributionPlan,
  onClearDistributionPlan,
  company
}) => {
  const [step, setStep] = useState<CreatorStep>('INPUT');
  const [activeDoc, setActiveDoc] = useState<PreviewDoc>('NOTE');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Centralized Calculation
  const totals = calculateOrderTotals(orderAmount, successFeePercentage);
  const hasActivePlan = distributionPlan && distributionPlan.length > 0;

  // Handlers
  const goToPreview = () => {
      if (orderAmount > 0) {
          setStep('PREVIEW');
          setZoomLevel(1);
      }
  };

  const goToInput = () => {
      setStep('INPUT');
      setIsConfirmed(false);
  };

  // --- STEP 1: INPUT FORM (Simplified & Clean) ---
  const renderInputStep = () => (
      <div className="flex flex-col lg:flex-row h-full min-h-[500px]">
          
          {/* LEFT: INPUT AREA */}
          <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-200">
              
              <div className={`transition-all duration-300 ${hasActivePlan ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">
                      Opcja 1: Kwota Ryczałtowa
                  </label>
                  
                  <div className="relative group mb-6">
                      <input 
                          type="number" 
                          min="0" 
                          step="10"
                          placeholder="0"
                          value={orderAmount || ''}
                          onChange={(e) => onOrderAmountChange(parseInt(e.target.value) || 0)}
                          className="w-full text-6xl font-bold text-slate-900 border-b-2 border-slate-200 py-4 focus:outline-none focus:border-indigo-600 bg-transparent font-mono transition-colors placeholder:text-slate-200"
                      />
                      <span className="absolute right-0 bottom-8 text-xl font-bold text-slate-400">PLN</span>
                  </div>
                  
                  <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                      Wpisz łączną wartość netto voucherów, które chcesz rozdystrybuować.
                  </p>
              </div>

              <div className="flex items-center gap-4 my-10">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full">LUB</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              {hasActivePlan ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex justify-between items-center animate-in zoom-in-95 shadow-sm">
                      <div className="flex items-center gap-4">
                          <div className="bg-white p-3 rounded-full shadow-sm text-emerald-600">
                              <FileSpreadsheet size={24} />
                          </div>
                          <div>
                              <p className="text-sm font-bold text-emerald-900">Zaimportowano Listę Płac</p>
                              <p className="text-xs text-emerald-700 mt-1">
                                  {distributionPlan.length} pracowników | Suma: <strong>{formatCurrency(orderAmount)}</strong>
                              </p>
                          </div>
                      </div>
                      {onClearDistributionPlan && (
                          <button 
                              onClick={onClearDistributionPlan}
                              className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition"
                              title="Usuń plik i wpisz ręcznie"
                          >
                              <X size={20} />
                          </button>
                      )}
                  </div>
              ) : (
                  <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">
                          Opcja 2: Import z Excela (Zalecane)
                      </label>
                      <button 
                          onClick={onSimulatePayroll}
                          disabled={isPayrollCalculating}
                          className="w-full group bg-slate-50 hover:bg-indigo-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-6 text-left transition-all flex items-center gap-5"
                      >
                          <div className="bg-white p-3 rounded-xl shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                              {isPayrollCalculating ? <Calculator className="animate-spin" size={24}/> : <Upload size={24}/>}
                          </div>
                          <div>
                              <span className="block font-bold text-slate-700 group-hover:text-indigo-800 text-sm mb-1">
                                  Wgraj plik (Kalkulator Płacowy)
                              </span>
                              <span className="text-xs text-slate-500 block">
                                  Automatyczne wyliczenie kwot Netto i Brutto dla pracowników.
                              </span>
                          </div>
                      </button>
                  </div>
              )}
          </div>

          {/* RIGHT: SUMMARY & ACTION */}
          <div className="w-full lg:w-1/2 bg-slate-50 p-8 lg:p-12 flex flex-col justify-between">
              
              <div className="space-y-6">
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Calculator size={20} className="text-indigo-600"/> Symulacja Kosztów
                  </h3>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                      {/* Row 1 */}
                      <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                          <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                              <div>
                                  <span className="text-sm font-medium text-slate-700 block">Vouchery (Nota)</span>
                                  <span className="text-[10px] text-slate-400">Wartość dla pracowników</span>
                              </div>
                          </div>
                          <span className="font-mono font-bold text-slate-800 text-lg">{formatCurrency(totals.voucherValue)}</span>
                      </div>

                      {/* Row 2 */}
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                              <div>
                                  <span className="text-sm font-medium text-slate-700 block">Prowizja (Faktura)</span>
                                  <span className="text-[10px] text-slate-400">Obsługa {(successFeePercentage*100).toFixed(0)}% + VAT</span>
                              </div>
                          </div>
                          <div className="text-right">
                              <span className="font-mono text-slate-600 block">{formatCurrency(totals.feeGross)}</span>
                              <span className="text-[9px] text-slate-400 font-mono">(Netto: {formatCurrency(totals.feeNet)})</span>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="mt-8">
                  <div className="flex justify-between items-end mb-6 px-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Razem do zapłaty</span>
                      <span className="text-4xl font-bold text-slate-900 tracking-tight">{formatCurrency(totals.totalPayable)}</span>
                  </div>

                  <button 
                      onClick={goToPreview}
                      disabled={orderAmount <= 0}
                      className="w-full bg-slate-900 text-white py-5 rounded-xl font-bold shadow-xl hover:bg-slate-800 hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group disabled:transform-none disabled:shadow-none text-base"
                  >
                      Dalej: Podgląd Dokumentów <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-center text-xs text-slate-400 mt-4">Krok 1 z 2: Wprowadzenie danych</p>
              </div>
          </div>
      </div>
  );

  // --- MOCK PAPER COMPONENT (A4 Visual) ---
  const PaperDocument = ({ type }: { type: 'NOTE' | 'INVOICE' }) => {
      const isNote = type === 'NOTE';
      const docTitle = isNote ? 'NOTA KSIĘGOWA' : 'FAKTURA VAT';
      const docColor = isNote ? 'text-emerald-800' : 'text-indigo-800';
      const borderColor = isNote ? 'border-emerald-900' : 'border-indigo-900';
      
      return (
          <div 
            className="bg-white aspect-[210/297] w-full shadow-2xl border border-slate-200 p-8 md:p-10 flex flex-col text-xs text-slate-800 font-serif relative overflow-hidden transition-all duration-300 origin-top"
            style={{ transform: `scale(${zoomLevel})` }}
          >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-100 text-6xl md:text-8xl font-bold -rotate-45 pointer-events-none select-none z-0 whitespace-nowrap border-4 border-slate-100 p-4 opacity-60">
                  PODGLĄD / DRAFT
              </div>

              <div className={`relative z-10 flex justify-between items-start border-b-2 ${borderColor} pb-6 mb-8`}>
                  <div>
                      <h2 className={`text-2xl font-bold uppercase tracking-widest ${docColor}`}>{docTitle}</h2>
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-1 font-sans font-bold">
                          {isNote ? 'Oryginał / Kopia' : 'Oryginał'}
                      </p>
                  </div>
                  <div className="text-right font-sans">
                      <p className="font-bold text-sm text-slate-900">Stratton Prime S.A.</p>
                      <p className="text-slate-500 text-[10px]">Data wystawienia: {new Date().toLocaleDateString()}</p>
                  </div>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-10 mb-10 font-sans">
                  <div className="space-y-1">
                      <p className="font-bold uppercase text-[9px] text-slate-400 mb-2 border-b border-slate-200 pb-1">Sprzedawca</p>
                      <p className="font-bold text-sm text-slate-800">Stratton Prime S.A.</p>
                      <p className="text-slate-600 text-[11px]">ul. Finansowa 12</p>
                      <p className="text-slate-600 text-[11px]">00-001 Warszawa</p>
                      <p className="text-slate-600 text-[11px]">NIP: 521-333-44-55</p>
                  </div>
                  <div className="space-y-1">
                      <p className="font-bold uppercase text-[9px] text-slate-400 mb-2 border-b border-slate-200 pb-1">Nabywca</p>
                      <p className="font-bold text-sm text-slate-800">{company.name}</p>
                      <p className="text-slate-600 text-[11px]">{company.address?.street || 'Adres Firmy'}</p>
                      <p className="text-slate-600 text-[11px]">{company.address?.zipCode} {company.address?.city}</p>
                      <p className="text-slate-600 text-[11px]">NIP: {company.nip}</p>
                  </div>
              </div>

              <div className="relative z-10 flex-1">
                  <table className="w-full text-left border-collapse font-sans">
                      <thead className="bg-slate-100 text-slate-600 border-t border-b border-slate-300">
                          <tr>
                              <th className="p-2 w-10 text-center font-bold text-[10px]">Lp</th>
                              <th className="p-2 font-bold text-[10px]">Nazwa towaru / usługi</th>
                              <th className="p-2 text-right font-bold text-[10px]">Ilość</th>
                              <th className="p-2 text-right font-bold text-[10px]">Netto</th>
                              {!isNote && <th className="p-2 text-right font-bold text-[10px]">VAT</th>}
                              <th className="p-2 text-right font-bold text-[10px]">Brutto</th>
                          </tr>
                      </thead>
                      <tbody className="text-slate-700 text-[11px]">
                          <tr>
                              <td className="p-3 border-b border-slate-200 text-center">1</td>
                              <td className="p-3 border-b border-slate-200">
                                  <strong className="block text-slate-900 mb-0.5">
                                      {isNote ? 'Znaki Legitymacyjne (Voucher Prime)' : 'Obsługa Techniczna (Service Fee)'}
                                  </strong>
                                  <span className="text-[9px] text-slate-500 block">Kod PKWiU: {isNote ? '00.00.00' : '62.01.1'}</span>
                              </td>
                              <td className="p-3 border-b border-slate-200 text-right">
                                  {isNote ? orderAmount : 1}
                              </td>
                              <td className="p-3 border-b border-slate-200 text-right font-mono">
                                  {isNote ? formatCurrency(totals.voucherValue) : formatCurrency(totals.feeNet)}
                              </td>
                              {!isNote && (
                                  <td className="p-3 border-b border-slate-200 text-right font-mono text-slate-500">23%</td>
                              )}
                              <td className="p-3 border-b border-slate-200 text-right font-bold font-mono text-slate-900">
                                  {isNote ? formatCurrency(totals.voucherValue) : formatCurrency(totals.feeGross)}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>

              <div className="relative z-10 mt-auto pt-6 border-t-2 border-slate-800 flex justify-end">
                  <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Razem do zapłaty</p>
                      <div className="flex items-baseline justify-end gap-2">
                          <span className="text-3xl font-bold text-slate-900 font-sans tracking-tight">
                              {isNote ? formatCurrency(totals.voucherValue) : formatCurrency(totals.feeGross)}
                          </span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1 flex items-center justify-end gap-1">
                          <Clock size={10}/> Termin płatności: 7 dni
                      </p>
                  </div>
              </div>
          </div>
      );
  };

  // --- STEP 2: PREVIEW ---
  const renderPreviewStep = () => (
      <div className="flex flex-col lg:flex-row h-full min-h-[600px] animate-in fade-in slide-in-from-right-4 duration-300">
          
          {/* LEFT: DOCUMENT PREVIEW */}
          <div className="w-full lg:w-[60%] bg-slate-200/50 p-6 md:p-10 flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/graphy.png')]"></div>
              
              {/* Document Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 w-fit mb-6 shadow-sm relative z-10">
                  <button 
                      onClick={() => setActiveDoc('NOTE')}
                      className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                          activeDoc === 'NOTE' 
                          ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' 
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                      }`}
                  >
                      <FileSpreadsheet size={16}/> Nota
                  </button>
                  <button 
                      onClick={() => setActiveDoc('INVOICE')}
                      className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                          activeDoc === 'INVOICE' 
                          ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                      }`}
                  >
                      <FileText size={16}/> Faktura
                  </button>
              </div>

              {/* The Paper */}
              <div className="w-full max-w-[480px] shadow-2xl relative z-10 transition-transform duration-300 group-hover:scale-[1.01] origin-center">
                  <PaperDocument type={activeDoc} />
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="p-1 hover:bg-slate-200 rounded"><ZoomOut size={16}/></button>
                  <span className="text-xs font-mono py-0.5 select-none">{(zoomLevel*100).toFixed(0)}%</span>
                  <button onClick={() => setZoomLevel(z => Math.min(1.5, z + 0.1))} className="p-1 hover:bg-slate-200 rounded"><ZoomIn size={16}/></button>
              </div>
          </div>

          {/* RIGHT: CONFIRMATION */}
          <div className="w-full lg:w-[40%] bg-white p-8 lg:p-10 flex flex-col border-l border-slate-200">
              
              <div className="mb-auto">
                  <button 
                    onClick={goToInput}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium mb-8 transition-colors"
                  >
                      <ArrowLeft size={16}/> Wróć do edycji
                  </button>

                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <CheckCircle2 size={24} className="text-emerald-600"/> Podsumowanie
                  </h3>

                  <div className="space-y-4">
                      {/* Receipt Item 1 */}
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-sm font-medium text-slate-600">Nota Księgowa</span>
                          <span className="font-bold text-slate-800">{formatCurrency(totals.voucherValue)}</span>
                      </div>
                      {/* Receipt Item 2 */}
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-sm font-medium text-slate-600">Faktura VAT</span>
                          <span className="font-bold text-slate-800">{formatCurrency(totals.feeGross)}</span>
                      </div>
                      
                      <div className="pt-4 mt-2 border-t border-slate-100">
                          <div className="flex justify-between items-end">
                              <span className="text-xs font-bold text-slate-400 uppercase">Razem</span>
                              <span className="text-3xl font-bold text-slate-900 tracking-tight">{formatCurrency(totals.totalPayable)}</span>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="mt-8">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                      <div className="flex gap-3">
                          <ShieldCheck size={20} className="text-indigo-600 shrink-0 mt-0.5"/>
                          <p className="text-xs text-indigo-800 leading-relaxed">
                              Potwierdzając zamówienie, akceptujesz wygenerowane dokumenty. 
                              Zobowiązujesz się do opłacenia faktury w terminie 7 dni.
                          </p>
                      </div>
                  </div>

                  <label className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none mb-6 ${isConfirmed ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isConfirmed ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                          {isConfirmed && <CheckCircle2 size={14} strokeWidth={4} />}
                      </div>
                      <input 
                          type="checkbox" 
                          checked={isConfirmed}
                          onChange={e => setIsConfirmed(e.target.checked)}
                          className="hidden"
                      />
                      <span className={`text-sm font-bold ${isConfirmed ? 'text-indigo-900' : 'text-slate-600'}`}>
                          Akceptuję warunki i zamawiam z obowiązkiem zapłaty
                      </span>
                  </label>

                  <button 
                      onClick={onSubmit}
                      disabled={!isConfirmed}
                      className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-base"
                  >
                      {isConfirmed ? <Printer size={20}/> : <AlertCircle size={20}/>}
                      {isConfirmed ? 'Zatwierdź Zamówienie' : 'Zaznacz zgodę powyżej'}
                  </button>
                  
                  <p className="text-center text-xs text-slate-400 mt-4">Krok 2 z 2: Finalizacja</p>
              </div>
          </div>
      </div>
  );

  return (
    <div className="h-full bg-white flex flex-col">
        {step === 'INPUT' && renderInputStep()}
        {step === 'PREVIEW' && renderPreviewStep()}
    </div>
  );
};
