
import React, { useMemo, useState } from 'react';
import { Company, User, Order, Voucher, OrderStatus, VoucherStatus } from '../../../types';
import { CheckCircle2, AlertTriangle, CalendarClock, Wallet, Users, HelpCircle, Info, Send, FileText, Plus } from 'lucide-react';
import { ProcessStep } from './HRProcessTimeline';
import { HRStats } from './HRStats';
import { HRActionBar } from './HRActionBar';

interface Props {
    company: Company;
    employees: User[];
    orders: Order[];
    vouchers: Voucher[];
    period: string;
    onNavigateToSettlement: () => void;
    onNavigateToEmployees: () => void;
    workflowStep?: ProcessStep;
    onOpenDistributionChoice: () => void;
    onOpenSingleDist: () => void;
    onOpenBulkDist: () => void;
}

export const HRCommandCenter: React.FC<Props> = ({ 
    company, employees, orders, vouchers, period, onNavigateToSettlement, onNavigateToEmployees, workflowStep,
    onOpenDistributionChoice, onOpenSingleDist, onOpenBulkDist
}) => {
    
    // --- STATISTICS ---
    const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;
    
    const realActive = useMemo(() => 
        vouchers.filter(v => v.companyId === company.id && v.status === VoucherStatus.ACTIVE).length
    , [vouchers, company.id]);

    const realReserved = useMemo(() => 
        vouchers.filter(v => v.companyId === company.id && v.status === VoucherStatus.RESERVED).length
    , [vouchers, company.id]);

    const realDistributed = useMemo(() => 
        vouchers.filter(v => v.companyId === company.id && (v.status === VoucherStatus.DISTRIBUTED || v.status === VoucherStatus.CONSUMED)).length
    , [vouchers, company.id]);

    const handleNavigate = (tab: string) => {
        if (tab === 'EMPLOYEES') onNavigateToEmployees();
        if (tab === 'SETTLEMENTS') onNavigateToSettlement();
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Dzień dobry';
        if (hour < 18) return 'Dzień dobry';
        return 'Dobry wieczór';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 pb-12">
            
            {/* --- LEFT COLUMN (MAIN CONTENT) - 66% width --- */}
            <div className="lg:col-span-2 space-y-6 md:space-y-8">
                
                {/* 1. WELCOME HEADER - Optimized for mobile */}
                <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-lg md:text-2xl font-bold text-slate-800">
                            {getGreeting()}, {company.name.split(' ')[0]}
                        </h2>
                        <p className="text-slate-500 text-xs md:text-sm mt-0.5">
                            Status operacyjny na dziś.
                        </p>
                    </div>
                    <div className="text-right hidden md:block">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Dzisiejsza Data</span>
                        <span className="text-lg font-mono font-bold text-slate-700">
                            {new Date().toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>

                {/* 2. STATS (Moved here for mobile visibility) */}
                <div className="lg:hidden">
                    <HRStats 
                        activePool={realActive} 
                        reservedPool={realReserved} 
                        distributedPool={realDistributed} 
                        activeEmployeesCount={activeEmployees}
                        totalEmployeesCount={employees.length}
                        variant="HORIZONTAL"
                    />
                </div>

                {/* 3. ACTION BAR (MAIN PRIORITY) */}
                {workflowStep && (
                    <HRActionBar 
                        step={workflowStep}
                        onNavigate={handleNavigate}
                        employeesCount={employees.length} 
                        onAction={(type) => {
                            if (type === 'DISTRIBUTE_CHOICE') onOpenDistributionChoice();
                            if (type === 'DISTRIBUTE_SINGLE') onOpenSingleDist();
                            if (type === 'DISTRIBUTE_BULK') onOpenBulkDist();
                        }}
                    />
                )}

                {/* 4. QUICK SHORTCUTS */}
                <div>
                    <h3 className="text-sm md:text-lg font-bold text-slate-700 mb-3 md:mb-4 flex items-center gap-2">
                        <Wallet size={18} className="text-slate-400"/> Szybkie Operacje
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        
                        <button 
                            onClick={onNavigateToSettlement}
                            className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm active:bg-slate-50 hover:border-indigo-400 hover:shadow-md transition-all group text-left flex flex-row md:flex-col items-center md:items-start gap-4 h-auto md:h-32"
                        >
                            <div className="bg-indigo-50 w-10 h-10 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform shrink-0">
                                <Plus size={20} />
                            </div>
                            <div>
                                <span className="font-bold text-slate-800 block text-sm md:text-base group-hover:text-indigo-700">Nowe Zamówienie</span>
                                <span className="text-xs text-slate-500">Zasil budżet firmy</span>
                            </div>
                        </button>

                        <button 
                            onClick={onOpenDistributionChoice} 
                            className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm active:bg-slate-50 hover:border-emerald-400 hover:shadow-md transition-all group text-left flex flex-row md:flex-col items-center md:items-start gap-4 h-auto md:h-32"
                        >
                            <div className="bg-emerald-50 w-10 h-10 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shrink-0">
                                <Send size={20} />
                            </div>
                            <div>
                                <span className="font-bold text-slate-800 block text-sm md:text-base group-hover:text-emerald-700">Przekaż Vouchery</span>
                                <span className="text-xs text-slate-500">Pojedynczo lub Masowo</span>
                            </div>
                        </button>

                        <button 
                            onClick={onNavigateToEmployees}
                            className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm active:bg-slate-50 hover:border-blue-400 hover:shadow-md transition-all group text-left flex flex-row md:flex-col items-center md:items-start gap-4 h-auto md:h-32"
                        >
                            <div className="bg-blue-50 w-10 h-10 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shrink-0">
                                <Users size={20} />
                            </div>
                            <div>
                                <span className="font-bold text-slate-800 block text-sm md:text-base group-hover:text-blue-700">Kartoteki</span>
                                <span className="text-xs text-slate-500">Dodaj lub edytuj osoby</span>
                            </div>
                        </button>

                    </div>
                </div>
            </div>

            {/* --- RIGHT COLUMN (SIDEBAR / TOOLS) - 33% width --- */}
            <div className="hidden lg:block space-y-6">
                
                {/* 1. KEY STATS (Vertical Stack - Desktop Only) */}
                <HRStats 
                    activePool={realActive} 
                    reservedPool={realReserved} 
                    distributedPool={realDistributed} 
                    activeEmployeesCount={activeEmployees}
                    totalEmployeesCount={employees.length}
                    variant="VERTICAL"
                />

                {/* 2. HELP */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
                        <HelpCircle size={16} className="text-slate-400"/> Wsparcie
                    </h3>
                    <div className="text-xs text-slate-500 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span>Opiekun:</span>
                            <span className="font-bold text-slate-700">Marek Manager</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span>Telefon:</span>
                            <span className="font-mono text-slate-700 font-bold">+48 500 600 700</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Email:</span>
                            <span className="text-indigo-600 font-medium">marek@stratton.pl</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
