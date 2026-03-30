import React from 'react';
import { 
    Calculator, ArrowLeft, Info, Calendar, Percent, Coins, 
    ArrowRight, History, Shield, Zap, InfoIcon
} from 'lucide-react';
import { ViewMode } from './types';

interface CalculatorsViewProps {
    activeCalc: 'INTEREST' | 'COURT_FEES' | 'NOTICE_PERIOD' | null;
    setActiveCalc: (calc: 'INTEREST' | 'COURT_FEES' | 'NOTICE_PERIOD' | null) => void;
    calcInputs: Record<string, string>;
    setCalcInputs: (inputs: Record<string, string>) => void;
    calcResult: string | null;
    setCalcResult: (result: string | null) => void;
    setView: (view: ViewMode) => void;
}

export const CalculatorsView: React.FC<CalculatorsViewProps> = ({
    activeCalc,
    setActiveCalc,
    calcInputs,
    setCalcInputs,
    calcResult,
    setCalcResult,
    setView
}) => {
    // Basic calculator logic (static for now, just to show how it works)
    const calculateInterest = () => {
        const amount = parseFloat(calcInputs.amount || '0');
        const days = parseInt(calcInputs.days || '0');
        const rate = 0.1125; // Ustawowe odsetki za opóźnienie
        const result = (amount * days * rate) / 365;
        setCalcResult(`Należne odsetki ustawowe: ${result.toFixed(2)} PLN`);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center gap-6 mb-4">
                <button 
                    onClick={() => setView('DASHBOARD')}
                    className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm active:scale-95 group"
                >
                    <ArrowLeft size={22} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                </button>
                <div>
                    <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Kalkulatory Prawne</h3>
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Szybkie obliczenia terminów i kosztów</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { id: 'INTEREST', title: 'Odsetki Ustawowe', icon: <Percent size={24} />, desc: 'Oblicz odsetki za opóźnienie' },
                    { id: 'COURT_FEES', title: 'Koszty Sądowe', icon: <Coins size={24} />, desc: 'Opłaty od pozwu i wniosku' },
                    { id: 'NOTICE_PERIOD', title: 'Okres Wypowiedzenia', icon: <Calendar size={24} />, desc: 'Sprawdź termin odejścia' }
                ].map((c) => (
                    <button 
                        key={c.id}
                        onClick={() => {
                            setActiveCalc(c.id as any);
                            setCalcResult(null);
                            setCalcInputs({});
                        }}
                        className={`group p-8 text-left rounded-3xl border transition-all duration-300 ${activeCalc === c.id ? 'border-blue-500 bg-blue-50 shadow-xl shadow-blue-100 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-lg'}`}
                    >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all shadow-inner group-hover:rotate-6 ${activeCalc === c.id ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                            {c.icon}
                        </div>
                        <h4 className="font-bold text-xl text-slate-900 group-hover:text-blue-700 transition-colors">{c.title}</h4>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed group-hover:text-slate-600 transition-colors mb-4">{c.desc}</p>
                    </button>
                ))}
            </div>

            {activeCalc && (
                <div className="bg-white border border-slate-200 rounded-[32px] p-10 shadow-2xl shadow-blue-900/10 animate-in zoom-in-95 duration-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-blue-100 transition-colors duration-1000"></div>
                    
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            <h4 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                {activeCalc === 'INTEREST' ? 'Oblicz Odsetki' : activeCalc === 'COURT_FEES' ? 'Oblicz Koszty' : 'Oblicz Terminal'}
                                <div className="h-1 flex-1 bg-slate-100 rounded-full"></div>
                            </h4>
                            
                            <div className="space-y-6">
                                {activeCalc === 'INTEREST' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Kwota długu (PLN)</label>
                                            <input 
                                                type="number" 
                                                value={calcInputs.amount || ''}
                                                onChange={(e) => setCalcInputs({...calcInputs, amount: e.target.value})}
                                                placeholder="1000.00"
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-bold text-slate-800 text-lg"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Liczba dni opóźnienia</label>
                                            <input 
                                                type="number" 
                                                value={calcInputs.days || ''}
                                                onChange={(e) => setCalcInputs({...calcInputs, days: e.target.value})}
                                                placeholder="30"
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-bold text-slate-800 text-lg"
                                            />
                                        </div>
                                        <button 
                                            onClick={calculateInterest}
                                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg group/calc"
                                        >
                                            <Calculator size={24} className="group-hover/calc:rotate-12 transition-transform" />
                                            Oblicz Teraz
                                        </button>
                                    </>
                                )}
                                {activeCalc !== 'INTEREST' && (
                                    <div className="p-10 rounded-3xl bg-slate-50 border border-dashed border-slate-200 text-center opacity-60">
                                        <InfoIcon size={32} className="mx-auto text-slate-300 mb-4" />
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Kalkulator w przygotowaniu</p>
                                        <p className="text-xs text-slate-400 mt-2 font-medium">Będzie dostępny w kolejnej aktualizacji AI Prawnika</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1 mb-8">Wynik obliczeń</h4>
                            <div className={`flex-1 flex flex-col items-center justify-center p-8 rounded-[40px] border-2 border-dashed transition-all duration-700 ${calcResult ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                {calcResult ? (
                                    <div className="text-center animate-in zoom-in-95 duration-500">
                                        <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-200">
                                            <Coins size={36} />
                                        </div>
                                        <h5 className="text-4xl font-extrabold mb-4">{calcResult.split(': ')[1]}</h5>
                                        <p className="text-emerald-700 font-bold uppercase tracking-widest text-[10px]">{calcResult.split(': ')[0]}</p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Calculator size={64} className="mx-auto mb-6 text-slate-100 opacity-50" />
                                        <p className="font-bold text-slate-200 uppercase tracking-widest text-sm">Czekam na dane...</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-8 p-6 bg-amber-50 rounded-[32px] flex items-center gap-4 text-amber-900 border border-amber-100/50">
                                <div className="p-3 bg-white rounded-xl text-amber-500 shadow-sm shrink-0">
                                    <Info size={24} />
                                </div>
                                <p className="text-xs font-bold leading-relaxed tracking-tight">
                                    Wynik ma charakter orientacyjny i nie stanowi porady prawnej. Zawsze skonsultuj się z prawnikiem w sprawach finansowych.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
