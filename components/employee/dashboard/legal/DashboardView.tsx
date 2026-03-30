import React from 'react';
import { 
    LayoutDashboard, FileSearch, FilePlus, MessageSquare, History, Shield, Info, ArrowRight, Bot, 
    Calculator, ShoppingCart, Briefcase, Zap, Star
} from 'lucide-react';
import { ViewMode, LegalCase } from './types';
import { CaseSummaryCard, PulseIndicator } from './ui';

interface DashboardViewProps {
    userCases: LegalCase[];
    setView: (view: ViewMode) => void;
    setSelectedCase: (caseItem: LegalCase) => void;
    handleQuickAction: (action: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
    userCases, 
    setView, 
    setSelectedCase, 
    handleQuickAction 
}) => {
    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Sekcja Hero z szybkim wejściem do AI */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 text-white p-6 sm:p-10 shadow-2xl shadow-blue-200/50">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full -ml-16 -mb-16 blur-2xl"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 lg:gap-12">
                    <div className="flex-1 text-center md:text-left">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wider uppercase mb-6 border border-white/20 shadow-inner">
                            <Bot className="w-4 h-4 mr-2 text-white" />
                            Twój Osobisty Prawnik AI 2.0
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
                            Masz problem prawny? <br className="hidden sm:block"/>
                            <span className="text-blue-200">Przeanalizujmy go razem.</span>
                        </h2>
                        <p className="text-lg text-blue-100/90 mb-8 max-w-xl mx-auto md:mx-0 leading-relaxed">
                            Wykorzystaj moc Sztucznej Inteligencji, aby zrozumieć skomplikowane dokumenty i otrzymać natychmiastową poradę prawną.
                        </p>
                        
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <button 
                                onClick={() => setView('ANALYZER')}
                                className="group px-8 py-4 bg-white text-blue-700 rounded-2xl font-bold shadow-xl hover:bg-blue-50 transition-all flex items-center gap-3 active:scale-95"
                            >
                                <span className="p-2 bg-blue-100 rounded-lg group-hover:scale-110 transition-transform">
                                    <FileSearch size={18} />
                                </span>
                                Analizuj Dokument
                            </button>
                            <button 
                                onClick={() => setView('CONSUMER_WIZARD')}
                                className="group px-8 py-4 bg-white/10 backdrop-blur-md text-white border border-white/30 rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center gap-3 active:scale-95 shadow-lg"
                            >
                                <ShoppingCart size={20} className="text-blue-200" />
                                Kreator Konsumencki
                            </button>
                        </div>
                    </div>
                    
                    <div className="hidden lg:flex flex-col gap-4 w-72">
                        <div className="bg-white/15 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-xl transform hover:rotate-2 transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-400/20 rounded-lg text-emerald-300">
                                    <Shield size={20} />
                                </div>
                                <span className="font-bold text-sm">Ochrona 24/7</span>
                            </div>
                            <p className="text-xs text-blue-100/70">Wsparcie prawne dostępne o każdej porze dnia i nocy.</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-xl transform -translate-x-6 hover:-rotate-1 transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-amber-400/20 rounded-lg text-amber-300">
                                    <Zap size={20} />
                                </div>
                                <span className="font-bold text-sm">Błyskawicznie</span>
                            </div>
                            <p className="text-xs text-blue-100/70">Odpowiedź w 15 sekund na dowolne pytanie prawne.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid narzędzi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { id: 'ANALYZER', title: 'Analiza Prawna', desc: 'Skanuj i analizuj umowy', icon: <FileSearch className="text-blue-600" />, color: 'bg-blue-50' },
                    { id: 'GENERATOR', title: 'Generuj Pismo', desc: '15+ profesjonalnych wzorów', icon: <FilePlus className="text-emerald-600" />, color: 'bg-emerald-50' },
                    { id: 'CONSUMER_WIZARD', title: 'Centrum Zwrotów', desc: 'Pomoc w reklamacjach', icon: <ShoppingCart className="text-purple-600" />, color: 'bg-purple-50' },
                    { id: 'CALCULATORS', title: 'Kalkulatory', desc: 'Terminy, odsetki, koszty', icon: <Calculator className="text-amber-600" />, color: 'bg-amber-50' }
                ].map((action) => (
                    <button 
                        key={action.id}
                        onClick={() => setView(action.id as ViewMode)}
                        className="group flex flex-col p-6 text-left rounded-3xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                        <div className={`w-14 h-14 rounded-2xl ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                            {React.cloneElement(action.icon as React.ReactElement<{ size?: number }>, { size: 28 })}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">{action.title}</h3>
                        <p className="text-sm text-slate-500 mb-4 leading-relaxed group-hover:text-slate-600 transition-colors">{action.desc}</p>
                        <div className="mt-auto flex items-center text-blue-600 text-xs font-bold uppercase tracking-wider group-hover:gap-2 transition-all">
                            Otwórz
                            <ArrowRight size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Ostatnie rozmowy i sprawy */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                                <History size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Twoje Sprawy</h3>
                                <p className="text-sm text-slate-500 font-medium">Historia rozmów i dokumentów</p>
                            </div>
                        </div>
                        {userCases.length > 0 && (
                            <button 
                                onClick={() => setView('CASE_LIST')}
                                className="px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center"
                            >
                                Zobacz wszystko <ArrowRight size={14} className="ml-2" />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {userCases.length > 0 ? (
                            userCases.slice(0, 4).map(c => (
                                <CaseSummaryCard 
                                    key={c.id} 
                                    caseItem={c} 
                                    onClick={() => {
                                        setSelectedCase(c);
                                        setView('CASE_DETAIL');
                                    }}
                                />
                            ))
                        ) : (
                            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center p-12 sm:p-16 rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 grayscale hover:grayscale-0 transition-all group">
                                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Bot size={40} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <h4 className="text-xl font-bold text-slate-400 group-hover:text-slate-900 mb-2 transition-colors">Brak historii</h4>
                                <p className="text-sm text-slate-400 group-hover:text-slate-600 text-center max-w-xs transition-colors">
                                    Twoja historia rozmów z prawnikiem AI pojawi się tutaj po pierwszej konsultacji.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Szybkie porady i skróty */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                            <Star size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Szybki Start</h3>
                            <p className="text-sm text-slate-500 font-medium">Najczęstsze problemy</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {[
                            { label: 'Odstąpienie od umowy', sub: 'Zakup przez internet', icon: <ShoppingCart size={16} />, action: 'RETURN_ONLINE' },
                            { label: 'Wypowiedzenie najmu', sub: 'Wzór z objaśnieniem', icon: <Briefcase size={16} />, action: 'LEASE_TERMINATION' },
                            { label: 'Reklamacja towaru', sub: 'Buty, elektronika itp.', icon: <Info size={16} />, action: 'PRODUCT_COMPLAINT' },
                            { label: 'Praca zdalna', sub: 'Prawa pracownika', icon: <Bot size={16} />, action: 'REMOTE_WORK' }
                        ].map((q, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleQuickAction(q.action)}
                                className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-amber-200 hover:shadow-md transition-all text-left"
                            >
                                <div className="p-2 bg-slate-50 text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600 rounded-xl transition-all">
                                    {q.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-slate-900 truncate">{q.label}</h4>
                                    <p className="text-xs text-slate-500 truncate">{q.sub}</p>
                                </div>
                                <ArrowRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                    </div>

                    <div className="p-6 rounded-3xl bg-slate-900 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-blue-500/30 transition-colors"></div>
                        <div className="relative z-10">
                            <h4 className="font-bold flex items-center gap-2 mb-3">
                                <Shield className="text-blue-400" size={18} />
                                Gwarancja Prywatności
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Wszystre analizowane przez Ciebie dokumenty i rozmowy są szyfrowane i widoczne tylko dla Ciebie. Twoje dane nie służą do trenowania modeli publicznych.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
