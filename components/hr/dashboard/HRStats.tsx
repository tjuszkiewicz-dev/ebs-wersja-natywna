
import React from 'react';
import { Wallet, Users, Lock, HelpCircle, Clock } from 'lucide-react';

interface HRStatsProps {
  activePool: number;
  reservedPool: number;
  distributedPool: number; 
  activeEmployeesCount: number;
  totalEmployeesCount: number;
  variant?: 'HORIZONTAL' | 'VERTICAL';
}

export const HRStats: React.FC<HRStatsProps> = ({ 
    activePool, reservedPool, distributedPool, activeEmployeesCount, totalEmployeesCount, variant = 'HORIZONTAL' 
}) => {
  
  // Mobile: Use flex row with scroll. Desktop: Use Grid.
  // We use `grid-cols-1` for vertical stack variant on desktop sidebar.
  
  const containerClass = variant === 'VERTICAL'
    ? 'flex flex-col gap-4'
    : 'flex overflow-x-auto pb-4 gap-4 md:grid md:grid-cols-3 md:pb-0 snap-x no-scrollbar -mx-4 px-4 md:mx-0 md:px-0';

  const cardClass = `flex-shrink-0 w-[85%] md:w-auto snap-center bg-white px-5 py-5 rounded-2xl border-l-4 md:border-l-8 shadow-sm flex flex-col justify-between relative overflow-visible group transition-all h-36 md:h-40`;

  const totalGenerated = activePool + reservedPool + distributedPool;
  const usagePercentage = totalGenerated > 0 ? (distributedPool / totalGenerated) * 100 : 0;

  return (
    <div className={containerClass}>
      {/* Karta 1: Środki DOSTĘPNE (Active) */}
      <div className={`${cardClass} border-emerald-500`}>
          <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
             <Wallet size={64} className="text-emerald-600 transform group-hover:scale-110 transition-transform" />
          </div>
          
          <div className="absolute top-3 right-3 z-20 md:hidden">
             {/* No tooltip on mobile, just icon for decoration or tap logic if needed */}
          </div>

          <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">DOSTĘPNE ŚRODKI</p>
              <p className="text-3xl font-bold text-slate-900">{activePool} <span className="text-sm font-normal text-slate-500">pkt</span></p>
          </div>
          
          <div className="mt-auto pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                  <span>Rozdano: <strong>{distributedPool}</strong></span>
                  <span>{usagePercentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${usagePercentage}%` }}></div>
              </div>
          </div>
      </div>

      {/* Karta 2: Środki Zaufane (Rezerwacja) */}
      <div className={`${cardClass} border-indigo-500`}>
          <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
             <Lock size={64} className="text-indigo-600 transform group-hover:scale-110 transition-transform" />
          </div>

          <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PULA ZAUFANA (TRUST)</p>
              <p className="text-3xl font-bold text-slate-900">{reservedPool} <span className="text-sm font-normal text-slate-500">pkt</span></p>
          </div>
          
          <div className="mt-auto pt-3 border-t border-slate-100">
              <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded w-fit">
                  <Clock size={10}/> Płatność: 7 dni
              </p>
          </div>
      </div>

      {/* Karta 3: Pracownicy */}
      <div className={`${cardClass} border-slate-400`}>
          <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
             <Users size={64} className="text-slate-600 transform group-hover:scale-110 transition-transform" />
          </div>

          <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PRACOWNICY</p>
              <p className="text-3xl font-bold text-slate-900">{activeEmployeesCount} <span className="text-sm text-slate-500 font-normal">/ {totalEmployeesCount}</span></p>
          </div>
          
          <div className="mt-auto pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-600 font-medium">Aktywne konta w systemie</p>
          </div>
      </div>
    </div>
  );
};
