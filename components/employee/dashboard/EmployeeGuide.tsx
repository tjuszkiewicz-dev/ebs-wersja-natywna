
import React, { useState } from 'react';
import { X, Wallet, ShoppingCart, Clock, RefreshCw, ArrowRight, Lightbulb, ChevronDown } from 'lucide-react';

interface EmployeeGuideProps {
  onClose: () => void;
  forceVisible?: boolean;
}

export const EmployeeGuide: React.FC<EmployeeGuideProps> = ({ onClose, forceVisible = false }) => {
  const [isOpen, setIsOpen] = useState(forceVisible); // Domyślnie zwinięte, chyba że forceVisible

  return (
    <div className={`bg-white border border-emerald-100 rounded-2xl mb-6 overflow-hidden transition-all duration-300 shadow-sm ${isOpen ? 'ring-2 ring-emerald-50' : ''}`}>
        
        {/* Clickable Header */}
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="p-4 flex justify-between items-center cursor-pointer bg-gradient-to-r from-emerald-50 to-white hover:from-emerald-100 transition-colors group select-none"
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border border-emerald-100'}`}>
                    <Lightbulb size={20} className={isOpen ? "fill-current" : ""} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                        Jak to działa? (Benefit w 4 krokach)
                        {!isOpen && <span className="text-xs font-normal text-slate-500 hidden md:inline">- Kliknij, aby rozwinąć</span>}
                    </h3>
                    {isOpen && (
                        <p className="text-xs text-slate-500 mt-0.5">Przewodnik po Twoim portfelu.</p>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    className={`p-2 rounded-full text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 bg-slate-100' : ''}`}
                >
                    <ChevronDown size={20} />
                </button>
                {/* Separator */}
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-400 transition"
                    title="Zamknij podpowiedź"
                >
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Expandable Content */}
        {isOpen && (
            <div className="p-6 bg-slate-50/50 border-t border-emerald-50 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                    
                    {/* Step 1 */}
                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative group hover:border-emerald-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-100 font-bold text-4xl opacity-40 group-hover:opacity-60 transition-opacity">1</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                                <Wallet size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Zasilenie</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Twój pracodawca przesyła Ci <strong>Vouchery Prime</strong> (Punkty). Trafiają one natychmiast do Twojego portfela.
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center">
                        <ArrowRight size={24} className="text-emerald-200" />
                    </div>

                    {/* Step 2 */}
                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative group hover:border-emerald-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-100 font-bold text-4xl opacity-40 group-hover:opacity-60 transition-opacity">2</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                <ShoppingCart size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Zakupy</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Wymieniasz punkty na usługi cyfrowe: <strong>Spotify, Audiobooki, Bilety</strong>. Dostęp otrzymujesz od razu.
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center">
                        <ArrowRight size={24} className="text-emerald-200" />
                    </div>

                    {/* Step 3 */}
                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative group hover:border-emerald-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-100 font-bold text-4xl opacity-40 group-hover:opacity-60 transition-opacity">3</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                                <Clock size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Tylko 7 dni!</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Uwaga! Vouchery są ważne tylko <strong>7 dni</strong> od momentu otrzymania. Nie zwlekaj z wyborem benefitu.
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center">
                        <ArrowRight size={24} className="text-emerald-200" />
                    </div>

                    {/* Step 4 */}
                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative group hover:border-emerald-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-100 font-bold text-4xl opacity-40 group-hover:opacity-60 transition-opacity">4</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                <RefreshCw size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Zwrot (Odkup)</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Nie zdążyłeś? System wygeneruje <strong>Umowę Odkupu</strong>, a równowartość punktów trafi na Twoje konto bankowe.
                        </p>
                    </div>

                </div>
            </div>
        )}
    </div>
  );
};
