
import React from 'react';
import { User } from '../../../types';
import { Wifi, ShieldCheck } from 'lucide-react';

interface WalletCardProps {
  user: User;
  onFlip?: () => void;
}

export const WalletCard: React.FC<WalletCardProps> = ({ user }) => {
  return (
    <div className="relative w-full aspect-[1.586/1] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden transform transition hover:scale-[1.02] duration-300">
        {/* Abstract Background Art */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
        
        {/* Card Content */}
        <div className="relative z-10 p-6 flex flex-col justify-between h-full text-white">
            
            {/* Top Row */}
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Stratton Prime</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                        <ShieldCheck size={10} /> Verified Employee
                    </p>
                </div>
                <Wifi size={24} className="opacity-50 rotate-90" />
            </div>

            {/* Middle (Chip) */}
            <div className="flex items-center gap-4">
                <div className="w-10 h-8 bg-gradient-to-tr from-amber-200 to-amber-400 rounded-md border border-amber-500/50 shadow-sm opacity-90 relative overflow-hidden">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-amber-600/40"></div>
                    <div className="absolute left-1/2 top-0 h-full w-[1px] bg-amber-600/40"></div>
                </div>
                <div className="text-2xl tracking-widest font-mono opacity-80 text-shadow">
                    •••• •••• •••• {user.id.slice(-4)}
                </div>
            </div>

            {/* Bottom Row */}
            <div className="flex justify-between items-end">
                <div>
                    <p className="text-[9px] uppercase text-slate-400 tracking-wider mb-0.5">Dostępne Środki</p>
                    <p className="text-3xl font-bold tracking-tight text-emerald-400 drop-shadow-md">
                        {user.voucherBalance} <span className="text-sm font-normal text-white/60">PKT</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[8px] uppercase text-slate-500">Właściciel</p>
                    <p className="font-medium text-sm tracking-wide">{user.name}</p>
                </div>
            </div>
        </div>
    </div>
  );
};
