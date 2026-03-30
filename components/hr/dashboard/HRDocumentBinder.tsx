
import React, { useState, useMemo } from 'react';
import { FolderOpen, FileText, FileSpreadsheet, Clock, Users, Info, Download, Scale, FileStack, ShieldCheck, FileCheck, CheckCircle2, AlertTriangle, Archive, Loader2, List, Layers } from 'lucide-react';
import { Order, ImportHistoryEntry, Company, User, OrderStatus, DistributionBatch, DocumentTemplate, Role, Voucher, BuybackAgreement } from '../../../types';
import { DocumentDownloadButton } from '../../Documents/DocumentDownloadButton';
import { DataTable, Column } from '../../ui/DataTable';
import { Badge } from '../../ui/Badge';
import { Tabs } from '../../ui/Tabs';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal'; 

// Declare external libs
declare const XLSX: any;
declare const JSZip: any;
declare const saveAs: any;
declare const html2pdf: any;

const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) 
  ? process.env.REACT_APP_API_URL 
  : 'http://localhost:3001';

interface Props {
    orders: Order[];
    importHistory: ImportHistoryEntry[];
    company: Company;
    hrUser?: User;
    distributionBatches?: DistributionBatch[];
    templates?: DocumentTemplate[]; 
    vouchers?: Voucher[]; 
    employees?: User[]; 
    buybacks?: BuybackAgreement[];
    onViewDocument: (type: 'DEBIT_NOTE' | 'VAT_INVOICE' | 'IMPORT_REPORT' | 'PROTOCOL', data: any) => void;
    onViewEvidence: (order: Order) => void;
}

type Tab = 'FINANCE' | 'PROTOCOLS' | 'REPORTS' | 'LEGAL';
type ProtocolSubTab = 'BULK' | 'INDIVIDUAL';

// Bulk Row (Existing)
interface ProtocolRow {
    id: string; 
    date: string;
    type: 'BATCH' | 'ORDER';
    subtype: 'SINGLE' | 'BULK' | 'ORDER_DIST';
    itemCount: number;
    amount: number;
    status: 'COMPLETED' | 'WAITING_PAYMENT' | 'PAID';
    originalRef: DistributionBatch | Order;
}

// Individual Row (New)
interface IndividualProtocolRow {
    id: string; // Unique ID for table key
    date: string;
    userId: string;
    userName: string;
    amount: number;
    sourceRef: string; // Batch ID or Order ID
    sourceType: 'BATCH' | 'ORDER';
}

