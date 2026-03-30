import React from 'react';
import { 
    FileSearch, Upload, X, Shield, Bot, Save, History, ArrowRight,
    CheckCircle2, AlertCircle, Info, Search, FileText, Lock
} from 'lucide-react';
import { ViewMode, LegalCase } from './types';
import { PulseIndicator } from './ui';

interface AnalyzerViewProps {
    isAnalyzing: boolean;
    analysisResult: string | null;
    uploadedFile: File | null;
    filePreview: string | null;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleAnalyzeDocument: () => Promise<void>;
    saveAnalysisToCases: () => void;
    setView: (view: ViewMode) => void;
    setUploadedFile: (file: File | null) => void;
    setFilePreview: (preview: string | null) => void;
    setAnalysisResult: (result: string | null) => void;
}

export const AnalyzerView: React.FC<AnalyzerViewProps> = ({
    isAnalyzing,
    analysisResult,
    uploadedFile,
    filePreview,
    handleFileChange,
    handleAnalyzeDocument,
    saveAnalysisToCases,
    setView,
    setUploadedFile,
    setFilePreview,
    setAnalysisResult
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
            {/* Lewa kolumna: Upload i podgląd */}
            <div className="space-y-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 rounded-2xl text-blue-600 shadow-sm shadow-blue-100">
                            <FileSearch size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Analizator Dokumentów</h3>
                            <p className="text-sm text-slate-500 font-medium">Sztuczna Inteligencja prześwietli Twoją umowę</p>
                        </div>
                    </div>
                </div>

                {!uploadedFile ? (
                    <div className="group relative">
                        <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-slate-200 bg-white rounded-3xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 px-10 text-center">
                                <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-sm">
                                    <Upload size={32} />
                                </div>
                                <p className="mb-2 text-xl font-bold text-slate-800">
                                    Upuść plik lub kliknij, aby wybrać
                                </p>
                                <p className="text-sm text-slate-400 mb-6 font-medium">
                                    Obsługujemy PDF, JPG, PNG (Umowy, pisma, mandaty)
                                </p>
                                <div className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">
                                    Wybierz z dysku
                                </div>
                            </div>
                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                        </label>
                        <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-8 text-xs text-slate-400 font-medium uppercase tracking-widest">
                            <div className="flex items-center gap-2"><Lock size={12} /> Szyfrowane</div>
                            <div className="flex items-center gap-2"><Shield size={12} /> Prywatne</div>
                            <div className="flex items-center gap-2"><Bot size={12} /> Przez AI</div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-2xl">
                            {filePreview ? (
                                <img src={filePreview} alt="Podgląd" className="w-full h-auto max-h-[500px] object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="w-full h-48 flex flex-col items-center justify-center text-slate-400 bg-slate-800">
                                    <FileSearch size={48} className="mb-3 opacity-20" />
                                    <span className="font-bold text-sm tracking-widest uppercase">Podgląd dokumentu PDF/Obrazu</span>
                                    <span className="text-xs mt-1 text-slate-500">{uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                </div>
                            )}
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button 
                                    onClick={() => {
                                        setUploadedFile(null);
                                        setFilePreview(null);
                                        setAnalysisResult(null);
                                    }}
                                    className="p-2.5 bg-white/20 backdrop-blur-md hover:bg-red-500 text-white rounded-xl transition-all shadow-lg border border-white/20"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={handleAnalyzeDocument}
                                disabled={isAnalyzing}
                                className="flex-1 px-8 py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 active:scale-95 text-lg"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Analizowanie...</span>
                                    </>
                                ) : (
                                    <>
                                        <Bot size={24} />
                                        <span>Uruchom Analizę AI</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100/50 space-y-4 shadow-sm">
                    <h4 className="font-bold text-amber-900 flex items-center gap-2">
                        <Info size={18} />
                        Na co zwrócić uwagę?
                    </h4>
                    <ul className="text-sm text-amber-800/80 space-y-3 font-medium">
                        <li className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                            Sprawdź czy zdjęcie jest wyraźne i tekst czytelny.
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                            AI może przeoczyć "mały druk" - zawsze czytaj finalną poradę z uwagą.
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                            Dane wrażliwe (PESEL, nr dowodu) możesz zamazać przed wysłaniem.
                        </li>
                    </ul>
                </div>
            </div>

            {/* Prawa kolumna: Wynik analizy */}
            <div className={`space-y-6 ${!analysisResult && 'flex items-center justify-center min-h-[400px]'}`}>
                {analysisResult ? (
                    <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-700">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex-1 flex flex-col">
                            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">Raport z Analizy</h4>
                                        <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                            <PulseIndicator />
                                            Wygenerowano przez Gemini Pro Vision
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={saveAnalysisToCases}
                                        className="p-2.5 bg-white text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-slate-200 shadow-sm flex items-center gap-2 font-bold text-xs"
                                        title="Zapisz w moich sprawach"
                                    >
                                        <Save size={18} />
                                        Zapisz
                                    </button>
                                </div>
                            </div>
                            <div className="p-8 overflow-y-auto max-h-[700px] prose prose-slate max-w-none">
                                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                                    {analysisResult}
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setView('GENERATOR')}
                                className="group p-5 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 transition-all text-left shadow-sm"
                            >
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <FilePlusIcon size={20} />
                                </div>
                                <h5 className="font-bold text-slate-800 text-sm mb-1">Stwórz Pismo</h5>
                                <p className="text-xs text-slate-500">Na podstawie wniosków z analizy</p>
                            </button>
                            <button 
                                onClick={() => setView('CASE_LIST')}
                                className="group p-5 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 transition-all text-left shadow-sm"
                            >
                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <History size={20} />
                                </div>
                                <h5 className="font-bold text-slate-800 text-sm mb-1">Moje Sprawy</h5>
                                <p className="text-xs text-slate-500">Przejdź do archiwum dokumentów</p>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-12 max-w-sm mx-auto">
                        <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-slate-100 shadow-inner">
                            <Bot size={48} className="text-slate-200" />
                        </div>
                        <h4 className="text-xl font-bold text-slate-400 mb-3">Oczekiwanie na dokument</h4>
                        <p className="text-sm text-slate-400 leading-relaxed font-medium">
                            Załącz plik w lewym panelu, a prawnik AI opracuje dla Ciebie szczegółową analizę zagrożeń i szans.
                        </p>
                        <div className="mt-10 flex flex-col gap-3">
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 text-left opacity-50">
                                <Search size={20} className="text-slate-300" />
                                <div className="w-32 h-2 bg-slate-200 rounded-full"></div>
                            </div>
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 text-left opacity-50 transform translate-x-4">
                                <FileText size={20} className="text-slate-300" />
                                <div className="w-24 h-2 bg-slate-200 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper for icon since FilePlus might not be imported as FilePlusIcon
const FilePlusIcon = ({ size }: { size: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
);
