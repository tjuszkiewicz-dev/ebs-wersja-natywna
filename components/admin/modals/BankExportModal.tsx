
import React, { useState } from 'react';
import { X, Download, FileText, CreditCard, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { BuybackAgreement, User } from '../../../types';

interface BankExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBuybacks: BuybackAgreement[];
  users: User[]; // Needed to resolve IBANs
}

type ExportFormat = 'ELIXIR-0' | 'CSV_GENERIC' | 'MT103';

export const BankExportModal: React.FC<BankExportModalProps> = ({
  isOpen, onClose, selectedBuybacks, users
}) => {
  const [format, setFormat] = useState<ExportFormat>('ELIXIR-0');
  const [senderIban, setSenderIban] = useState('PL12102030400000999988887777'); // Mock Sender
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const totalAmount = selectedBuybacks.reduce((acc, b) => acc + b.totalValue, 0);
  const totalCount = selectedBuybacks.length;

  // --- GENERATORS ---

  const generateElixir0 = () => {
      // Format ELIXIR-0 (Uproszczony standard KIR dla przelewów krajowych)
      // Struktura: 110,Data,Kwota,Nadawca,RachNad,RachOdb,Odbiorca,Tytul...
      
      const cleanSender = senderIban.replace(/[^0-9]/g, '');
      let content = '';

      selectedBuybacks.forEach(b => {
          const user = users.find(u => u.id === b.userId);
          const snapshot = b.snapshot?.user;
          
          const receiverName = (snapshot?.name || user?.name || 'Nieznany').substring(0, 35); // Max 35 chars safe
          const receiverIban = (snapshot?.iban || user?.finance?.payoutAccount?.iban || '').replace(/[^0-9]/g, '');
          const amount = Math.round(b.totalValue * 100); // W groszach
          const title = `Odkup Voucherow Umowa ${b.id}`;
          const dateStr = transferDate.replace(/-/g, ''); // YYYYMMDD

          // Linia Elixir-0 (Standard 110 - Polecenie Przelewu)
          // Typ(3)|Data(8)|Kwota(12)|Nadawca(0)|RachNad(26)|RachOdb(26)|Odbiorca|Kwota(0)|0|Tytul|...
          // Dla uproszczenia generujemy format CSV akceptowany przez większość banków jako "Import Elixir"
          // Format: 110,YYYYMMDD,Amount(Grosze),,SenderAccount,ReceiverAccount,ReceiverName,0,0,Title,Line2,Line3
          
          if (receiverIban.length === 26) {
              content += `110,${dateStr},${amount},,${cleanSender},${receiverIban},"${receiverName}",0,0,"${title}","",""\r\n`;
          }
      });

      return { content, ext: 'eli', mime: 'text/plain' };
  };

  const generateCSV = () => {
      // Standard CSV: Data, Kwota, Odbiorca, Rachunek, Tytuł
      let content = "Data Realizacji;Kwota;Nazwa Odbiorcy;Rachunek Odbiorcy;Tytuł Przelewu\n";
      
      selectedBuybacks.forEach(b => {
          const user = users.find(u => u.id === b.userId);
          const snapshot = b.snapshot?.user;
          const receiverName = snapshot?.name || user?.name || 'Nieznany';
          const receiverIban = snapshot?.iban || user?.finance?.payoutAccount?.iban || '';
          
          content += `${transferDate};${b.totalValue.toFixed(2).replace('.', ',')};"${receiverName}";"${receiverIban}";"Odkup Voucherow ${b.id}"\n`;
      });

      return { content, ext: 'csv', mime: 'text/csv' };
  };

  const handleExport = () => {
      setIsProcessing(true);
      
      setTimeout(() => {
          let fileData;
          if (format === 'ELIXIR-0') fileData = generateElixir0();
          else fileData = generateCSV();

          const blob = new Blob([fileData.content], { type: `${fileData.mime};charset=utf-8;` });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Paczka_Przelewow_${transferDate}.${fileData.ext}`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setIsProcessing(false);
          onClose();
      }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <FileText size={20} className="text-indigo-600"/>
                        Generator Paczki Przelewów
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Eksport danych dla bankowości elektronicznej</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={20}/></button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
                
                {/* Summary */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-indigo-400 uppercase">Liczba transakcji</p>
                        <p className="text-2xl font-bold text-indigo-900">{totalCount}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-indigo-400 uppercase">Suma Kontrolna</p>
                        <p className="text-2xl font-bold text-indigo-900">{totalAmount.toFixed(2)} PLN</p>
                    </div>
                </div>

                {/* Settings */}
                <div className="space-y-4">
                    <div>
                        <label className="label-text">Format Pliku</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setFormat('ELIXIR-0')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition ${
                                    format === 'ELIXIR-0' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <FileText size={24}/>
                                <span className="text-xs font-bold">Elixir-0 (KIR)</span>
                            </button>
                            <button 
                                onClick={() => setFormat('CSV_GENERIC')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition ${
                                    format === 'CSV_GENERIC' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <FileSpreadsheet size={24}/>
                                <span className="text-xs font-bold">Import CSV</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="label-text">Konto Nadawcy (Twoje)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={senderIban}
                                onChange={e => setSenderIban(e.target.value)}
                                className="input-field pl-9 font-mono text-sm"
                                placeholder="PL..."
                            />
                            <CreditCard size={14} className="absolute left-3 top-3.5 text-slate-400"/>
                        </div>
                    </div>

                    <div>
                        <label className="label-text">Data Realizacji</label>
                        <input 
                            type="date" 
                            value={transferDate}
                            onChange={e => setTransferDate(e.target.value)}
                            className="input-field"
                        />
                    </div>
                </div>

                {/* Warning */}
                <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800">
                    <AlertTriangle size={20} className="shrink-0"/>
                    <p>
                        Upewnij się, że wszyscy beneficjenci mają poprawne numery IBAN.
                        Błędne numery zostaną odrzucone przez system bankowy po wgraniu pliku.
                    </p>
                </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                <button 
                    onClick={onClose}
                    className="flex-1 py-2.5 text-slate-500 font-bold text-sm hover:bg-white rounded-lg transition"
                >
                    Anuluj
                </button>
                <button 
                    onClick={handleExport}
                    disabled={isProcessing || !senderIban}
                    className="flex-1 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Generowanie...' : 'Pobierz Plik'} <Download size={16}/>
                </button>
            </div>
        </div>
    </div>
  );
};
