
import React from 'react';
import { X, User, Users, ArrowRight, FileSpreadsheet, Send } from 'lucide-react';

interface DistributionChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseSingle: () => void;
  onChooseBulk: () => void;
}

export const DistributionChoiceModal: React.FC<DistributionChoiceModalProps> = ({ 
  isOpen, onClose, onChooseSingle, onChooseBulk 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Send size={20} className="text-indigo-600"/>
                        Wybierz metodę dystrybucji
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Jak chcesz przekazać środki pracownikom?
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition">
                    <X size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="p-6 grid grid-cols-1 gap-4">
                
                {/* Option 1: Single */}
                <button 
                    onClick={() => { onClose(); onChooseSingle(); }}
                    className="group bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-xl p-5 flex items-center gap-5 transition-all text-left hover:shadow-lg relative overflow-hidden"
                >
                    <div className="bg-emerald-50 w-14 h-14 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shrink-0">
                        <User size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 group-hover:text-emerald-700">Pojedynczy Pracownik</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Wybierz osobę z listy i określ kwotę. Idealne dla nagród indywidualnych lub korekt.
                        </p>
                    </div>
                    <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </button>

                {/* Option 2: Bulk */}
                <button 
                    onClick={() => { onClose(); onChooseBulk(); }}
                    className="group bg-white border-2 border-slate-100 hover:border-indigo-500 rounded-xl p-5 flex items-center gap-5 transition-all text-left hover:shadow-lg relative overflow-hidden"
                >
                    <div className="bg-indigo-50 w-14 h-14 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform shrink-0">
                        <Users size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 group-hover:text-indigo-700">Masowo (Lista Płac)</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Pobierz szablon Excel, uzupełnij kwoty dla wielu osób i wgraj go z powrotem.
                        </p>
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-medium">
                            <FileSpreadsheet size={10} /> Automatyczny Protokół
                        </div>
                    </div>
                    <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700">
                    Anuluj
                </button>
            </div>
        </div>
    </div>
  );
};
