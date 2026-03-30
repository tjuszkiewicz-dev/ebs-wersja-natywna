import React from 'react';
import { MessageSquare, FileText, Shield, Lock, ChevronRight, X } from 'lucide-react';

interface Props {
  onSelectChat: () => void;
  onSelectNote: () => void;
  onClose: () => void;
}

export const MessengerMenu: React.FC<Props> = ({ onSelectChat, onSelectNote, onClose }) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 text-white relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <header className="px-6 py-6 flex justify-between items-center z-10 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Secure Messenger</h2>
            <p className="text-xs text-slate-400">End-to-end encrypted • Zero knowledge</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col justify-center gap-6 z-10 max-w-md mx-auto w-full">
        
        {/* Security Description */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-5">
              <Shield className="w-24 h-24 rotate-12" />
           </div>
           
           <div className="flex gap-4 relative z-10">
              <div className="p-3 bg-emerald-500/10 rounded-xl h-fit">
                 <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                 <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                    Militarny Standard Szyfrowania
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">AES-256</span>
                 </h3>
                 <p className="text-xs text-slate-400 leading-relaxed">
                    Twoje notatki i rozmowy są chronione algorytmem <strong>AES-256</strong> – tym samym, którego używają agencje wywiadowcze (NSA) do zabezpieczania ściśle tajnych informacji. Szyfrowanie odbywa się bezpośrednio na Twoim urządzeniu (End-to-End), co gwarantuje 100% prywatności.
                 </p>
              </div>
           </div>
        </div>

        {/* Chat Tile */}
        <button 
          onClick={onSelectChat}
          className="group relative overflow-hidden rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition-all duration-300 p-6 text-left shadow-lg hover:shadow-emerald-900/20"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
             <MessageSquare className="w-32 h-32" />
          </div>
          
          <div className="relative z-10 flex items-start justify-between">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-4 shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold mb-2 group-hover:text-emerald-400 transition-colors">Prywatny Czat</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Rozpocznij szyfrowaną rozmowę. Wiadomości znikają automatycznie po odczytaniu.
          </p>
          <div className="mt-4 flex gap-2">
             <span className="text-[10px] uppercase tracking-wider font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">AES-256</span>
             <span className="text-[10px] uppercase tracking-wider font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">Self-Destruct</span>
          </div>
        </button>

        {/* Note Tile */}
        <button 
          onClick={onSelectNote}
          className="group relative overflow-hidden rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition-all duration-300 p-6 text-left shadow-lg hover:shadow-emerald-900/20"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
             <FileText className="w-32 h-32" />
          </div>

          <div className="relative z-10 flex items-start justify-between">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-4 shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold mb-2 group-hover:text-orange-400 transition-colors">Samoniszcząca Notatka</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Stwórz notatkę, która zniknie na zawsze po pierwszym odczytaniu. Wyślij jako link.
          </p>
          <div className="mt-4 flex gap-2">
             <span className="text-[10px] uppercase tracking-wider font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">One-Time Link</span>
             <span className="text-[10px] uppercase tracking-wider font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">Burn on Read</span>
          </div>
        </button>
      </main>

      <footer className="p-6 text-center z-10">
        <div className="flex justify-center items-center gap-2 text-slate-500 text-xs">
           <Shield className="w-3 h-3" />
           <span>Secured by EBS Enterprise Vault</span>
        </div>
      </footer>
    </div>
  );
};
