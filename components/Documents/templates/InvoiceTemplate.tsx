
import React from 'react';
import { Order, Company, OrderStatus } from '../../../types';
import { PDF_LAYOUT } from '../PDF_LAYOUT';
import { formatDate, getDueDate, formatCurrency } from '../documentUtils';

interface Props {
  type: 'DEBIT_NOTE' | 'VAT_INVOICE';
  order: Order;
  company: Company;
}

export const InvoiceTemplate: React.FC<Props> = ({ type, order, company }) => {
  const isDebitNote = type === 'DEBIT_NOTE'; // Faktura 1: Vouchery
  
  // Calculate specific due date based on company override
  // Note: Standard getDueDate uses 7 days default if not specified
  const effectivePaymentTerms = company.customPaymentTermsDays ?? 7; 
  const calculatedDueDate = getDueDate(order.date, effectivePaymentTerms);

  // Konfiguracja nagłówków i danych w zależności od typu dokumentu
  const docConfig = isDebitNote ? {
    title: 'NOTA KSIĘGOWA / FAKTURA',
    subtitle: 'Sprzedaż Znaków Legitymacyjnych (Vouchery)',
    id: order.docVoucherId,
    sellerLabel: 'WYDAWCA VOUCHERÓW',
    buyerLabel: 'ZAMAWIAJĄCY',
    description: 'Nota obciążeniowa za wydanie elektronicznych bonów podarunkowych (Voucherów Prime).',
    columns: ['Lp.', 'Nazwa towaru / usługi', 'Ilość (szt.)', 'Cena jedn.', 'Wartość (PLN)']
  } : {
    title: 'FAKTURA VAT',
    subtitle: 'Obsługa Systemowa (Service Fee)',
    id: order.docFeeId,
    sellerLabel: 'SPRZEDAWCA USŁUGI',
    buyerLabel: 'NABYWCA USŁUGI',
    description: 'Opłata za obsługę procesu dystrybucji i utrzymanie kont pracowniczych (zgodnie z Umową Ramową).',
    columns: ['Lp.', 'Nazwa usługi', 'Ilość', 'Cena Netto', 'Stawka VAT', 'Wartość Brutto']
  };

  // Kalkulacje
  const netValue = isDebitNote ? order.voucherValue : (order.feeValue / 1.23);
  const vatValue = isDebitNote ? 0 : (order.feeValue - netValue);
  const grossValue = isDebitNote ? order.voucherValue : order.feeValue;

  return (
    <div 
        className={PDF_LAYOUT.printClass}
        style={{ 
            width: PDF_LAYOUT.cssWidth, 
            height: PDF_LAYOUT.cssHeight, 
            padding: PDF_LAYOUT.cssPadding,
            fontSize: PDF_LAYOUT.baseFontSize,
            lineHeight: 1.4,
            position: 'relative'
        }}
    >
      {/* --- STATUS WATERMARKS --- */}
      {order.status === OrderStatus.REJECTED && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
              <div className="transform -rotate-45 border-8 border-red-500 text-red-500 text-6xl md:text-8xl font-bold opacity-20 p-4">
                  ANULOWANO
              </div>
          </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-900 pb-4 mb-6 relative z-10">
        <div>
          <h1 className="font-bold tracking-tight uppercase text-slate-900" style={{ fontSize: PDF_LAYOUT.headerFontSize }}>{docConfig.title}</h1>
          <p className="text-slate-500 uppercase tracking-widest mt-1 font-bold" style={{ fontSize: '9pt' }}>{docConfig.subtitle}</p>
          <div className="mt-3">
             <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200" style={{ fontSize: '12pt' }}>Nr: {docConfig.id}</span>
          </div>
        </div>
        <div className="text-right leading-tight">
          <h2 className="font-bold text-slate-900" style={{ fontSize: '11pt' }}>STRATTON PRIME S.A.</h2>
          <p className="text-slate-600" style={{ fontSize: '9pt' }}>ul. Finansowa 12, 00-001 Warszawa</p>
          <p className="text-slate-600" style={{ fontSize: '9pt' }}>NIP: 521-333-44-55</p>
          <p className="text-slate-600" style={{ fontSize: '9pt' }}>BDO: 000123456</p>
        </div>
      </div>

      {/* Dates & Payment Info */}
      <div className="flex justify-between items-center mb-6 bg-slate-50 p-3 border border-slate-200 rounded-sm relative z-10" style={{ fontSize: '9pt' }}>
          <div>
              <p className="uppercase text-slate-500 font-bold mb-0.5" style={{ fontSize: '7pt' }}>Metoda Płatności</p>
              <p className="font-bold">Przelew bankowy (Split Payment)</p>
          </div>
          <div className="text-center">
              <p className="uppercase text-slate-500 font-bold mb-0.5" style={{ fontSize: '7pt' }}>Data Wystawienia</p>
              <p className="font-bold">{formatDate(order.date)}</p>
          </div>
          <div className="text-right">
              <p className="uppercase text-slate-500 font-bold mb-0.5" style={{ fontSize: '7pt' }}>Termin Płatności ({effectivePaymentTerms} dni)</p>
              <p className={`font-bold ${order.status === OrderStatus.PAID ? 'text-emerald-600' : 'text-red-600'}`}>
                {order.status === OrderStatus.PAID ? formatDate(order.date) : calculatedDueDate}
              </p>
          </div>
      </div>

      {/* Parties */}
      <div className="flex justify-between mb-8 relative z-10" style={{ fontSize: '9pt' }}>
        <div className="w-[48%]">
          <p className="font-bold text-slate-400 uppercase mb-2 border-b border-slate-200 pb-1" style={{ fontSize: '7pt' }}>{docConfig.buyerLabel}:</p>
          <p className="font-bold text-slate-800" style={{ fontSize: '10pt' }}>{company.name}</p>
          <p>ul. Przykładowa 5/10</p>
          <p>00-000 Warszawa, Polska</p>
          <p className="mt-1 font-mono">NIP: {company.nip}</p>
        </div>
        <div className="w-[48%] text-right">
            <p className="font-bold text-slate-400 uppercase mb-2 border-b border-slate-200 pb-1" style={{ fontSize: '7pt' }}>RACHUNEK BANKOWY:</p>
            <p className="font-bold text-slate-800">Bank Millenium S.A.</p>
            <p className="font-mono text-lg mt-1 tracking-wider text-slate-900">PL 12 1020 3040 0000 9999 8888 7777</p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 relative z-10">
        <table className="w-full border-collapse border-b border-slate-800">
            <thead style={{ backgroundColor: '#f1f5f9' }}>
            <tr>
                {docConfig.columns.map((col, idx) => (
                    <th key={idx} className={`border-t border-b border-slate-300 px-2 py-1.5 font-bold uppercase text-slate-700 ${idx > 1 ? 'text-right' : 'text-left'}`} style={{ fontSize: '8pt' }}>
                        {col}
                    </th>
                ))}
            </tr>
            </thead>
            <tbody style={{ fontSize: '9pt' }}>
                <tr className="border-b border-slate-200">
                    <td className="px-2 py-3 text-slate-500">1</td>
                    <td className="px-2 py-3">
                        <strong className="text-slate-800">{isDebitNote ? 'Voucher Prime (Zasilenie punktowe)' : 'Obsługa Techniczna / Prowizja'}</strong>
                        <div className="text-slate-500 mt-1 italic" style={{ fontSize: '8pt' }}>
                            {docConfig.description}
                        </div>
                    </td>
                    
                    {isDebitNote ? (
                        // UKŁAD DLA VOUCHERÓW (Ilość x Nominał)
                        <>
                            <td className="px-2 py-3 text-right font-mono font-bold">{order.amount} szt.</td>
                            <td className="px-2 py-3 text-right font-mono">1.00 PLN</td>
                            <td className="px-2 py-3 text-right font-bold font-mono">{formatCurrency(grossValue)}</td>
                        </>
                    ) : (
                        // UKŁAD DLA FEE (Usługa + VAT)
                        <>
                            <td className="px-2 py-3 text-right font-mono">1</td>
                            <td className="px-2 py-3 text-right font-mono">{formatCurrency(netValue)}</td>
                            <td className="px-2 py-3 text-right font-mono text-slate-500">23%</td>
                            <td className="px-2 py-3 text-right font-bold font-mono">{formatCurrency(grossValue)}</td>
                        </>
                    )}
                </tr>
            </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="mb-8 flex justify-between items-end relative z-10">
          {/* STAMP AREA & LEGAL NOTES */}
          <div className="w-1/2 flex flex-col justify-end pb-2">
             {isDebitNote && (
                 <div className="text-[7pt] text-slate-500 pr-4 text-justify mb-4">
                     <strong>Podstawa prawna:</strong> Bon różnego przeznaczenia (Multi-purpose Voucher - MPV). 
                     Zgodnie z art. 2 pkt 43 ustawy o VAT, transfer bonu nie podlega opodatkowaniu VAT w momencie wydania. 
                     Opodatkowanie następuje w momencie realizacji bonu na konkretny towar lub usługę.
                     Nota nie jest fakturą VAT w rozumieniu ustawy.
                 </div>
             )}
             {order.status === OrderStatus.PAID && (
                <div className="transform -rotate-12 border-[4px] border-emerald-600 text-emerald-600 text-[28px] font-bold opacity-80 px-8 py-2 tracking-widest w-fit" style={{ mixBlendMode: 'multiply' }}>
                    OPŁACONO
                </div>
             )}
          </div>

          {/* TOTALS - Right Side */}
          <div className="w-1/2">
             {!isDebitNote && (
                 <div className="space-y-1 border-b border-slate-300 pb-2 mb-2 text-slate-600" style={{ fontSize: '9pt' }}>
                    <div className="flex justify-between">
                        <span>Wartość Netto:</span>
                        <span className="font-mono">{formatCurrency(netValue)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Podatek VAT (23%):</span>
                        <span className="font-mono">{formatCurrency(vatValue)}</span>
                    </div>
                 </div>
             )}
             
             <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded-sm shadow-md">
                 <div>
                    <span className="block uppercase opacity-70 mb-0.5" style={{ fontSize: '8pt' }}>Razem do zapłaty:</span>
                    <span className="font-bold tracking-tight" style={{ fontSize: '14pt' }}>{formatCurrency(grossValue)}</span>
                 </div>
                 <div className="text-right">
                     <span className="block uppercase opacity-70" style={{ fontSize: '8pt' }}>Waluta</span>
                     <span className="font-bold" style={{ fontSize: '10pt' }}>PLN</span>
                 </div>
             </div>
             
             <p className="mt-2 text-slate-500 text-right leading-relaxed" style={{ fontSize: '9pt' }}>
                Słownie: {grossValue.toFixed(0)} złotych 00/100
             </p>
          </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-slate-200 flex justify-between items-end text-slate-400 relative z-10" style={{ fontSize: '7pt' }}>
        <div>
            <p className="font-bold text-slate-500 mb-0.5">Adnotacje systemowe:</p>
            <p>ID Zamówienia: {order.id}</p>
            <p>Wygenerowano w systemie EBS. Dokument nie wymaga podpisu (Art. 106n ustawy o VAT).</p>
        </div>
        <div className="text-right">
            <p>Strona 1 z 1</p>
        </div>
      </div>
    </div>
  );
};
