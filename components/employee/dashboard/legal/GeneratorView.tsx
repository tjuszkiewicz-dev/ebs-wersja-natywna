import React from 'react';
import { 
    FilePlus, Search, ArrowRight, CheckCircle, Download, X, Eye,
    FileText, Save, Info, ChevronRight, Wand2, Bot
} from 'lucide-react';
import { ViewMode, DocumentTemplate } from './types';
import { DOCUMENT_TEMPLATES } from './constants';

interface GeneratorViewProps {
    selectedTemplate: DocumentTemplate | null;
    setSelectedTemplate: (tpl: DocumentTemplate | null) => void;
    formValues: Record<string, string>;
    setFormValues: (vals: Record<string, string>) => void;
    isGenerating: boolean;
    generatedDoc: string | null;
    handleGenerateDocument: () => void;
    handleDownloadPDF: () => void;
    setView?: (view: ViewMode) => void;
}

export const GeneratorView: React.FC<GeneratorViewProps> = ({
    selectedTemplate,
    setSelectedTemplate,
    formValues,
    setFormValues,
    isGenerating,
    generatedDoc,
    handleGenerateDocument,
    handleDownloadPDF
}) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            {!selectedTemplate ? (
                <div className="space-y-8 max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600 shadow-md shadow-emerald-100">
                                <FilePlus size={28} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Generator Pism Prawnych</h3>
                                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Wybierz wzór i gotowe!</p>
                            </div>
                        </div>
                        <div className="relative group min-w-[300px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="Szukaj wzoru (np. reklamacja, najem)..." 
                                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {DOCUMENT_TEMPLATES.map((tpl) => (
                            <button 
                                key={tpl.id}
                                onClick={() => setSelectedTemplate(tpl)}
                                className="group relative flex flex-col p-8 text-left rounded-3xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300"
                            >
                                <div className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 rounded-xl transition-all">
                                    <ChevronRight size={18} />
                                </div>
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-6 shadow-inner tracking-widest uppercase font-bold text-[10px]">
                                    {tpl.category}
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 mb-2 transition-colors">{tpl.name}</h4>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium mb-6 group-hover:text-slate-600 transition-colors">{tpl.description}</p>
                                <div className="mt-auto flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider group-hover:gap-3 transition-all pt-4 border-t border-slate-50">
                                    Wypełnij Formularz
                                    <Wand2 size={14} />
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="p-8 rounded-3xl bg-blue-900 text-white relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center gap-8 group">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-1000"></div>
                        <div className="relative z-10 hidden md:flex w-24 h-24 bg-white/20 backdrop-blur-md rounded-2xl items-center justify-center border border-white/20">
                            <Bot size={48} className="text-blue-200" />
                        </div>
                        <div className="relative z-10 flex-1 text-center md:text-left">
                            <h4 className="text-2xl font-bold mb-2">Potrzebujesz czegoś innego?</h4>
                            <p className="text-blue-100/80 mb-0 font-medium leading-relaxed">Nasz prawnik AI może napisać dowolne pismo od podstaw. Wystarczy, że napiszesz mu, co chcesz osiągnąć, a on przygotuje projekt.</p>
                        </div>
                        <button 
                            onClick={() => {}} // Placeholder for chat or custom template
                            className="relative z-10 px-6 py-3 bg-white text-blue-900 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center gap-2 whitespace-nowrap"
                        >
                            Poproś AI o wzór
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 mb-2">
                            <button 
                                onClick={() => { setSelectedTemplate(null); setFormValues({}); }}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{selectedTemplate.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase">{selectedTemplate.category}</span>
                                    <span className="text-xs text-slate-400 font-medium">Uzupełnij wymagane pola</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xl shadow-slate-200/50">
                            {selectedTemplate.fields.map((field) => (
                                <div key={field.id} className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">{field.label}</label>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            value={formValues[field.id] || ''}
                                            onChange={(e) => setFormValues({...formValues, [field.id]: e.target.value})}
                                            placeholder={field.placeholder}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-medium text-slate-700 min-h-[100px]"
                                        />
                                    ) : field.type === 'select' ? (
                                        <select 
                                            value={formValues[field.id] || ''}
                                            onChange={(e) => setFormValues({...formValues, [field.id]: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-medium text-slate-700"
                                        >
                                            <option value="">Wybierz...</option>
                                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <input 
                                            type={field.type}
                                            value={formValues[field.id] || ''}
                                            onChange={(e) => setFormValues({...formValues, [field.id]: e.target.value})}
                                            placeholder={field.placeholder}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-medium text-slate-700"
                                        />
                                    )}
                                </div>
                            ))}

                            <button 
                                onClick={handleGenerateDocument}
                                disabled={isGenerating}
                                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-lg"
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Generowanie...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={24} />
                                        Zatwierdź i Generuj Dokument
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Podgląd dokumentu</h4>
                            {generatedDoc && (
                                <button 
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                                >
                                    <Download size={14} />
                                    Pobierz PDF
                                </button>
                            )}
                        </div>

                        {generatedDoc ? (
                            <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl overflow-hidden min-h-[600px] flex flex-col p-1 animate-in fade-in zoom-in-95 duration-500">
                                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                        <FileText size={14} />
                                        PREVIEW_MODE.PDF
                                    </div>
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-400/20"></div>
                                        <div className="w-3 h-3 rounded-full bg-amber-400/20"></div>
                                        <div className="w-3 h-3 rounded-full bg-emerald-400/20"></div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
                                    <div 
                                        className="bg-white shadow-lg mx-auto w-full max-w-[595px] min-h-[842px] border border-slate-200 origin-top transform"
                                        dangerouslySetInnerHTML={{ __html: generatedDoc }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl h-[600px] flex flex-col items-center justify-center text-slate-400 p-12 text-center group">
                                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                    <Eye size={40} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <h4 className="font-bold text-slate-400 text-lg mb-2">Podgląd nie aktywny</h4>
                                <p className="text-sm text-slate-400 max-w-[250px] font-medium leading-relaxed">Uzupełnij dane w formularzu po lewej, a następnie kliknij przycisk generowania.</p>
                                <div className="mt-8 flex items-center gap-3">
                                    <Info size={16} />
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Wszystkie dokumenty są zapisywane tymczasowo</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
