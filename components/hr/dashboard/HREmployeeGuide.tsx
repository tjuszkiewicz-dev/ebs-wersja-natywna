
import React, { useState } from 'react';
import { X, UserPlus, Building2, Wallet, UserX, ArrowRight, Lightbulb, ChevronDown } from 'lucide-react';

interface HREmployeeGuideProps {
  onClose: () => void;
}

export const HREmployeeGuide: React.FC<HREmployeeGuideProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(false); // Domyślnie zwinięte

  return (
    <div className={`bg-white border border-indigo-100 rounded-2xl mb-6 overflow-hidden transition-all duration-300 shadow-sm ${isOpen ? 'ring-2 ring-indigo-50' : ''}`}>
        
        {/* Clickable Header */}
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="p-4 flex justify-between items-center cursor-pointer bg-gradient-to-r from-indigo-50 to-white hover:from-indigo-100 transition-colors group select-none"
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100'}`}>
                    <Lightbulb size={20} className={isOpen ? "fill-current" : ""} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                        Jak zarządzać kartoteką pracowniczą?
                        {!isOpen && <span className="text-xs font-normal text-slate-500 hidden md:inline">- Kliknij, aby rozwinąć</span>}
                    </h3>
                    {isOpen && (
                        <p className="text-xs text-slate-500 mt-0.5">Cykl życia pracownika w systemie EBS.</p>
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
            <div className="p-6 bg-slate-50/50 border-t border-indigo-50 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                    
                    {/* Step 1 */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm relative group hover:border-indigo-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-200 font-bold text-4xl opacity-20 group-hover:opacity-40 transition-opacity">1</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                                <UserPlus size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Rejestracja</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Dodaj pracownika ręcznie lub zaimportuj listę z Excela (Mass Onboarding). System automatycznie wygeneruje hasła.
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center">
                        <ArrowRight size={24} className="text-indigo-300" />
                    </div>

                    {/* Step 2 */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm relative group hover:border-indigo-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-200 font-bold text-4xl opacity-20 group-hover:opacity-40 transition-opacity">2</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                <Building2 size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Struktura (MPK)</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Przypisz działy i Centra Kosztów (Cost Center). Umożliwi to generowanie precyzyjnych raportów dla księgowości.
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center">
                        <ArrowRight size={24} className="text-indigo-300" />
                    </div>

                    {/* Step 3 */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm relative group hover:border-indigo-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-200 font-bold text-4xl opacity-20 group-hover:opacity-40 transition-opacity">3</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                                <Wallet size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Zasilenia</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Możesz doładować konto pracownika bezpośrednio z listy (przycisk "Zasil") lub użyć kreatora płacowego.
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center">
                        <ArrowRight size={24} className="text-indigo-300" />
                    </div>

                    {/* Step 4 */}
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm relative group hover:border-indigo-300 transition-colors">
                        <div className="absolute top-4 right-4 text-slate-200 font-bold text-4xl opacity-20 group-hover:opacity-40 transition-opacity">4</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                                <UserX size={20} />
                            </div>
                            <span className="font-bold text-sm text-slate-700">Offboarding</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">
                            Zwolniony pracownik? Użyj opcji "Dezaktywuj". Dostęp zostanie zablokowany, ale historia operacji pozostanie w systemie.
                        </p>
                    </div>

                </div>
            </div>
        )}
    </div>
  );
};
