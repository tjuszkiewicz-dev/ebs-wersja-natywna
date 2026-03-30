
import React from 'react';
import { Send, Plus, ChevronRight, Users, CreditCard, HelpCircle } from 'lucide-react';

interface HRShortcutsProps {
  onOpenDistribution: () => void;
  onNavigateToOrders: () => void;
}

export const HRShortcuts: React.FC<HRShortcutsProps> = ({ onOpenDistribution, onNavigateToOrders }) => {
  return (
    <div className="mt-8">
       <h3 className="text-lg font-bold text-slate-700 mb-4 px-1 flex items-center gap-2">
           <span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">!</span> 
           Co chcesz teraz zrobić?
       </h3>
       
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action 1: Distribute */}
          <button 
            onClick={onOpenDistribution}
            className="bg-white p-8 rounded-2xl shadow-md border-2 border-transparent hover:border-emerald-500 hover:shadow-xl transition-all group text-left flex items-center gap-6 relative overflow-hidden"
          >
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              
              <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm relative z-10">
                  <Send size={32} />
              </div>
              
              <div className="flex-1 relative z-10">
                  <h3 className="font-bold text-slate-800 text-xl group-hover:text-emerald-700 mb-1">Przekaż Vouchery</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                      Wyślij środki pracownikom.<br/>Pojedynczo lub dla całej grupy.
                  </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-full group-hover:bg-emerald-100 group-hover:text-emerald-700 transition">
                <ChevronRight size={24} className="text-slate-400 group-hover:text-emerald-600" />
              </div>
          </button>

          {/* Action 2: Top Up */}
          <button 
            onClick={onNavigateToOrders}
            className="bg-white p-8 rounded-2xl shadow-md border-2 border-transparent hover:border-blue-500 hover:shadow-xl transition-all group text-left flex items-center gap-6 relative overflow-hidden"
          >
              <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>

              <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm relative z-10">
                  <Plus size={32} />
              </div>
              
              <div className="flex-1 relative z-10">
                  <h3 className="font-bold text-slate-800 text-xl group-hover:text-blue-700 mb-1">Doładuj Konto</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                      Zamów więcej voucherów.<br/>Opłać fakturę lub wgraj listę płac.
                  </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-full group-hover:bg-blue-100 group-hover:text-blue-700 transition">
                <ChevronRight size={24} className="text-slate-400 group-hover:text-blue-600" />
              </div>
          </button>
       </div>

       {/* Helper Footer */}
       <div className="mt-6 bg-slate-100 p-4 rounded-xl flex items-start gap-3 border border-slate-200">
            <HelpCircle size={24} className="text-slate-400 shrink-0 mt-0.5" />
            <div>
                <p className="font-bold text-slate-700 text-sm">Potrzebujesz innej opcji?</p>
                <p className="text-slate-500 text-sm mt-1">
                    Skorzystaj z menu na górze ekranu, aby przejść do <strong>Listy Pracowników</strong> lub <strong>Historii Zamówień</strong>.
                </p>
            </div>
       </div>
    </div>
  );
};
