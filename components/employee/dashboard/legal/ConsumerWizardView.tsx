import React from 'react';
import { 
    ShoppingCart, ArrowLeft, CheckCircle2, AlertCircle, ArrowRight, Bot, 
    FilePlus, ShieldCheck, History, Info, ChevronRight, Zap
} from 'lucide-react';
import { ViewMode, DocumentTemplate } from './types';
import { CONSUMER_WIZARD_DATA, DOCUMENT_TEMPLATES } from './constants';

interface ConsumerWizardViewProps {
    wizardStep: string;
    setWizardStep: (step: string) => void;
    wizardHistory: string[];
    setWizardHistory: (history: string[]) => void;
    setView: (view: ViewMode) => void;
    setSelectedTemplate: (tpl: DocumentTemplate | null) => void;
}

export const ConsumerWizardView: React.FC<ConsumerWizardViewProps> = ({
    wizardStep,
    setWizardStep,
    wizardHistory,
    setWizardHistory,
    setView,
    setSelectedTemplate
}) => {
    const currentStep = CONSUMER_WIZARD_DATA[wizardStep];

    const handleNext = (nextId: string) => {
        setWizardHistory([...wizardHistory, wizardStep]);
        setWizardStep(nextId);
    };

    const handleBack = () => {
        if (wizardHistory.length === 0) {
            setView('DASHBOARD');
            return;
        }
        const prevHistory = [...wizardHistory];
        const lastStep = prevHistory.pop()!;
        setWizardHistory(prevHistory);
        setWizardStep(lastStep);
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleBack}
                        className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm active:scale-95 group"
                    >
                        <ArrowLeft size={22} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                    </button>
                    <div>
                        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Kreator Reklamacji i Zwrotów</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">Krok po kroku</span>
                            <span className="text-xs text-slate-400 font-medium">Poznaj swoje prawa konsumenckie w 60 sekund</span>
                        </div>
                    </div>
                </div>
                <div className="flex -space-x-3 overflow-hidden">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`w-10 h-10 rounded-full border-4 border-white flex items-center justify-center text-[10px] font-bold ${wizardHistory.length >= i ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {i}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[32px] p-8 sm:p-12 shadow-2xl shadow-blue-900/5 min-h-[500px] flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-blue-100 transition-colors duration-1000"></div>
                
                <div className="relative z-10 transition-all duration-300">
                    {currentStep.question ? (
                        <>
                            <h4 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-10 leading-tight">
                                {currentStep.question}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {currentStep.options.map((opt, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleNext(opt.nextId)}
                                        className="group flex flex-col p-8 text-left rounded-3xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center mb-6 transition-all shadow-inner group-hover:rotate-6">
                                            {opt.icon}
                                        </div>
                                        <h5 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{opt.label}</h5>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed group-hover:text-slate-600 transition-colors mb-4">{opt.subLabel}</p>
                                        <div className="mt-auto opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                                            <div className="flex items-center gap-2 text-blue-600 text-[10px] font-bold uppercase tracking-widest">
                                                Wybierz <ArrowRight size={12} />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6 animate-in zoom-in-95 duration-500">
                            <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl ${currentStep.advice?.isPositive ? 'bg-emerald-100 text-emerald-600 shadow-emerald-100' : 'bg-amber-100 text-amber-600 shadow-amber-100'}`}>
                                {currentStep.advice?.isPositive ? <CheckCircle2 size={56} /> : <AlertCircle size={56} />}
                            </div>
                            <h4 className="text-3xl font-extrabold text-slate-900 mb-4 px-4">{currentStep.advice?.title}</h4>
                            <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto font-medium">{currentStep.advice?.description}</p>
                            
                            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-12 max-w-xl mx-auto flex items-center gap-4 text-left group/basis">
                                <div className="p-3 bg-white rounded-2xl text-slate-400 shadow-sm border border-slate-100 group-hover/basis:text-blue-500 transition-colors shrink-0">
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Podstawa prawna:</span>
                                    <span className="text-sm font-bold text-slate-700">{currentStep.advice?.legalBasis}</span>
                                </div>
                            </div>

                            {currentStep.finalAction ? (
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                                    <button 
                                        onClick={() => {
                                            const tpl = DOCUMENT_TEMPLATES.find(t => t.id === currentStep.finalAction?.templateId);
                                            if (tpl) {
                                                setSelectedTemplate(tpl);
                                                setView('GENERATOR');
                                            }
                                        }}
                                        className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95 text-lg group/btn"
                                    >
                                        <FilePlus size={24} className="group-hover/btn:scale-110 transition-transform" />
                                        {currentStep.finalAction.label}
                                    </button>
                                    <button 
                                        onClick={() => setView('DASHBOARD')}
                                        className="px-10 py-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95 text-lg"
                                    >
                                        Powrót do menu
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setView('DASHBOARD')}
                                    className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-2xl hover:bg-slate-800 transition-all flex items-center gap-3 active:scale-95 text-lg mx-auto"
                                >
                                    <History size={24} />
                                    Zrozumiałem, zakończ
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 p-6 sm:p-8 bg-blue-50 border border-blue-100/50 rounded-[32px] group/tip">
                <div className="flex items-center gap-4 text-blue-900">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-sm border border-blue-100 group-hover/tip:rotate-12 transition-transform shrink-0">
                        <Bot size={28} />
                    </div>
                    <div>
                        <h5 className="font-bold text-lg mb-0.5">Potrzebujesz bardziej precyzyjnej porady?</h5>
                        <p className="text-sm text-blue-700/80 mb-0 font-medium">Napisz do naszego asystenta AI - on pomoże Ci doprecyzować roszczenie.</p>
                    </div>
                </div>
                <button 
                    onClick={() => setView('DASHBOARD')} 
                    className="flex items-center gap-3 px-6 py-3 bg-white text-blue-700 rounded-xl font-bold border border-blue-100 shadow-sm hover:shadow-md transition-all whitespace-nowrap active:scale-95"
                >
                    Zadaj pytanie AI
                    <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
};
