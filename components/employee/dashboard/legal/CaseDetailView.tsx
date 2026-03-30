import React from 'react';
import { 
    ArrowLeft, Send, Bot, User, CheckCircle2, History, MessageSquare, 
    MoreVertical, Info, Shield, Search, Trash2, Zap, Star
} from 'lucide-react';
import { ViewMode, LegalCase, ChatMessage } from './types';
import { PulseIndicator } from './ui';

interface CaseDetailViewProps {
    selectedCase: LegalCase | null;
    setView: (view: ViewMode) => void;
    aiInput: string;
    setAiInput: (input: string) => void;
    isThinking: boolean;
    handleChatSubmit: (e: React.FormEvent) => Promise<void>;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    handleCloseCase: () => void;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
    selectedCase,
    setView,
    aiInput,
    setAiInput,
    isThinking,
    handleChatSubmit,
    messagesEndRef,
    handleCloseCase
}) => {
    if (!selectedCase) return null;

    return (
        <div className="max-w-6xl mx-auto h-[750px] flex flex-col bg-white border border-slate-200 rounded-[40px] shadow-2xl shadow-blue-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
            {/* Header czatu */}
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between z-10">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => setView('CASE_LIST')}
                        className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm active:scale-95 group"
                    >
                        <ArrowLeft size={22} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{selectedCase.title}</h3>
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-widest">{selectedCase.category}</span>
                            <span className="text-[10px] text-slate-300 font-bold font-mono">#{selectedCase.id.includes('-') ? selectedCase.id.split('-')[1] : selectedCase.id}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <div className="flex items-center gap-1.5"><History size={14} /> Rozpoczęto {typeof selectedCase.createdAt === 'string' ? selectedCase.createdAt : selectedCase.createdAt instanceof Date ? selectedCase.createdAt.toLocaleDateString() : 'N/A'}</div>
                            {selectedCase.status === 'OPEN' ? (
                                <div className="flex items-center text-emerald-500 gap-1.5"><PulseIndicator /> Sprawa otwarta</div>
                            ) : (
                                <div className="text-slate-400">Archiwum</div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleCloseCase}
                        className="px-6 py-3 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-2xl text-sm font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                        <CheckCircle2 size={18} />
                        Zakończ Sprawę
                    </button>
                </div>
            </div>

            {/* Kontener wiadomości */}
            <div className="flex-1 overflow-y-auto p-12 space-y-12 bg-slate-50/30 scroll-smooth">
                {selectedCase.messages.map((msg, idx) => (
                    <div 
                        key={idx} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-${msg.role === 'user' ? 'right' : 'left'}-4 duration-500`}
                    >
                        <div className={`flex gap-6 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-14 h-14 rounded-3xl shrink-0 flex items-center justify-center shadow-lg border-2 border-white ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white' : 'bg-white text-blue-600'}`}>
                                {msg.role === 'user' ? <User size={28} /> : <Bot size={28} />}
                            </div>
                            <div className="space-y-3">
                                <div className={`px-8 py-6 rounded-[32px] shadow-xl shadow-slate-200/50 leading-relaxed font-medium text-lg whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                                    {msg.content}
                                </div>
                                <div className={`flex items-center gap-4 px-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                        {typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString() : 'N/A'}
                                    </span>
                                    {msg.role === 'assistant' && (
                                        <div className="flex gap-2">
                                            <button className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-300 hover:text-blue-500"><Zap size={14} /></button>
                                            <button className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-300 hover:text-blue-500"><Star size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="flex gap-6 max-w-[85%]">
                            <div className="w-14 h-14 rounded-3xl bg-white text-blue-600 shrink-0 flex items-center justify-center shadow-lg border border-slate-100 animate-bounce">
                                <Bot size={28} />
                            </div>
                            <div className="px-8 py-6 rounded-[32px] bg-white text-slate-400 border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-4 font-bold rounded-tl-none">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"></div>
                                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                                <span>Prawnik AI analizuje sprawę...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input czatu */}
            <div className="p-10 bg-white border-t border-slate-200 relative">
                <form onSubmit={handleChatSubmit} className="relative group">
                    <div className="absolute -top-14 left-0 right-0 flex justify-center pointer-events-none">
                        <div className="px-5 py-2 bg-blue-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 shadow-2xl border border-white/20 opacity-0 group-focus-within:opacity-100 transform translate-y-4 group-focus-within:translate-y-0 transition-all duration-500">
                            <Shield size={14} className="text-blue-400" />
                            Szyfrowany kanał komunikacji z AI
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <textarea 
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleChatSubmit(e as any);
                            }
                        }}
                        placeholder="Napisz do prawnika AI (np. 'Jakie mam szanse w tej sprawie?')..."
                        className="w-full pl-8 pr-32 py-6 bg-slate-50 border border-slate-200 rounded-[32px] focus:ring-8 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 min-h-[100px] resize-none text-lg shadow-inner"
                    />
                    <div className="absolute right-4 bottom-4 flex items-center gap-3">
                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest hidden sm:block">Shift+Enter - nowa linia</div>
                        <button 
                            type="submit"
                            disabled={!aiInput.trim() || isThinking}
                            className={`p-5 rounded-2xl transition-all shadow-xl active:scale-90 ${aiInput.trim() && !isThinking ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' : 'bg-slate-100 text-slate-300'}`}
                        >
                            <Send size={24} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
