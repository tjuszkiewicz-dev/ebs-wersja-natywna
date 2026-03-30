
import React from 'react';
import { Send, Users, User as UserIcon, ShieldCheck, Wallet, Info } from 'lucide-react';

interface HRDistributionWidgetProps {
  activePool: number;
  reservedPool: number;
  onOpenSingle: () => void;
  onOpenBulk: () => void;
  variant?: 'FULL' | 'COMPACT'; 
}

export const HRDistributionWidget: React.FC<HRDistributionWidgetProps> = ({
  activePool,
  reservedPool,
  onOpenSingle,
  onOpenBulk,
  variant = 'FULL'
}) => {
  const totalAvailable = activePool + reservedPool;

  // If nothing available, show empty or disabled state (Currently returns null to hide)
  if (totalAvailable === 0) return null;

  const isCompact = variant === 'COMPACT';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-2 overflow-visible relative ${isCompact ? 'p-4 md:p-5' : 'p-5 md:p-6'}`}>
        
        {/* Info Icon Top Right */}
        <div className="absolute top-4 right-4 group/info z-10 hidden md:block">
            <Info size={18} className="text-slate-300 hover:text-indigo-600 cursor-help transition-colors"/>
            <div className="absolute right-0 top-6 w-64 bg-slate-900 text-white text-[11px] p-3 rounded-xl shadow-2xl opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed border border-slate-700">
                <p className="font-bold text-indigo-300 mb-1">Jak działa dystrybucja?</p>
                Środki pobierane są najpierw z puli <strong>Dostępnej (Active)</strong>. Jeśli brakuje środków, system automatycznie dobierze je z puli <strong>Zaufanej (Trust)</strong>, a Ty opłacisz je później na podstawie faktury zbiorczej.
            </div>
        </div>

        <div className={`flex justify-between items-start gap-4 mb-4 ${isCompact ? 'flex-col' : 'flex-col md:flex-row md:items-center'}`}>
            <div>
                <h3 className="font-bold text-slate-800 text-base md:text-lg flex items-center gap-2">
                    <Send size={20} className="text-emerald-600"/> Szybkie Przekazywanie
                </h3>
                {!isCompact && (
                    <p className="text-xs md:text-sm text-slate-500">
                        Wybierz metodę zasilenia kont pracowników.
                    </p>
                )}
            </div>
            
            {/* Pool Summary Pills */}
            <div className="flex flex-row md:flex-col items-end gap-2 md:gap-1 text-xs w-full md:w-auto justify-end md:pr-8">
                <div className="flex items-center gap-2 font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded">
                    <Wallet size={14} className="text-emerald-600"/>
                    <span>Dostępne: {activePool}</span>
                </div>
                {reservedPool > 0 && (
                    <div className="flex items-center gap-2 bg-indigo-50 text-indigo-800 px-2 py-1 rounded border border-indigo-100 font-bold">
                        <ShieldCheck size={14}/>
                        <span>Trust: {reservedPool}</span>
                    </div>
                )}
            </div>
        </div>

        <div className={`grid gap-3 ${isCompact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            <button 
                onClick={onOpenSingle}
                className={`group rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center text-left relative overflow-hidden active:scale-[0.98] ${isCompact ? 'p-3 gap-3' : 'p-4 gap-4'}`}
            >
                <div className={`${isCompact ? 'w-10 h-10 text-sm' : 'w-12 h-12'} bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform flex-shrink-0`}>
                    <UserIcon size={isCompact ? 20 : 24}/>
                </div>
                <div>
                    <h4 className="font-bold text-slate-700 group-hover:text-emerald-700 text-sm md:text-base">Jeden Pracownik</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">Wybierz osobę z listy i określ kwotę.</p>
                </div>
            </button>

            <button 
                onClick={onOpenBulk}
                className={`group rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-center text-left relative overflow-hidden active:scale-[0.98] ${isCompact ? 'p-3 gap-3' : 'p-4 gap-4'}`}
            >
                <div className={`${isCompact ? 'w-10 h-10 text-sm' : 'w-12 h-12'} bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform flex-shrink-0`}>
                    <Users size={isCompact ? 20 : 24}/>
                </div>
                <div>
                    <h4 className="font-bold text-slate-700 group-hover:text-indigo-700 text-sm md:text-base">Wielu Pracowników</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">Wgraj plik Excel z listą płac.</p>
                </div>
            </button>
        </div>
    </div>
  );
};
