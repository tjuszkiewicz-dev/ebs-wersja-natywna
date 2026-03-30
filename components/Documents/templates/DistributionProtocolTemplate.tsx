
import React from 'react';
import { DistributionBatch, Company } from '../../../types';
import { PDF_LAYOUT } from '../PDF_LAYOUT';

interface Props {
  batch: DistributionBatch;
  company: Company;
}

export const DistributionProtocolTemplate: React.FC<Props> = ({ batch, company }) => {
  // Items might be injected with voucherRange by the parent component logic
  const safeItems = batch.items || [];

  return (
    <div 
        className={PDF_LAYOUT.printClass}
        style={{ 
            width: PDF_LAYOUT.cssWidth, 
            height: PDF_LAYOUT.cssHeight, 
            padding: PDF_LAYOUT.cssPadding,
            fontSize: '9pt', // Slightly smaller for dense data
            fontFamily: '"Libre Baskerville", serif', // Premium feel
            color: '#1a1a1a'
        }}
    >
        {/* WATERMARK */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-100 text-[100pt] font-bold -rotate-45 pointer-events-none z-0">
            ORYGINAŁ
        </div>

        {/* --- HEADER --- */}
        <div className="relative z-10 mb-8 border-b-2 border-slate-800 pb-6 flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-900 mb-1 font-serif">Protokół Dystrybucji</h1>
                <p className="text-xs uppercase tracking-wide text-slate-500 font-sans">Świadczenia Pozapłacowe / Znak Legitymacyjny</p>
            </div>
            <div className="text-right">
                <div className="bg-slate-900 text-white px-3 py-1 text-xs font-bold font-sans inline-block mb-2">
                    EBS-SECURE
                </div>
                <p className="text-[10pt] font-bold text-slate-900 font-sans">Stratton Prime S.A.</p>
            </div>
        </div>

        {/* --- METADATA GRID --- */}
        <div className="relative z-10 mb-8 grid grid-cols-2 gap-8 border-b border-slate-200 pb-8 font-sans">
            
            {/* Left: Company Context */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">Podmiot Przekazujący</h3>
                <div>
                    <p className="font-bold text-sm text-slate-800">{company.name}</p>
                    <p className="text-xs text-slate-600">NIP: {company.nip}</p>
                </div>
                <div className="pt-2">
                    <p className="text-xs text-slate-500 uppercase">Operator Systemu (HR):</p>
                    <p className="font-medium text-sm text-slate-800">{batch.hrName}</p>
                </div>
            </div>

            {/* Right: Document Details */}
            <div className="space-y-3 text-right">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">Szczegóły Operacji</h3>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500 text-xs">Numer Protokołu:</span>
                    <span className="font-mono font-bold text-sm">{batch.id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500 text-xs">Data Operacji:</span>
                    <span className="font-medium text-sm">{new Date(batch.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">Ilość Pozycji:</span>
                    <span className="font-bold text-sm">{safeItems.length}</span>
                </div>
            </div>
        </div>

        {/* --- TABLE CONTENT --- */}
        <div className="relative z-10 flex-1 font-sans">
            <table className="w-full text-xs text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-slate-800 text-slate-600">
                        <th className="py-2 px-2 w-10 text-center font-bold">Lp.</th>
                        <th className="py-2 px-2 font-bold uppercase tracking-wide">Beneficjent (Pracownik)</th>
                        <th className="py-2 px-2 text-center font-bold uppercase tracking-wide">ID Systemowe</th>
                        <th className="py-2 px-2 text-left font-bold uppercase tracking-wide">Zakres Voucherów</th>
                        <th className="py-2 px-2 text-right font-bold uppercase tracking-wide">Wartość</th>
                    </tr>
                </thead>
                <tbody className="text-slate-800">
                    {safeItems.map((item: any, idx) => (
                        <tr key={idx} className="border-b border-slate-100 even:bg-slate-50/50">
                            <td className="py-2.5 px-2 text-center text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-2">
                                <span className="font-bold block">{item.userName}</span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-500">{item.userId.split('-').slice(1).join('-')}</td>
                            <td className="py-2.5 px-2 font-mono text-[8pt] text-slate-600">
                                {item.voucherRange || 'Wygenerowano cyfrowo'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold font-mono">{item.amount.toFixed(2)} PLN</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* --- TOTALS --- */}
        <div className="relative z-10 mt-6 flex justify-end">
            <div className="w-1/3 bg-slate-50 p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500 uppercase font-bold">Suma Kontrolna</span>
                    <span className="text-xl font-bold font-serif text-slate-900">{batch.totalAmount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</span>
                </div>
                <div className="text-right text-[8pt] text-slate-400 italic">
                    Słownie: (zgodnie z algorytmem systemowym)
                </div>
            </div>
        </div>

        {/* --- FOOTER & SIGNATURES --- */}
        <div className="relative z-10 mt-auto pt-12">
            <div className="grid grid-cols-2 gap-20 font-sans text-xs">
                <div>
                    <div className="h-20 border-b border-slate-400 mb-2"></div>
                    <p className="font-bold uppercase text-slate-600">Sporządził (Operator HR)</p>
                    <p className="text-slate-400">{batch.hrName}</p>
                </div>
                <div>
                    <div className="h-20 border-b border-slate-400 mb-2"></div>
                    <p className="font-bold uppercase text-slate-600">Zatwierdził (Dział Finansowy)</p>
                    <p className="text-slate-400">Data i Podpis</p>
                </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-3 flex justify-between items-center text-[7pt] text-slate-400 font-sans">
                <div>
                    Dokument wygenerowany elektronicznie w systemie EBS.
                    <br/>Unikalny identyfikator wydruku: {batch.id}.{Date.now().toString(36)}
                </div>
                <div>
                    Strona 1 z 1
                </div>
            </div>
        </div>
    </div>
  );
};
