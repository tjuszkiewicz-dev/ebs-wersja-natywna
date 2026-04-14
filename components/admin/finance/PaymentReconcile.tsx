
import React, { useState, useRef, useMemo } from 'react';
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, RefreshCw, BarChart } from 'lucide-react';
import { Order, OrderStatus } from '../../../types';
import { Badge } from '../../ui/Badge';
import { useStrattonSystem } from '../../../context/StrattonContext';
import { Button } from '../../ui/Button';
import * as XLSX from 'xlsx';

interface PaymentReconcileProps {
  orders: Order[];
  onProcessPayments: (matchedIds: string[]) => void;
}

interface BankTransaction {
  id: string; 
  date: string;
  amount: number;
  sender: string;
  title: string;
  matchedOrderId?: string;
  matchStatus: 'FULL_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH';
  matchNote?: string;
}

export const PaymentReconcile: React.FC<PaymentReconcileProps> = ({ orders, onProcessPayments }) => {
  const { actions } = useStrattonSystem();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingOrders = useMemo(() => orders.filter(o => o.status === OrderStatus.APPROVED), [orders]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
              processBankFile(data);
          } catch (err) {
              console.error("File parse error", err);
              actions.addToast("Błąd Pliku", "Nie udało się odczytać pliku. Upewnij się, że to format Excel/CSV.", "ERROR");
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = "";
  };

  const processBankFile = (rows: any[][]) => {
      const parsed: BankTransaction[] = [];
      if (rows.length < 2) return;

      const headers = rows[0].map(h => String(h).toLowerCase().trim());
      const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date'));
      const amountIdx = headers.findIndex(h => h.includes('kwota') || h.includes('amount'));
      const senderIdx = headers.findIndex(h => h.includes('nadawca') || h.includes('sender'));
      const titleIdx = headers.findIndex(h => h.includes('tytuł') || h.includes('title') || h.includes('opis'));

      if (amountIdx === -1 || titleIdx === -1) {
          actions.addToast("Błąd Struktury", "Nie udało się wykryć kolumn 'Kwota' lub 'Tytuł' w pliku.", "ERROR");
          return;
      }

      for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawAmount = row[amountIdx];
          if (rawAmount === undefined || rawAmount === null || rawAmount === '') continue;

          const amountStr = String(rawAmount).replace(/[^\d.,-]/g, '').replace(',', '.');
          const amount = parseFloat(amountStr);
          if (isNaN(amount)) continue;

          const rawDate = dateIdx !== -1 ? row[dateIdx] : new Date().toISOString().slice(0, 10);
          const title = titleIdx !== -1 ? String(row[titleIdx]) : 'Brak tytułu';
          const sender = senderIdx !== -1 ? String(row[senderIdx]) : 'Nieznany';
          
          let matchStatus: BankTransaction['matchStatus'] = 'NO_MATCH';
          let matchedOrderId: string | undefined = undefined;
          let matchNote: string | undefined = undefined;

          const foundOrder = pendingOrders.find(o => {
              const cleanTitle = title.toUpperCase();
              const cleanId = o.id.toUpperCase();
              return cleanTitle.includes(cleanId);
          });

          if (foundOrder) {
              matchedOrderId = foundOrder.id;
              if (Math.abs(foundOrder.totalValue - amount) < 0.05) {
                  matchStatus = 'FULL_MATCH';
              } else {
                  matchStatus = 'PARTIAL_MATCH';
                  matchNote = `Niezgodność kwoty. Oczekiwano: ${foundOrder.totalValue.toFixed(2)} PLN, otrzymano: ${amount.toFixed(2)} PLN`;
              }
          }

          parsed.push({
              id: `TX-${Date.now()}-${i}`,
              date: String(rawDate),
              amount: amount,
              sender: sender,
              title: title,
              matchedOrderId,
              matchStatus,
              matchNote
          });
      }
      setTransactions(parsed);
      if(parsed.length > 0) {
          actions.addToast("Import Zakończony", `Przetworzono ${parsed.length} transakcji.`, "SUCCESS");
      }
  };

  const handleDownloadTemplate = () => {
      const headers = ["Data Operacji", "Kwota", "Nadawca", "Tytuł Przelewu"];
      const mockRows = pendingOrders.slice(0, 3).map(o => [
          new Date().toISOString().slice(0, 10),
          o.totalValue,
          "Przykładowa Firma Sp. z o.o.",
          `Zapłata za ${o.id}`
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...mockRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Wyciag_Bankowy");
      XLSX.writeFile(wb, "Szablon_Wyciag_Bankowy.xlsx");
  };

  const handleBulkProcess = () => {
      const fullMatches = transactions
          .filter(t => t.matchStatus === 'FULL_MATCH' && t.matchedOrderId)
          .map(t => t.matchedOrderId!);
      
      if (fullMatches.length === 0) return;

      if (confirm(`Czy na pewno zaksięgować ${fullMatches.length} zgodnych płatności?`)) {
          setIsProcessing(true);
          setTimeout(() => {
              onProcessPayments(fullMatches);
              setIsProcessing(false);
              setTransactions([]); 
              actions.addToast("Zaksięgowano", `Pomyślnie rozliczono ${fullMatches.length} zamówień.`, "SUCCESS");
          }, 1000);
      }
  };

  const stats = useMemo(() => ({
      total: transactions.length,
      matched: transactions.filter(t => t.matchStatus === 'FULL_MATCH').length,
      partial: transactions.filter(t => t.matchStatus === 'PARTIAL_MATCH').length,
      unmatched: transactions.filter(t => t.matchStatus === 'NO_MATCH').length,
      totalAmount: transactions.filter(t => t.matchStatus === 'FULL_MATCH').reduce((acc, t) => acc + t.amount, 0)
  }), [transactions]);

  const matchPercentage = stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* 1. UPLOAD SECTION */}
        <div className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                <FileSpreadsheet size={32}/>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Wgraj Wyciąg Bankowy (MT940 / CSV)</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                System automatycznie sparuje wpływy z oczekującymi zamówieniami na podstawie kwoty i numeru zamówienia w tytule.
            </p>
            <div className="flex justify-center gap-4">
                <Button onClick={handleDownloadTemplate} variant="secondary" size="sm">
                    Pobierz Próbkę (XLSX)
                </Button>
                <div className="relative">
                    <Button 
                        onClick={() => fileInputRef.current?.click()}
                        variant="primary"
                        size="sm"
                        icon={<Upload size={16}/>}
                    >
                        Wybierz Plik
                    </Button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload}
                    />
                </div>
            </div>
        </div>

        {/* 2. RESULTS TABLE */}
        {transactions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                
                {/* MATCH QUALITY BAR */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <BarChart size={14}/> Jakość Dopasowania Pliku
                        </span>
                        <span className="text-sm font-bold text-slate-700">{matchPercentage.toFixed(0)}% Zgodności</span>
                    </div>
                    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-200">
                        <div style={{ width: `${(stats.matched/stats.total)*100}%` }} className="bg-emerald-500" title={`Pełna zgodność: ${stats.matched}`} />
                        <div style={{ width: `${(stats.partial/stats.total)*100}%` }} className="bg-amber-400" title={`Częściowa zgodność: ${stats.partial}`} />
                    </div>
                </div>

                <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-700 text-lg">{stats.total}</span>
                            <span className="text-xs text-slate-500 uppercase font-bold">Wszystkie</span>
                        </div>
                        <div className="w-px h-8 bg-slate-300"></div>
                        <div className="flex flex-col">
                            <span className="font-bold text-emerald-600 text-lg">{stats.matched}</span>
                            <span className="text-xs text-emerald-700 uppercase font-bold">Zgodne</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-amber-600 text-lg">{stats.partial}</span>
                            <span className="text-xs text-amber-700 uppercase font-bold">Błędy</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <span className="text-xs text-slate-500 uppercase font-bold block">Suma do zaksięgowania</span>
                            <span className="text-lg font-bold text-slate-800">{stats.totalAmount.toFixed(2)} PLN</span>
                        </div>
                        <Button 
                            onClick={handleBulkProcess}
                            disabled={stats.matched === 0}
                            isLoading={isProcessing}
                            variant="success"
                            size="sm"
                            icon={<CheckCircle2 size={16}/>}
                        >
                            Zaksięguj Zgodne ({stats.matched})
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold">
                            <tr>
                                <th className="px-4 py-3">Data</th>
                                <th className="px-4 py-3">Nadawca / Tytuł</th>
                                <th className="px-4 py-3 text-right">Kwota</th>
                                <th className="px-4 py-3 text-center">Status Dopasowania</th>
                                <th className="px-4 py-3">ID Zamówienia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {transactions.map(t => (
                                <tr key={t.id} className={`hover:bg-slate-50 transition ${
                                    t.matchStatus === 'FULL_MATCH' ? 'bg-emerald-50/30' : 
                                    t.matchStatus === 'PARTIAL_MATCH' ? 'bg-amber-50/30' : ''
                                }`}>
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                        {t.date}
                                    </td>
                                    <td className="px-4 py-3 max-w-xs">
                                        <div className="font-bold text-slate-700 truncate" title={t.sender}>{t.sender}</div>
                                        <div className="text-xs text-slate-500 truncate" title={t.title}>{t.title}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                        {t.amount.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {t.matchStatus === 'FULL_MATCH' && <Badge variant="success">Pełna Zgodność</Badge>}
                                        {t.matchStatus === 'PARTIAL_MATCH' && <Badge variant="warning">Różnica Kwot</Badge>}
                                        {t.matchStatus === 'NO_MATCH' && <Badge variant="error">Brak Powiązania</Badge>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {t.matchedOrderId ? (
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold bg-white border px-1.5 py-0.5 rounded text-slate-600">
                                                    {t.matchedOrderId}
                                                </span>
                                                {t.matchNote && (
                                                    <div className="group relative">
                                                        <AlertTriangle size={14} className="text-amber-500 cursor-help"/>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 bg-slate-800 text-white text-[10px] p-2 rounded hidden group-hover:block z-10 text-center">
                                                            {t.matchNote}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs italic">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};
