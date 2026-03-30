
import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { Order, BuybackAgreement, Company, User, DistributionBatch } from '../types';
import { DocumentViewer } from './Documents/DocumentViewer';
import { DocumentDownloadButton } from './Documents/DocumentDownloadButton';
import { BuybackAgreementTemplate } from './Documents/templates/BuybackAgreementTemplate';
import { InvoiceTemplate } from './Documents/templates/InvoiceTemplate';
import { ImportReportTemplate } from './Documents/templates/ImportReportTemplate';
import { DistributionProtocolTemplate } from './Documents/templates/DistributionProtocolTemplate';

type DocumentType = 'DEBIT_NOTE' | 'VAT_INVOICE' | 'BUYBACK_AGREEMENT' | 'IMPORT_REPORT' | 'PROTOCOL';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: DocumentType;
  data: any; 
  company?: Company; 
  user?: User; 
  template?: string; 
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ isOpen, onClose, type, data, company, user }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const renderContent = () => {
    if (type === 'BUYBACK_AGREEMENT' && user) {
        return <BuybackAgreementTemplate data={data as BuybackAgreement} user={user} />;
    }
    if ((type === 'DEBIT_NOTE' || type === 'VAT_INVOICE') && company) {
        return <InvoiceTemplate type={type} order={data as Order} company={company} />;
    }
    if (type === 'IMPORT_REPORT' && company && user) {
        return <ImportReportTemplate data={data} company={company} user={user} />;
    }
    if (type === 'PROTOCOL' && company) {
        return <DistributionProtocolTemplate batch={data as DistributionBatch} company={company} />;
    }
    return <div className="p-12 text-center text-red-500">Brak danych do wygenerowania dokumentu.</div>;
  };

  const getTitle = () => {
      if (type === 'DEBIT_NOTE') return 'Nota Księgowa';
      if (type === 'VAT_INVOICE') return 'Faktura VAT';
      if (type === 'IMPORT_REPORT') return 'Raport Importu';
      if (type === 'PROTOCOL') return 'Protokół Wydania';
      return 'Umowa Odkupu';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-0 md:p-4">
      <div className="bg-slate-200 rounded-none md:rounded-xl shadow-2xl w-full max-w-6xl flex flex-col h-full md:max-h-[95vh] animate-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-50 rounded-t-xl shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-slate-100 p-2 rounded hidden sm:block">
                <span className="font-bold text-slate-700">
                    {type === 'PROTOCOL' ? 'PRT' : type === 'DEBIT_NOTE' ? 'NK' : type === 'VAT_INVOICE' ? 'FV' : type === 'IMPORT_REPORT' ? 'RPT' : 'DOC'}
                </span>
             </div>
             <div>
               <h3 className="font-bold text-slate-800 text-sm md:text-base">
                 {getTitle()}
               </h3>
               <p className="text-xs text-slate-500 font-mono hidden sm:block">ID: {data.id || data.reportId}</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="p-2 hover:bg-slate-100 rounded text-slate-600 flex items-center gap-2 transition" 
              title="Drukuj (Podgląd)"
            >
              <Printer size={20}/>
              <span className="text-xs font-medium hidden sm:inline">Drukuj</span>
            </button>
            
            <DocumentDownloadButton 
                docName={`Dokument_${data.id || data.reportId}`} 
                type={type}
                data={data}
                company={company}
                user={user}
                contentRef={contentRef}
            />

            <div className="w-px h-8 bg-slate-200 mx-2"></div>
            <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition"><X size={24}/></button>
          </div>
        </div>

        {/* Modular Viewer (HTML Preview) */}
        <DocumentViewer ref={contentRef} className="flex-1 min-h-0">
            {renderContent()}
        </DocumentViewer>
        
      </div>
    </div>
  );
};
