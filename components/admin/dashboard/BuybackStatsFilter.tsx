
import React from 'react';
import { BuybackAgreement, Company } from '../../../types';
import { Building2, CheckCircle, Clock, CreditCard, Filter } from 'lucide-react';

interface BuybackStatsFilterProps {
  currentFilter: 'ALL' | 'PENDING' | 'APPROVED' | 'PAID';
  onFilterChange: (status: 'ALL' | 'PENDING' | 'APPROVED' | 'PAID') => void;
  selectedCompanyId: string;
  onCompanyChange: (id: string) => void;
  companies: Company[];
  filteredData: BuybackAgreement[]; // Data AFTER filtering
  allBuybacks?: BuybackAgreement[]; // Add all data to calc pending counts
}

export const BuybackStatsFilter: React.FC<BuybackStatsFilterProps> = ({
  currentFilter,
  onFilterChange,
  selectedCompanyId,
  onCompanyChange,
  companies,
  filteredData,
  allBuybacks = []
}) => {
  
  // Calculate dynamic stats based on current view
  const totalValue = filteredData.reduce((acc, b) => acc + b.totalValue, 0);
  const count = filteredData.length;

  // Calculate global pending count for the badge
  const pendingCount = allBuybacks.filter(b => b.status === 'PENDING_APPROVAL').length;

  const tabs = [
    { id: 'ALL', label: 'Wszystkie', icon: null, count: null },
    { 
        id: 'PENDING_APPROVAL', 
        label: 'Do Akceptacji', 
        icon: <Clock size={14} className={currentFilter === 'PENDING' ? "text-amber-600" : "text-amber-500"}/>,
        count: pendingCount > 0 ? pendingCount : null
    },
    { id: 'APPROVED', label: 'Zatwierdzone', icon: <CheckCircle size={14} className="text-emerald-500"/>, count: null },
    { id: 'PAID', label: 'Opłacone', icon: <CreditCard size={14} className="text-blue-500"/>, count: null },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
        {/* Top Row: Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Status Tabs */}
            <div className="flex bg-slate-100/80 p-1 rounded-lg overflow-x-auto w-full md:w-auto no-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onFilterChange(tab.id === 'PENDING_APPROVAL' ? 'PENDING' : tab.id as any)}
                        className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap relative ${
                            currentFilter === (tab.id === 'PENDING_APPROVAL' ? 'PENDING' : tab.id)
                            ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.count !== null && (
                            <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Company Select */}
            <div className="relative w-full md:w-64 group">
                <Building2 size={16} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <select 
                    value={selectedCompanyId}
                    onChange={(e) => onCompanyChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                >
                    <option value="ALL">Wszystkie Firmy</option>
                    {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none">
                    <Filter size={12} className="text-slate-300" />
                </div>
            </div>
        </div>

        {/* Bottom Row: Dynamic Summary */}
        <div className="px-6 py-3 bg-slate-50 flex justify-between items-center text-xs">
            <div className="text-slate-500">
                Wyświetlono: <strong>{count}</strong> umów
            </div>
            <div className="flex items-center gap-2">
                <span className="text-slate-400 uppercase font-bold tracking-wider">Suma w widoku:</span>
                <span className="text-lg font-bold text-slate-800">{totalValue.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</span>
            </div>
        </div>
    </div>
  );
};
