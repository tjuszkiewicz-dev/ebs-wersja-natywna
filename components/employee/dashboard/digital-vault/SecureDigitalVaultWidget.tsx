import React, { useState } from 'react';
import { HardDrive, Shield, Lock, ArrowRight, ShoppingCart, Cloud } from 'lucide-react';

interface Props {
  hasAccess?: boolean;
  onPurchase?: () => void;
  price?: number;
  onOpen?: () => void;
}

export const SecureDigitalVaultWidget: React.FC<Props> = ({ hasAccess = false, onPurchase, price = 50, onOpen }) => {

  const handleClick = () => {
    if (hasAccess && onOpen) {
      onOpen();
    } else if (onPurchase) {
      onPurchase();
    }
  };

  return (
    <>
      <div 
        onClick={handleClick}
        className={`relative overflow-hidden rounded-xl cursor-pointer group transition-all duration-300 hover:shadow-lg col-span-1 h-full min-h-[180px] border ${
            hasAccess 
              ? 'border-indigo-700/50 text-white' 
              : 'bg-white border-dashed border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
        }`}
      >
        {hasAccess ? (
          <>
            {/* Background Image & Overlay */}
             <div className="absolute inset-0 bg-cover bg-center transform group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=1000)' }}></div>
             <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-[2px] group-hover:bg-indigo-950/70 transition-colors"></div>

            <div className="relative p-5 h-full flex flex-col justify-between z-10">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase animate-pulse">
                    Encrypted Storage
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors flex items-center gap-2 leading-tight">
                  <Shield className="w-4 h-4" />
                  Secure Digital Vault
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed max-w-[90%]">
                   Prywatny, szyfrowany sejf na Twoje pliki. 10GB przestrzeni z gwarancją bezpieczeństwa.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-1">
                   <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xs text-white shadow-sm z-20">
                      <Cloud size={12} />
                   </div>
                   <div className="w-7 h-7 rounded-full bg-indigo-900/50 border-2 border-slate-700 flex items-center justify-center text-xs text-indigo-400 shadow-sm z-10">
                      <Lock size={12} />
                   </div>
                </div>
                
                <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-indigo-500 group-hover:text-white flex items-center justify-center transition-all duration-300 shadow-lg border border-white/10 group-hover:border-indigo-400 transform group-hover:translate-x-1">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="relative p-5 h-full flex flex-col justify-between z-10 w-full">
             <div className="flex items-start gap-3">
                 <div className="p-3 bg-indigo-50 rounded-xl text-indigo-500 group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
                     <HardDrive className="w-6 h-6"/>
                 </div>
                 <div>
                     <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2 leading-tight">
                        Digital Vault
                        <Lock className="w-3 h-3 text-slate-400" />
                     </h3>
                     <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                        Bezpieczny sejf 10GB. Szyfrowanie AES-256.
                     </p>
                 </div>
             </div>
             
             <div className="flex items-end justify-between w-full mt-4">
                 <div className="">
                    <span className="block text-xl font-bold text-slate-800">{price} <span className="text-xs font-normal text-slate-400">pkt</span></span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">/ msc</span>
                 </div>
                 <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl group-active:scale-95">
                    <ShoppingCart className="w-3 h-3" />
                    Wybierz
                 </button>
             </div>
          </div>
        )}
      </div>
    </>
  );
};
