
import React, { useState, useMemo } from 'react';
import { Order, User, PayrollEntry, OrderStatus, Voucher, VoucherStatus, Company } from '../../../types';
import { CreditCard, History, Calculator, Settings, FileText, CheckCircle2, ChevronLeft, Plus, Sparkles, Clock, AlertCircle, Wallet, FileSpreadsheet, Send, CheckCircle, ArrowRight, X } from 'lucide-react';
import { HROrderCreator } from './HROrderCreator';
import { HROrderList } from './HROrderList';
import { PayrollModal } from '../PayrollModal';
import { PaymentDetailsModal } from '../modals/PaymentDetailsModal';
import { formatCurrency } from '../../../utils/formatters';
import { HRFinanceStats } from './HRFinanceStats';

interface Props {
    orders: Order[];
    employees: User[];
    vouchers: Voucher[]; 
    company: Company;
    onPlaceOrder: (amount: number, plan?: PayrollEntry[]) => void;
    onParsePayroll: (file: File) => Promise<PayrollEntry[]>;
    onViewDocument: (type: 'DEBIT_NOTE' | 'VAT_INVOICE', order: Order) => void;
    onViewEvidence: (order: Order) => void;
    onExportTemplate: (users: User[]) => void;
    onDistributeSingle: (order: Order) => void;
    onDistributeBulk: (order: Order) => void;
}

type ViewMode = 'DASHBOARD' | 'CREATE_ORDER';

export const HRSettlementWizard: React.FC<Props> = ({ 
    orders, employees, vouchers, company, onPlaceOrder, onParsePayroll, onViewDocument, onViewEvidence, onExportTemplate, onDistributeSingle, onDistributeBulk
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('DASHBOARD');
    
    // Creator State
    const [amount, setAmount] = useState(100);
    const [plan, setPlan] = useState<PayrollEntry[] | undefined>(undefined);
    const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

    // Filter unpaid orders for quick access
    const unpaidOrders = useMemo(() => 
        orders.filter(o => o.status === OrderStatus.APPROVED).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), 
    [orders]);

    const handleCreateOrder = (e: React.FormEvent) => {
        e.preventDefault();
        onPlaceOrder(amount, plan);
        // Reset and go back to dashboard
        setAmount(100);
        setPlan(undefined);
        setViewMode('DASHBOARD');
    };

    const handlePayrollApply = (calculatedAmount: number, distributionPlan: PayrollEntry[]) => {
        setAmount(calculatedAmount);
        setPlan(distributionPlan);
        setViewMode('CREATE_ORDER'); // Ensure we are in create mode
    };

    // --- RENDER: DASHBOARD VIEW (Main) ---
    const renderDashboard = () => (
        <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* 1. Header & Stats */}
            <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Centrum Rozliczeń</h2>
                        <p className="text-slate-500 text-sm">Zarządzaj budżetem, fakturami i nowymi zamówieniami.</p>
                    </div>
                    <button 
                        onClick={() => setViewMode('CREATE_ORDER')}
                        className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:via-indigo-500 hover:to-violet-500 text-white px-8 py-3.5 rounded-xl font-bold shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all duration-300 flex items-center gap-2.5 active:scale-[0.98]"
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <Plus size={20} className="relative z-10 stroke-[3px]" /> 
                        <span className="relative z-10">Nowe Zasilenie</span>
                    </button>
                </div>

                <HRFinanceStats orders={orders} onNavigateToUnpaid={() => {}} />
            </div>

            {/* 2. Unpaid Orders Alert (If any) */}
            {unpaidOrders.length > 0 && (
                <div className="bg-white border-l-4 border-red-500 rounded-r-xl shadow-sm p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <h3 className="font-bold text-red-600 flex items-center gap-2 mb-1">
                            <AlertCircle size={20}/> Wymagane Działanie ({unpaidOrders.length})
                        </h3>
                        <p className="text-sm text-slate-600">
                            Masz nieopłacone faktury na łączną kwotę <strong>{formatCurrency(unpaidOrders.reduce((acc, o) => acc + o.totalValue, 0))}</strong>.
                            <br/>Vouchery z tych zamówień są w statusie "Rezerwacja" (Trust Model).
                        </p>
                    </div>
                    {/* Just scroll to list or highlight them */}
                </div>
            )}

            {/* 3. History List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <History size={18} className="text-slate-500"/> Historia Operacji
                    </h3>
                </div>
                <HROrderList 
                    orders={orders}
                    onViewProforma={onViewDocument}
                    onViewEvidence={onViewEvidence}
                    onDistributeSingle={onDistributeSingle}
                    onDistributeBulk={onDistributeBulk}
                />
            </div>
        </div>
    );

    // --- RENDER: CREATE ORDER VIEW (Focus Mode) ---
    const renderCreateOrder = () => (
        <div className="animate-in slide-in-from-bottom-4 duration-300">
            {/* Navigation Back */}
            <button 
                onClick={() => setViewMode('DASHBOARD')}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-6 transition-colors group"
            >
                <div className="p-1 bg-white border border-slate-200 rounded-lg group-hover:border-slate-300 shadow-sm">
                    <ChevronLeft size={16}/>
                </div>
                Wróć do Pulpitu
            </button>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Wallet size={24} className="text-indigo-600"/> Kreator Nowego Zasilenia
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Określ budżet lub wgraj listę płac, aby wygenerować dokumenty.</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                        <span>1. Kwota</span>
                        <ArrowRight size={12}/>
                        <span>2. Podgląd</span>
                        <ArrowRight size={12}/>
                        <span>3. Zatwierdzenie</span>
                    </div>
                </div>

                <div className="p-0">
                    <HROrderCreator 
                        orderAmount={amount}
                        onOrderAmountChange={setAmount}
                        onSubmit={handleCreateOrder}
                        isPayrollCalculating={false} 
                        onSimulatePayroll={() => setIsPayrollModalOpen(true)}
                        successFeePercentage={0.20}
                        onExportTemplate={() => onExportTemplate(employees)}
                        distributionPlan={plan}
                        onClearDistributionPlan={() => { setPlan(undefined); setAmount(100); }}
                        company={company}
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-12">
            {viewMode === 'DASHBOARD' && renderDashboard()}
            {viewMode === 'CREATE_ORDER' && renderCreateOrder()}

            {/* Modals */}
            <PayrollModal 
                isOpen={isPayrollModalOpen}
                onClose={() => setIsPayrollModalOpen(false)}
                onApplyToOrder={handlePayrollApply}
                onParseAndMatch={onParsePayroll}
                employees={employees}
            />
        </div>
    );
};
