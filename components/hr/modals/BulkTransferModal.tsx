
import React, { useState, useRef, useMemo } from 'react';
import { X, Upload, CheckCircle2, Download, FileSpreadsheet, Send, AlertTriangle, FileText, ArrowRight, UserPlus, Loader2 } from 'lucide-react';
import { User } from '../../../types';
import { Button } from '../../ui/Button';

// Declare global XLSX object from CDN
declare const XLSX: {
    read: (data: any, options: any) => any;
    utils: {
        sheet_to_json: (sheet: any, options?: any) => any[];
        aoa_to_sheet: (data: any[][]) => any;
        book_new: () => any;
        book_append_sheet: (wb: any, ws: any, name: string) => void;
        json_to_sheet: (data: any[]) => any;
    };
    writeFile: (wb: any, filename: string) => void;
};

interface BulkTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEmployees: User[];
  onConfirm: (items: { employeeId: string; amount: number }[]) => void;
}

export const BulkTransferModal: React.FC<BulkTransferModalProps> = ({ isOpen, onClose, activeEmployees, onConfirm }) => {
  const [items, setItems] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // SMART TEMPLATE: Pre-fills employees with EXACT IDs needed for matching
  const handleDownloadSmartTemplate = () => {
      // Improved Headers: Clearer for User, still machine readable by "ID" and "KWOTA" search
      const headers = ["ID_SYSTEMOWE (Nie edytować)", "PRACOWNIK", "DZIAL", "EMAIL", "KWOTA_DO_PRZEKAZANIA (PLN)"];
      
      const rows = activeEmployees.map(emp => [
          emp.id, // Critical for matching
          emp.name,
          emp.organization?.department || emp.department || '',
          emp.email,
          0 // Default amount to 0
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Auto-width for readability
      ws['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 30 }];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lista_Dystrybucyjna");
      XLSX.writeFile(wb, `Lista_Dystrybucyjna_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          if (data.length < 2) {
              alert("Plik wydaje się pusty. Pobierz szablon i spróbuj ponownie.");
              return;
          }

          const parsedItems: { id: string; name: string; amount: number }[] = [];
          
          // Fuzzy Header Matching
          const headers = data[0].map(h => String(h).toUpperCase().trim());
          
          const idIdx = headers.findIndex(h => h.includes("ID") || h.includes("SYSTEM"));
          const amountIdx = headers.findIndex(h => h.includes("KWOTA") || h.includes("AMOUNT"));
          
          // Optional name column for display
          const nameIdx = headers.findIndex(h => h.includes("PRACOWNIK") || h.includes("NAZWISKO") || h.includes("NAME"));

          if (idIdx === -1 || amountIdx === -1) {
              alert("Błąd struktury pliku: Nie znaleziono kolumn 'ID_SYSTEMOWE' lub 'KWOTA'. Użyj dedykowanego szablonu.");
              return;
          }

          for (let i = 1; i < data.length; i++) {
              const row = data[i];
              // Safety check for empty rows
              if (!row || row.length === 0) continue;

              const rawId = row[idIdx];
              if (!rawId) continue; 

              const uid = String(rawId).trim();
              
              // Clean amount (replace commas, remove currency symbols)
              let rawAmount = row[amountIdx];
              if (typeof rawAmount === 'string') {
                  rawAmount = rawAmount.replace(',', '.').replace(/[^0-9.]/g, '');
              }
              const val = parseFloat(rawAmount);
              
              const name = nameIdx !== -1 ? row[nameIdx] : 'Pracownik';

              // Validate: ID exists in active employees AND amount is positive
              if (uid && !isNaN(val) && val > 0 && activeEmployees.some(u => u.id === uid)) {
                  parsedItems.push({ id: uid, name, amount: val });
              }
          }

          if (parsedItems.length === 0) {
              alert("Nie znaleziono żadnych poprawnych wierszy. Sprawdź czy wpisałeś kwoty > 0 i czy nie modyfikowałeś ID pracowników.");
          } else {
              setItems(parsedItems);
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = "";
  };

  const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);

  const handleSubmit = async () => {
      if (items.length === 0) return;
      
      setIsProcessing(true);
      
      // Simulate slight delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onConfirm(items.map(i => ({ employeeId: i.id, amount: i.amount })));
      
      setIsProcessing(false);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[85vh] md:h-auto">
            {/* Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <FileSpreadsheet size={20} className="text-emerald-600"/>
                    Masowa Dystrybucja (Excel)
                </h3>
                <button onClick={onClose}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <div className="space-y-8">
                        {/* Step 1: Download */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-emerald-300 transition-colors shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg shrink-0">
                                    <Download size={24}/>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Krok 1: Pobierz listę pracowników</h4>
                                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                                        Wygeneruj plik Excel zawierający aktualne identyfikatory Twoich pracowników.
                                    </p>
                                    <Button 
                                        onClick={handleDownloadSmartTemplate}
                                        variant="success"
                                        size="sm"
                                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none shadow-none"
                                        icon={<FileText size={14}/>}
                                    >
                                        Pobierz Szablon z Bazą
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex justify-center text-slate-300">
                            <ArrowRight size={24} className="rotate-90 md:rotate-0"/>
                        </div>

                        {/* Step 2: Upload */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-colors shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg shrink-0">
                                    <Upload size={24}/>
                                </div>
                                <div className="w-full">
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Krok 2: Wgraj uzupełniony plik</h4>
                                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                                        Wpisz kwoty przy nazwiskach (kolumna "KWOTA") i wgraj plik z powrotem.
                                    </p>
                                    <div className="relative">
                                        <Button 
                                            onClick={() => fileInputRef.current?.click()}
                                            variant="primary"
                                            size="sm"
                                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                                            icon={<Upload size={14}/>}
                                        >
                                            Wybierz Plik Excel
                                        </Button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // PREVIEW MODE
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 p-4 rounded-xl animate-in slide-in-from-top-2">
                            <div>
                                <span className="text-xs font-bold text-emerald-800 uppercase block">Suma do Rozdania</span>
                                <span className="text-2xl font-bold text-emerald-700">{totalAmount.toLocaleString()} PLN</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-500 uppercase block">Odbiorcy</span>
                                <span className="text-lg font-bold text-slate-800">{items.length} osób</span>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto custom-scrollbar bg-white shadow-inner">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3 text-slate-500 font-bold">Pracownik</th>
                                        <th className="p-3 text-slate-500 font-bold text-right">Kwota</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-3 text-slate-700 font-medium">
                                                {item.name}
                                                <span className="block text-[9px] text-slate-400 font-mono">{item.id}</span>
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-600">+{item.amount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                            <button onClick={() => setItems([])} className="text-red-500 hover:text-red-700 hover:underline font-bold transition">
                                Anuluj i wgraj inny plik
                            </button>
                            <span className="text-slate-400 italic">Sprawdź czy dane są poprawne</span>
                        </div>
                        
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2 text-[10px] text-blue-800 items-start">
                            <CheckCircle2 size={14} className="shrink-0 mt-0.5"/>
                            <p>
                                Po zatwierdzeniu, system automatycznie:
                                <br/>1. Zaktualizuje salda pracowników.
                                <br/>2. Wygeneruje <strong>Protokół Zbiorczy</strong> w Teczce HR.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
                <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                    <Button 
                        onClick={onClose} 
                        disabled={isProcessing}
                        variant="secondary"
                    >
                        Anuluj
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isProcessing}
                        isLoading={isProcessing}
                        variant="primary"
                        icon={<Send size={16}/>}
                    >
                        Rozdaj Środki
                    </Button>
                </div>
            )}
        </div>
    </div>
  );
};