export const HRDocumentBinder: React.FC<Props> = ({ 
    orders, importHistory, company, hrUser, distributionBatches = [], templates = [], vouchers = [], employees = [], buybacks = [], onViewDocument, onViewEvidence 
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('FINANCE');
    const [protocolSubTab, setProtocolSubTab] = useState<ProtocolSubTab>('BULK');
    
    // ZIP Generation State
    const [isZipModalOpen, setIsZipModalOpen] = useState(false);
    const [zipMonth, setZipMonth] = useState(new Date().toISOString().slice(0, 7));
    const [zipProgress, setZipProgress] = useState(0);
    const [zipStatus, setZipStatus] = useState<string>('');
    const [isZipping, setIsZipping] = useState(false);

    // --- DATA 1: BULK PROTOCOLS (Paczki) ---
    const protocolData = useMemo<ProtocolRow[]>(() => {
        const safeBatches = Array.isArray(distributionBatches) ? distributionBatches : [];
        
        const batches: ProtocolRow[] = safeBatches.map(b => ({
            id: b.id,
            date: b.date,
            type: 'BATCH',
            subtype: (b.items && b.items.length > 1) ? 'BULK' : 'SINGLE',
            itemCount: (b.items || []).length, 
            amount: b.totalAmount,
            status: 'COMPLETED',
            originalRef: b
        }));

        const safeOrders = Array.isArray(orders) ? orders : [];
        const orderProtocols: ProtocolRow[] = safeOrders
            .filter(o => (o.status === OrderStatus.APPROVED || o.status === OrderStatus.PAID) && (o.distributionPlan || o.snapshots))
            .map(o => ({
                id: o.id,
                date: o.date,
                type: 'ORDER',
                subtype: 'ORDER_DIST',
                itemCount: o.distributionPlan ? o.distributionPlan.length : 0,
                amount: o.voucherValue, 
                status: o.status === OrderStatus.PAID ? 'PAID' : 'WAITING_PAYMENT',
                originalRef: o
            }));

        return [...batches, ...orderProtocols].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [distributionBatches, orders]);

    // --- DATA 2: INDIVIDUAL PROTOCOLS (Płaska lista pracowników) ---
    const individualData = useMemo<IndividualProtocolRow[]>(() => {
        const rows: IndividualProtocolRow[] = [];

        // 1. Unpack Batches
        distributionBatches.forEach(b => {
            b.items.forEach((item, idx) => {
                rows.push({
                    id: `${b.id}_${idx}`,
                    date: b.date,
                    userId: item.userId,
                    userName: item.userName,
                    amount: item.amount,
                    sourceRef: b.id,
                    sourceType: 'BATCH'
                });
            });
        });

        // 2. Unpack Orders (Trust Model)
        orders.forEach(o => {
            if ((o.status === OrderStatus.APPROVED || o.status === OrderStatus.PAID) && (o.snapshots || o.distributionPlan)) {
                const plan = o.snapshots || o.distributionPlan;
                plan?.forEach((entry: any, idx: number) => {
                    const uid = entry.matched_user_id || entry.matchedUserId;
                    const val = Number(entry.final_netto_voucher || entry.voucherPartNet);
                    const name = entry.employee_name || entry.employeeName || 'Pracownik';

                    if (uid && val > 0) {
                        rows.push({
                            id: `${o.id}_${idx}`,
                            date: o.date,
                            userId: uid,
                            userName: name,
                            amount: val,
                            sourceRef: o.id,
                            sourceType: 'ORDER'
                        });
                    }
                });
            }
        });

        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [distributionBatches, orders]);

    // --- HELPERS ---
    
    // Sanitize filename to prevent "Path too long" or invalid chars
    const sanitizeFilename = (str: string) => {
        if (!str) return 'file';
        return str
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents (ą->a)
            .replace(/[^a-z0-9]/gi, '_') // Replace non-alphanumeric with _
            .replace(/_+/g, '_') // Collapse multiple _
            .substring(0, 30); // Truncate rigorously
    };

    // FIXED GENERATOR: STRICT SINGLE ITEM RECEIPT
    const generateClientSidePdf = async (type: string, data: any, user: User | undefined) => {
        if (typeof window === 'undefined' || !(window as any).html2pdf) {
             return new Blob(["Error: PDF library missing."], { type: 'text/plain' });
        }

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '210mm'; // A4 width
        container.style.minHeight = '297mm';
        container.style.padding = '20mm';
        container.style.backgroundColor = 'white';
        container.style.fontFamily = 'serif';
        document.body.appendChild(container);

        // Ensure we extract the single item correctly. 
        // Logic: if 'items' array exists, take the first one.
        const item = data.items && data.items.length > 0 ? data.items[0] : { userName: 'Brak Danych', userId: '---', amount: 0, voucherRange: '-' };
        
        // Clean Template - NO ORDER INFO
        container.innerHTML = `
            <style>
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
                h1 { font-size: 22px; text-transform: uppercase; margin: 0; padding: 0; }
                h2 { font-size: 14px; text-transform: uppercase; margin: 5px 0 0 0; color: #555; }
                .meta { margin-bottom: 30px; font-family: sans-serif; font-size: 12px; line-height: 1.6; }
                .content-box { border: 1px solid #000; padding: 20px; margin-bottom: 40px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
                .label { font-weight: bold; }
                .footer { margin-top: 100px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
                .signature-box { display: flex; justify-content: space-between; margin-top: 80px; }
                .sig-line { border-top: 1px dashed #000; width: 40%; padding-top: 5px; text-align: center; font-size: 10px; }
            </style>
            
            <div class="header">
                <h1>Potwierdzenie Otrzymania Środków</h1>
                <h2>System Benefitowy EBS</h2>
            </div>

            <div class="meta">
                <p><strong>Podmiot Przekazujący:</strong> ${company.name}</p>
                <p><strong>Data Operacji:</strong> ${new Date(data.date).toLocaleDateString()}</p>
            </div>
            
            <div class="content-box">
                <div class="row">
                    <span class="label">Beneficjent (Pracownik):</span>
                    <span>${item.userName}</span>
                </div>
                <div class="row">
                    <span class="label">Identyfikator Systemowy:</span>
                    <span>${item.userId}</span>
                </div>
                <hr style="margin: 15px 0; border: 0; border-top: 1px solid #eee;"/>
                <div class="row">
                    <span class="label">Przedmiot Wydania:</span>
                    <span>Voucher Prime (Środki Cyfrowe)</span>
                </div>
                <div class="row">
                    <span class="label">Wartość Nominalna:</span>
                    <span><strong>${item.amount.toFixed(2)} PLN</strong></span>
                </div>
                <div class="row">
                    <span class="label">Szczegóły / Zakres:</span>
                    <span style="font-family: monospace; font-size: 12px;">${item.voucherRange || 'Automatyczny przydział'}</span>
                </div>
            </div>

            <div class="signature-box">
                <div class="sig-line">
                    Podpis Pracodawcy (HR)<br/>
                    (Wygenerowano Elektronicznie)
                </div>
                <div class="sig-line">
                    Podpis Pracownika<br/>
                    (Potwierdzenie Odbioru)
                </div>
            </div>

            <div class="footer">
                Dokument wygenerowany w systemie EBS. Numer referencyjny operacji: ${data.id}
            </div>
        `;

        try {
            const opt = {
                margin: 0, // content has padding
                filename: `Potwierdzenie_${item.userId}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            // Critical wait for rendering
            await new Promise(r => setTimeout(r, 100));

            // @ts-ignore
            const worker = window.html2pdf().set(opt).from(container).toPdf().get('pdf');
            const pdf = await worker;
            const blob = pdf.output('blob');
            
            document.body.removeChild(container);
            return blob;
        } catch (e) {
            console.error("PDF Gen Error:", e);
            document.body.removeChild(container);
            return new Blob([`Error generating PDF: ${e}`], { type: 'text/plain' });
        }
    };

    const fetchPdfBlob = async (type: string, data: any, user: User | undefined) => {
        // ALWAYS use client-side for individual receipts to ensure simplicity and speed in ZIP
        // and to avoid server template complexity for single items.
        return await generateClientSidePdf(type, data, user);
    };

    // --- ZIP GENERATOR (FIXED) ---
    const handleGenerateZip = async () => {
        if (!zipMonth) return;
        setIsZipping(true);
        setZipProgress(0);
        setZipStatus('Przygotowanie danych...');

        try {
            const zip = new JSZip();
            const rootFolder = zip.folder(`Teczki_${sanitizeFilename(company.name)}_${zipMonth}`);

            // 1. Get ALL individual transactions for the month
            const monthTransactions = individualData.filter(row => row.date.startsWith(zipMonth));

            if (monthTransactions.length === 0) {
                alert("Brak operacji w wybranym miesiącu.");
                setIsZipping(false);
                return;
            }

            // Group by User to create folders
            const userGroups: Record<string, IndividualProtocolRow[]> = {};
            monthTransactions.forEach(row => {
                if(!userGroups[row.userId]) userGroups[row.userId] = [];
                userGroups[row.userId].push(row);
            });

            const userIds = Object.keys(userGroups);
            const totalUsers = userIds.length;
            let processedCount = 0;

            // 2. Loop Users
            for (const userId of userIds) {
                const userTrans = userGroups[userId];
                const userName = userTrans[0].userName;
                const userFolder = rootFolder.folder(`${sanitizeFilename(userName)}_${userId}`);
                
                setZipStatus(`Generowanie: ${userName}`);

                // Generate PDF for EACH transaction
                for (const trans of userTrans) {
                    // CREATE CLEAN VIRTUAL BATCH
                    const virtualBatch: DistributionBatch = {
                        id: trans.sourceRef, // Use original ref ID
                        companyId: company.id,
                        date: trans.date,
                        hrName: 'System EBS',
                        totalAmount: trans.amount,
                        status: 'COMPLETED',
                        items: [{
                            userId: trans.userId,
                            userName: trans.userName,
                            amount: trans.amount,
                            // Simplifies range info for the receipt
                            // @ts-ignore
                            voucherRange: trans.sourceType === 'ORDER' ? 'Zasilenie Systemowe (Trust)' : 'Dystrybucja Ręczna'
                        }]
                    };

                    // Generate using Client Side logic (guaranteed structure)
                    const blob = await generateClientSidePdf('PROTOCOL', virtualBatch, employees.find(u => u.id === userId));
                    
                    const safeDate = trans.date.slice(0, 10);
                    const safeId = sanitizeFilename(trans.sourceRef).slice(0, 10);
                    const filename = `Potwierdzenie_${safeDate}_${safeId}.pdf`;
                    
                    userFolder.file(filename, blob);
                }

                processedCount++;
                setZipProgress(Math.round((processedCount / totalUsers) * 100));
                
                // Yield to UI to allow progress bar update
                await new Promise(r => setTimeout(r, 10));
            }

            // 3. Finalize
            setZipStatus('Kompresowanie archiwum...');
            const zipContent = await zip.generateAsync({ type: "blob" });
            saveAs(zipContent, `Teczki_HR_${zipMonth}.zip`);
            
            setZipStatus('Gotowe!');
            setTimeout(() => {
                setIsZipping(false);
                setIsZipModalOpen(false);
            }, 1000);

        } catch (error) {
            console.error("ZIP Error:", error);
            alert("Wystąpił błąd podczas generowania archiwum.");
            setIsZipping(false);
        }
    };

    // --- HELPER: CALCULATE VOUCHER RANGES ---
    const enrichBatchItemWithRange = (batch: DistributionBatch, item: any) => {
        const batchTime = new Date(batch.date).getTime();
        const userVouchers = vouchers.filter(v => {
            if (v.ownerId !== item.userId) return false;
            const vTime = new Date(v.issueDate).getTime();
            return Math.abs(vTime - batchTime) < 3600000; 
        }).sort((a,b) => a.id.localeCompare(b.id));

        if (userVouchers.length > 0) {
            const first = userVouchers[0].id.split('/').pop();
            const last = userVouchers[userVouchers.length - 1].id.split('/').pop();
            const rangeStr = userVouchers.length > 1 ? `${first}...${last}` : first;
            return { ...item, voucherRange: rangeStr };
        }
        return { ...item, voucherRange: "Generowane w systemie" };
    };

    const enrichBatchWithRanges = (batch: DistributionBatch): DistributionBatch => {
        const enrichedItems = (batch.items || []).map(item => enrichBatchItemWithRange(batch, item));
        return { ...batch, items: enrichedItems };
    };

    // ... (Excel handlers kept same as before) ...
    const handleDownloadImportExcel = (entry: ImportHistoryEntry) => {
        if (typeof XLSX === 'undefined') { alert('Brak biblioteki Excel'); return; }
        const users = entry.reportData?.users || [];
        const ws = XLSX.utils.json_to_sheet(users);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Import");
        XLSX.writeFile(wb, `Raport_Importu_${entry.id}.xlsx`);
    };

    const handleDownloadEvidenceExcel = (row: ProtocolRow) => {
        alert("Pobieranie ewidencji...");
    };

    // --- COLUMNS ---
    const financeColumns: Column<Order>[] = [
        { header: 'Data', accessorKey: 'date', cell: (o) => new Date(o.date).toLocaleDateString() },
        { header: 'ID Zamówienia', accessorKey: 'id', cell: (o) => <span className="font-bold text-xs">{o.id}</span> },
        { header: 'Kwota', accessorKey: 'totalValue', className: 'text-right', cell: (o) => <b>{o.totalValue.toLocaleString()} PLN</b> },
        { header: 'Status', accessorKey: 'status', cell: (o) => <StatusBadge status={o.status}/> },
        { 
            header: 'Akcja', className: 'text-right',
            cell: (o) => (
                <div className="flex justify-end gap-2">
                    <button onClick={() => onViewDocument('DEBIT_NOTE', o)} className="bg-slate-100 px-2 py-1 rounded text-xs">Nota</button>
                    <button onClick={() => onViewDocument('VAT_INVOICE', o)} className="bg-slate-100 px-2 py-1 rounded text-xs">Faktura</button>
                </div>
            ) 
        }
    ];

    const bulkProtocolColumns: Column<ProtocolRow>[] = [
        { header: 'Data', accessorKey: 'date', cell: (r) => new Date(r.date).toLocaleDateString() },
        { header: 'ID Operacji', accessorKey: 'id', cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
        { header: 'Typ', cell: (r) => r.type === 'ORDER' ? <Badge variant="info">Automatyczny (Trust)</Badge> : <Badge variant="neutral">Ręczny (Paczka)</Badge> },
        { header: 'Ilość', accessorKey: 'itemCount', className: 'text-center' },
        { header: 'Wartość', accessorKey: 'amount', className: 'text-right', cell: (r) => <b>{r.amount.toLocaleString()} PLN</b> },
        {
            header: 'Dokument', className: 'text-right',
            cell: (r) => r.type === 'BATCH' 
                ? <DocumentDownloadButton docName={`Protokol_${r.id}`} type="PROTOCOL" data={enrichBatchWithRanges(r.originalRef as DistributionBatch)} company={company} user={hrUser} />
                : <button onClick={() => onViewEvidence(r.originalRef as Order)} className="text-xs text-indigo-600 font-bold">Lista</button>
        }
    ];

    const individualProtocolColumns: Column<IndividualProtocolRow>[] = [
        { header: 'Data', accessorKey: 'date', cell: (r) => new Date(r.date).toLocaleDateString() },
        { header: 'Pracownik', accessorKey: 'userName', cell: (r) => <span className="font-medium">{r.userName}</span> },
        { header: 'Źródło', cell: (r) => <span className="text-[10px] text-slate-500">{r.sourceRef}</span> },
        { header: 'Kwota', accessorKey: 'amount', className: 'text-right', cell: (r) => <span className="font-bold text-emerald-600">{r.amount} PLN</span> },
        {
            header: 'Potwierdzenie', className: 'text-right',
            cell: (r) => (
                <button 
                    onClick={() => {
                        // Generate single PDF on demand using the FIXED client-side generator
                        const virtualBatch: DistributionBatch = {
                            id: r.sourceRef, 
                            companyId: company.id, 
                            date: r.date, 
                            hrName: 'System', 
                            totalAmount: r.amount, 
                            status: 'COMPLETED',
                            items: [{ 
                                userId: r.userId, 
                                userName: r.userName, 
                                amount: r.amount,
                                // @ts-ignore 
                                voucherRange: r.sourceType === 'ORDER' ? 'Zasilenie (Trust)' : 'Dystrybucja'
                            }]
                        };
                        
                        generateClientSidePdf('PROTOCOL', virtualBatch, employees.find(u => u.id === r.userId))
                            .then(blob => saveAs(blob, `Potwierdzenie_${r.userName}_${r.date.slice(0,10)}.pdf`));
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-500 border border-transparent hover:border-slate-300 transition"
                    title="Pobierz PDF"
                >
                    <Download size={14}/>
                </button>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header & Tabs */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="text-indigo-600" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Elektroniczna Teczka</h2>
                    </div>
                    {/* ZIP BUTTON - Always visible in Protocols */}
                    {activeTab === 'PROTOCOLS' && (
                        <button 
                            onClick={() => setIsZipModalOpen(true)}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-lg"
                        >
                            <Archive size={16}/> Pobierz Teczki Miesięczne (ZIP)
                        </button>
                    )}
                </div>
                <div className="border-b border-slate-100">
                    <Tabs 
                        activeTab={activeTab} 
                        onChange={(t) => setActiveTab(t as Tab)}
                        items={[
                            { id: 'FINANCE', label: 'Finanse', icon: <FileText size={14}/> },
                            { id: 'PROTOCOLS', label: 'Protokoły', icon: <FileStack size={14}/> },
                            { id: 'REPORTS', label: 'Raporty', icon: <Users size={14}/> },
                            { id: 'LEGAL', label: 'Prawne', icon: <Scale size={14}/> },
                        ]}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                
                {activeTab === 'FINANCE' && (
                    <DataTable data={orders} columns={financeColumns} mobileRenderer={(o) => <div>{o.id}</div>} searchPlaceholder="Szukaj faktury..." />
                )}
                
                {activeTab === 'PROTOCOLS' && (
                    <div className="flex flex-col h-full">
                        {/* SUB TABS FOR PROTOCOLS */}
                        <div className="p-2 bg-slate-50 border-b border-slate-200 flex gap-2">
                            <button 
                                onClick={() => setProtocolSubTab('BULK')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition ${protocolSubTab === 'BULK' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                                <Layers size={14}/> ZBIORCZE (Paczki)
                            </button>
                            <button 
                                onClick={() => setProtocolSubTab('INDIVIDUAL')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition ${protocolSubTab === 'INDIVIDUAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                                <List size={14}/> INDYWIDUALNE (Pracownicy)
                            </button>
                        </div>

                        {protocolSubTab === 'BULK' ? (
                            <DataTable 
                                data={protocolData} 
                                columns={bulkProtocolColumns} 
                                mobileRenderer={(p) => <div>{p.id}</div>} 
                                searchPlaceholder="Szukaj operacji..." 
                            />
                        ) : (
                            <DataTable 
                                data={individualData} 
                                columns={individualProtocolColumns} 
                                mobileRenderer={(r) => <div>{r.userName}</div>} 
                                searchPlaceholder="Szukaj pracownika..." 
                                searchableFields={['userName', 'userId']}
                            />
                        )}
                    </div>
                )}

                {/* Other Tabs... */}
                {activeTab === 'REPORTS' && <DataTable data={importHistory} columns={[]} mobileRenderer={() => <div/>} searchPlaceholder="Szukaj raportu..." />}
                {activeTab === 'LEGAL' && <DataTable data={templates} columns={[]} mobileRenderer={() => <div/>} searchPlaceholder="Szukaj dokumentu..." />}
            </div>

            {/* ZIP Modal */}
            {isZipModalOpen && (
                <Modal 
                    isOpen={isZipModalOpen}
                    onClose={() => !isZipping && setIsZipModalOpen(false)}
                    title="Archiwizacja Miesięczna (ZIP)"
                    maxWidth="max-w-md"
                >
                    <div className="space-y-6">
                        {!isZipping ? (
                            <>
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                    <p className="text-sm text-blue-700">
                                        <strong>Uwaga:</strong> System wygeneruje "Czyste Potwierdzenia" dla każdego pracownika.
                                        Dokumenty te będą zawierać jedynie informację o otrzymanej kwocie, bez szczegółów zamówienia firmy.
                                    </p>
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Miesiąc</label>
                                    <input type="month" value={zipMonth} onChange={(e) => setZipMonth(e.target.value)} className="w-full border p-2 rounded" />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => setIsZipModalOpen(false)} className="flex-1 py-2 text-slate-500 font-bold border rounded">Anuluj</button>
                                    <button onClick={handleGenerateZip} className="flex-1 py-2 bg-slate-900 text-white font-bold rounded">Generuj ZIP</button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <Loader2 size={48} className="animate-spin text-indigo-600 mx-auto mb-4"/>
                                <h3 className="font-bold">Generowanie Teczek...</h3>
                                <p className="text-sm text-slate-500 mb-4">{zipStatus}</p>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${zipProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};
