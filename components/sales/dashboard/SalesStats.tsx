
import React from 'react';
import { DollarSign, Briefcase, TrendingUp, Users } from 'lucide-react';
import { Commission, Company, Order, Role } from '../../../types';

interface SalesStatsProps {
  role: Role;
  commissions: Commission[];
  myCompanies: Company[];
  orders: Order[];
}

export const SalesStats: React.FC<SalesStatsProps> = ({ role, commissions, myCompanies, orders }) => {
  
  // 1. Total Paid Commissions
  const totalEarned = commissions
    .filter(c => c.isPaid)
    .reduce((acc, c) => acc + c.amount, 0);

  // 2. Pending Commissions
  const pendingEarned = commissions
    .filter(c => !c.isPaid)
    .reduce((acc, c) => acc + c.amount, 0);

  // 3. Total Turnover (Sum of Paid Orders for my companies)
  const totalTurnover = orders
    .filter(o => o.status === 'PAID' && myCompanies.some(c => c.id === o.companyId))
    .reduce((acc, o) => acc + o.totalValue, 0);

  // 4. Client Count
  const clientCount = myCompanies.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Total Earnings */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
         <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                 <DollarSign size={20} />
             </div>
             <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Wypłacone</span>
         </div>
         <div>
             <h3 className="text-2xl font-bold text-slate-800">{totalEarned.toFixed(2)} <span className="text-xs font-medium text-slate-500">PLN</span></h3>
             <p className="text-xs text-emerald-600 font-medium mt-1">Zaksięgowane na koncie</p>
         </div>
      </div>

      {/* Card 2: Pending / Turnover */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
         <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                 <TrendingUp size={20} />
             </div>
             <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Obrót Klientów</span>
         </div>
         <div>
             <h3 className="text-2xl font-bold text-slate-800">{totalTurnover.toLocaleString('pl-PL')} <span className="text-xs font-medium text-slate-500">PLN</span></h3>
             <p className="text-xs text-indigo-600 font-medium mt-1">Wartość opłaconych faktur</p>
         </div>
      </div>

      {/* Card 3: Portfolio */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
         <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                 <Briefcase size={20} />
             </div>
             <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Portfel Firm</span>
         </div>
         <div>
             <h3 className="text-2xl font-bold text-slate-800">{clientCount}</h3>
             <p className="text-xs text-slate-500 mt-1">Aktywne umowy w systemie</p>
         </div>
      </div>

      {/* Card 4: Tier / Team (Context dependent) */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-xl text-white shadow-md flex flex-col justify-between">
         <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-white/10 rounded-lg text-white">
                 <Users size={20} />
             </div>
             <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Twój Status</span>
         </div>
         <div>
             <h3 className="text-lg font-bold text-white uppercase tracking-widest">{role}</h3>
             <p className="text-xs text-slate-400 mt-1">
                {role === Role.ADVISOR ? 'Prowizja bezpośrednia' : 'Prowizja + Nadprowizja'}
             </p>
         </div>
      </div>
    </div>
  );
};
