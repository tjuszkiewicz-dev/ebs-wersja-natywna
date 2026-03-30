
import React, { useState, useRef } from 'react';
import { RefreshCw, Server, FileDown } from 'lucide-react';
import { Company, User } from '../../types';
import { ImportReportTemplate } from './templates/ImportReportTemplate';
import { DistributionProtocolTemplate } from './templates/DistributionProtocolTemplate';
import { PolicyTemplate } from './templates/PolicyTemplate';
import { useStrattonSystem } from '../../context/StrattonContext';

// Configuration for API Endpoint
const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) 
  ? process.env.REACT_APP_API_URL 
  : 'http://localhost:3001';

interface DocumentDownloadButtonProps {
  docName: string;
  type?: 'DEBIT_NOTE' | 'VAT_INVOICE' | 'BUYBACK_AGREEMENT' | 'IMPORT_REPORT' | 'PROTOCOL' | 'POLICY';
  data?: any;
  company?: Company;
  user?: User;
  contentRef?: React.RefObject<HTMLDivElement>;
}

export const DocumentDownloadButton: React.FC<DocumentDownloadButtonProps> = ({ 
  docName, type, data, company, user, contentRef 
}) => {
  const { actions } = useStrattonSystem(); // Use context for Toasts
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<'SERVER' | 'CLIENT'>('SERVER');
  
  const internalRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!type || !data) {
        actions.addToast("Błąd Generowania", "Brak danych do wygenerowania dokumentu.", "ERROR");
        return;
    }

    setIsGenerating(true);

    try {
        // Attempt Server-Side Generation
        console.log(`[PDF] Requesting from ${API_BASE_URL}/api/generate-pdf...`);
        
        // Timeout promise to prevent hanging if server is down
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(`${API_BASE_URL}/api/generate-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, data, company, user }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("Server response not OK");

        const blob = await response.blob();
        downloadBlob(blob, `${docName}.pdf`);
        setMode('SERVER');
        actions.addToast("Pobieranie", "Dokument PDF został wygenerowany (HQ).", "SUCCESS");

    } catch (e) {
        // Fallback to Client-Side
        console.warn("Server-side failed, switching to client-side fallback.", e);
        const targetRef = contentRef || internalRef;
        
        if (targetRef && targetRef.current && (window as any).html2pdf) {
            try {
                const element = targetRef.current;
                const opt = {
                    margin: [0, 0, 0, 0],
                    filename: `${docName}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                await (window as any).html2pdf().set(opt).from(element).save();
                setMode('CLIENT');
                actions.addToast("Pobieranie (Lokalne)", "Wygenerowano dokument w trybie offline.", "INFO");
            } catch (clientError) {
                console.error("Client-side generation error:", clientError);
                actions.addToast("Błąd Krytyczny", "Nie udało się wygenerować PDF ani zdalnie, ani lokalnie.", "ERROR");
            }
        } else {
             actions.addToast("Błąd Systemu", "Biblioteki PDF są niedostępne.", "ERROR");
        }
    } finally {
        setIsGenerating(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <>
      <button 
        onClick={handleDownload}
        disabled={isGenerating}
        className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded flex items-center gap-2 transition shadow-sm disabled:opacity-50 justify-center" 
        title={mode === 'SERVER' ? "Silnik: Server (High Quality)" : "Silnik: Client (Fallback)"}
      >
        {isGenerating ? <RefreshCw size={14} className="animate-spin"/> : <FileDown size={14}/>}
        <span className="text-xs font-bold hidden sm:inline">{isGenerating ? '...' : 'PDF'}</span>
      </button>

      {/* Hidden Render Container for Client-Side Fallback */}
      {!contentRef && (type === 'IMPORT_REPORT' || type === 'PROTOCOL' || type === 'POLICY') && data && (
        <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '210mm' }}>
             <div ref={internalRef}>
                {type === 'IMPORT_REPORT' && company && <ImportReportTemplate data={data} company={company} user={user} />}
                {type === 'PROTOCOL' && company && <DistributionProtocolTemplate batch={data} company={company} />}
                {type === 'POLICY' && <PolicyTemplate data={data} company={company} />}
             </div>
        </div>
      )}
    </>
  );
};
