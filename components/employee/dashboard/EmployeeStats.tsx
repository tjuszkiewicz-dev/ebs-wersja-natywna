import React from 'react';
import { Wallet, Clock, AlertCircle } from 'lucide-react';
import { User } from '../../../types';

interface EmployeeStatsProps {
  user: User;
  expiringCount: number;
}

export const EmployeeStats: React.FC<EmployeeStatsProps> = ({ 
  user, 
  expiringCount, 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wallet Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-lg transform transition hover:scale-[1.02]">
          <div className="flex justify-between items-start mb-8">
            <Wallet className="opacity-80" size={32} />
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">Aktywne</span>
          </div>
          <p className="text-sm opacity-80 mb-1">Dostępne Środki</p>
          <h3 className="text-4xl font-bold tracking-tight">{user.voucherBalance} pkt</h3>
          <p className="text-xs mt-4 opacity-60">1 Voucher = 1 PLN</p>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
           <div className="flex justify-between items-start mb-4">
             <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
               <Clock size={24} />
             </div>
           </div>
           <h4 className="text-lg font-bold text-slate-800 mb-1">Wygasają wkrótce</h4>
           <p className="text-3xl font-bold text-slate-700">{expiringCount}</p>
           <p className="text-xs text-slate-400 mt-2">Vouchery ważne tylko 7 dni od otrzymania.</p>
        </div>
      </div>
  );
};