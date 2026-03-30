import React from 'react';
import { 
    History, Search, ArrowLeft, ArrowRight, Filter, Calendar, Clock, ChevronRight,
    Bot, FileText, CheckCircle2, MoreVertical, Trash2
} from 'lucide-react';
import { ViewMode, LegalCase } from './types';
import { CaseSummaryCard } from './ui';

interface CaseListViewProps {
    userCases: LegalCase[];
    setView: (view: ViewMode) => void;
    setSelectedCase: (caseItem: LegalCase) => void;
}

export const CaseListView: React.FC<CaseListViewProps> = ({
    userCases,
    setView,
    setSelectedCase
}) => {
    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setView('DASHBOARD')}
                        className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm active:scale-95 group"
                    >
                        <ArrowLeft size={22} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                    </button>
                    <div>
                        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Twoje Sprawy</h3>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Historia Twoich dokumentów i spraw</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Szukaj w sprawach..." 
                            className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm font-medium min-w-[280px]"
                        />
                    </div>
                    <button className="p-3.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-2xl transition-all shadow-sm">
                        <Filter size={20} className="text-slate-500" />
                    </button>
                </div>
            </div>

            {userCases.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userCases.map((caseItem) => (
                        <div 
                            key={caseItem.id} 
                            onClick={() => {
                                setSelectedCase(caseItem);
                                setView('CASE_DETAIL');
                            }}
                            className="group relative flex flex-col p-6 rounded-3xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${caseItem.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {caseItem.status === 'OPEN' ? 'W toku' : 'Zamknięta'}
                                    </span>
                                    <span className="text-[10px] text-slate-300 font-bold font-mono">#{caseItem.id.includes('-') ? caseItem.id.split('-')[1] : caseItem.id}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold">
                                    <Calendar size={12} />
                                    {typeof caseItem.createdAt === 'string' ? caseItem.createdAt : 
                                     caseItem.createdAt instanceof Date ? caseItem.createdAt.toLocaleDateString() : 
                                     'N/A'}
                                </div>
                            </div>
                            
                            <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 mb-3 transition-colors line-clamp-2">
                                {caseItem.title}
                            </h4>
                            
                            <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    <History size={12} />
                                    {caseItem.messages.length} Odpowiedzi
                                </div>
                                <div className="p-1.5 bg-slate-50 text-slate-300 group-hover:bg-blue-100 group-hover:text-blue-600 rounded-lg transition-all translate-x-1 group-hover:translate-x-3 duration-300">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-20 rounded-[40px] border-2 border-dashed border-slate-100 bg-slate-50/50 grayscale opacity-80 group hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                    <div className="w-28 h-28 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500">
                        <Bot size={56} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <h4 className="text-2xl font-bold text-slate-400 group-hover:text-slate-900 mb-4 transition-colors">Archiwum jest puste</h4>
                    <p className="text-slate-400 group-hover:text-slate-600 text-center max-w-sm mb-10 leading-relaxed font-medium">
                        Wszystkie Twoje analizy, wygenerowane dokumenty i rozmowy z AI będą przechowywane bezpiecznie tutaj.
                    </p>
                    <button 
                        onClick={() => setView('ANALYZER')}
                        className="px-10 py-5 bg-white border border-slate-200 text-slate-800 rounded-2xl font-bold hover:bg-slate-50 shadow-sm transition-all flex items-center gap-3 active:scale-95 group/btn"
                    >
                        Rozpocznij Nową Sprawę
                        <ArrowRight size={20} className="group-hover/btn:translate-x-2 transition-transform" />
                    </button>
                </div>
            )}
        </div>
    );
};
