
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Clock, AlertCircle, ArrowRight, Calendar, Banknote, CheckCircle2 } from 'lucide-react';
import { Order, OrderStatus } from '../../../types';

interface HRFinanceStatsProps {
  orders: Order[];
  onNavigateToUnpaid: () => void;
}

export const HRFinanceStats: React.FC<HRFinanceStatsProps> = ({ orders, onNavigateToUnpaid }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Previous month logic handles year rollover (e.g. Jan -> Dec previous year)
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    // 1. Costs Calculation (Current vs Previous Month)
    const thisMonthOrders = orders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && o.status !== OrderStatus.REJECTED;
    });

    const prevMonthOrders = orders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear && o.status !== OrderStatus.REJECTED;
    });

    const spentThisMonth = thisMonthOrders.filter(o => o.status === OrderStatus.PAID).reduce((acc, o) => acc + o.totalValue, 0);
    const spentPrevMonth = prevMonthOrders.filter(o => o.status === OrderStatus.PAID).reduce((acc, o) => acc + o.totalValue, 0);

    // Trend Calculation
    let trendPercent = 0;
    if (spentPrevMonth > 0) {
        trendPercent = ((spentThisMonth - spentPrevMonth) / spentPrevMonth) * 100;
    } else if (spentThisMonth > 0) {
        trendPercent = 100; // 100% increase if previous was 0
    }

    // 2. Liabilities (Unpaid)
    const unpaidOrders = orders.filter(o => o.status === OrderStatus.APPROVED);
    const unpaidAmount = unpaidOrders.reduce((acc, o) => acc + o.totalValue, 0);
    
    // 3. Due Dates Logic
    let overdueCount = 0;
    let nextDueDate: Date | null = null;

    unpaidOrders.forEach(o => {
        const dueDate = new Date(new Date(o.date).getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
        
        if (dueDate < now) {
            overdueCount++;
        } else {
            // Find the soonest upcoming due date
            if (!nextDueDate || dueDate < nextDueDate) {
                nextDueDate = dueDate;
            }
        }
    });

    return { 
        spentThisMonth, 
        spentPrevMonth,
        trendPercent,
        unpaidCount: unpaidOrders.length, 
        unpaidAmount, 
        overdueCount,
        nextDueDate
    };
  }, [orders]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* KPI 1: Faktury do zapłaty (Actionable) */}
        <div 
            className={`p-5 rounded-xl border shadow-sm flex flex-col justify-between transition-all cursor-pointer group relative overflow-hidden h-36 ${stats.unpaidCount > 0 ? 'bg-white border-indigo-200 hover:border-indigo-300 shadow-indigo-100' : 'bg-slate-50 border-slate-200'}`} 
            onClick={stats.unpaidCount > 0 ? onNavigateToUnpaid : undefined}
        >
            {stats.unpaidCount > 0 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
            
            <div className="flex justify-between items-start">
                <div>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${stats.unpaidCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                        Do zapłaty (Zobowiązania)
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{stats.unpaidAmount.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        <span className="text-xs text-slate-500 font-medium">PLN</span>
                    </div>
                </div>
                <div className={`${stats.unpaidCount > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'} p-2 rounded-lg transition-colors`}>
                    <Banknote size={20} />
                </div>
            </div>

            <div className="mt-auto pt-2">
                {stats.unpaidCount > 0 ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg w-fit group-hover:bg-indigo-100 transition-colors">
                        <span>{stats.unpaidCount} {stats.unpaidCount === 1 ? 'faktura' : 'faktury'} do opłacenia</span>
                        <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform"/>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400">Brak nieopłaconych faktur.</p>
                )}
            </div>
        </div>

        {/* KPI 2: Termin Płatności (Urgency - Real Status) */}
        <div className={`p-5 rounded-xl border shadow-sm flex flex-col justify-between h-36 ${stats.overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${stats.overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        Status Terminów
                    </p>
                    {stats.overdueCount > 0 ? (
                        <span className="text-xl font-bold text-red-700 block">Wymagana Uwaga!</span>
                    ) : stats.nextDueDate ? (
                        <span className="text-xl font-bold text-slate-800 block">
                            {stats.nextDueDate.toLocaleDateString('pl-PL')}
                        </span>
                    ) : (
                        <span className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                            Brak Zobowiązań
                        </span>
                    )}
                </div>
                <div className={`${stats.overdueCount > 0 ? 'bg-red-100 text-red-600' : stats.nextDueDate ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'} p-2 rounded-lg`}>
                    {stats.overdueCount > 0 ? <AlertCircle size={20} /> : stats.nextDueDate ? <Clock size={20} /> : <CheckCircle2 size={20}/>}
                </div>
            </div>
            
            <div className="mt-auto">
                {stats.overdueCount > 0 ? (
                    <p className="text-xs text-red-700 font-bold bg-red-100 px-2 py-1 rounded inline-block">
                        {stats.overdueCount} {stats.overdueCount === 1 ? 'płatność przeterminowana' : 'płatności przeterminowane'}
                    </p>
                ) : stats.nextDueDate ? (
                    <p className="text-xs text-slate-500">
                        Najbliższy termin płatności faktury.
                    </p>
                ) : (
                    <p className="text-xs text-emerald-700 font-medium">
                        Wszystkie faktury zostały opłacone w terminie.
                    </p>
                )}
            </div>
        </div>

        {/* KPI 3: Cashflow (Historical with Trend) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-36">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Koszty w tym miesiącu</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{stats.spentThisMonth.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        <span className="text-xs text-slate-500 font-medium">PLN</span>
                    </div>
                </div>
                <div className={`p-2 rounded-lg ${stats.trendPercent > 0 ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <TrendingUp size={20} />
                </div>
            </div>
            
            <div className="mt-auto">
                <div className="flex items-center gap-2 mb-2">
                    {stats.trendPercent !== 0 ? (
                        <span className={`text-xs font-bold flex items-center gap-1 ${stats.trendPercent > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {stats.trendPercent > 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                            {Math.abs(stats.trendPercent).toFixed(1)}%
                        </span>
                    ) : (
                        <span className="text-xs font-bold text-slate-400">- 0%</span>
                    )}
                    <span className="text-[10px] text-slate-400 uppercase">vs poprzedni msc</span>
                </div>
                
                {/* Visual Bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                     {/* Simplified bar: if spent this month > prev, fill full, else proportional */}
                     <div 
                        className={`h-full transition-all duration-500 ${stats.trendPercent > 0 ? 'bg-blue-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${stats.spentPrevMonth > 0 ? Math.min((stats.spentThisMonth / stats.spentPrevMonth) * 100, 100) : 100}%` }}
                     ></div>
                </div>
            </div>
        </div>
    </div>
  );
};
