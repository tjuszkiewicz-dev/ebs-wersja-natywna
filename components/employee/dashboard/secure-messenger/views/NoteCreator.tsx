import React, { useState } from 'react';
import { ArrowLeft, Send, Link as LinkIcon, Copy, Check, EyeOff, AlertTriangle, Eye } from 'lucide-react';
import { generateKey, encryptMessage, exportKey, generateRandomId } from '../crypto';
import { MOCK_STORAGE_KEY, SecureNote } from '../types';

interface Props {
  onBack: () => void;
  onSimulateRead: (link: string) => void;
}

export const NoteCreator: React.FC<Props> = ({ onBack, onSimulateRead }) => {
  const [content, setContent] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateNote = async () => {
    if (!content.trim()) return;
    setIsLoading(true);

    try {
      // 1. Generate Key & IV
      const key = await generateKey();
      const exportedKey = await exportKey(key);
      const { ciphertext, iv } = await encryptMessage(content, key);
      const noteId = generateRandomId(12);

      // 2. Create Note Object (Mock Server Storage)
      // In real app, only ciphertext + iv goes to server. Key stays on client (in URL hash).
      // Here we simulate the server storage in sessionStorage
      const noteData: SecureNote = {
        id: noteId,
        content: ciphertext,
        iv: iv,
        createdAt: Date.now(),
        destroyed: false
      };

      // Store in session for demo persistence across component remounts
      const existing = sessionStorage.getItem(MOCK_STORAGE_KEY);
      const notes = existing ? JSON.parse(existing) : {};
      notes[noteId] = noteData;
      sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(notes));

      // 3. Generate Link (Format: ID + Key)
      // We use a # fragment for the key so it's never sent to server
      const link = `${window.location.origin}/secure-read?id=${noteId}#${btoa(exportedKey)}`;
      
      setTimeout(() => {
        setGeneratedLink(link);
        setIsLoading(false);
      }, 800); // Fake delay for realism

    } catch (e) {
      console.error("Encryption failed", e);
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white animate-in slide-in-from-right duration-300">
      <header className="px-6 py-4 flex items-center gap-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-sm z-10">
        <button 
          onClick={onBack}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h2 className="font-bold text-lg">Nowa Notatka</h2>
      </header>

      <main className="flex-1 p-6 z-10 flex flex-col max-w-lg mx-auto w-full">
        {!generatedLink ? (
          <>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 flex gap-3 text-yellow-200/80 text-sm">
               <AlertTriangle className="w-5 h-5 flex-shrink-0" />
               <p>Wiadomość zostanie zaszyfrowana i zniszczona automatycznie po pierwszym odczytaniu.</p>
            </div>

            <div className="flex-1 flex flex-col relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Napisz swoją wiadomość tutaj..."
                className="w-full h-64 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none font-mono text-sm leading-relaxed"
                autoFocus
              />
              <div className="absolute bottom-4 right-4 text-xs text-slate-500">
                {content.length} znaków
              </div>
            </div>

            <button
              onClick={handleCreateNote}
              disabled={!content.trim() || isLoading}
              className={`mt-6 w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                !content.trim() 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-900/20 active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <EyeOff className="w-5 h-5" />
                  Zaszyfruj i Utwórz Link
                </>
              )}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400 border border-emerald-500/30">
               <LinkIcon className="w-8 h-8" />
            </div>
            
            <h3 className="text-2xl font-bold mb-2 text-center text-white">Notatka gotowa</h3>
            <p className="text-slate-400 text-center text-sm mb-8 max-w-xs mx-auto">
              Skopiuj link i wyślij go do odbiorcy. Notatka zniszczy się po otwarciu.
            </p>

            <div className="w-full bg-black/40 p-4 rounded-xl border border-white/10 flex items-center gap-3 mb-6 relative group">
              <div className="flex-1 font-mono text-xs text-emerald-400 truncate select-all">
                {generatedLink}
              </div>
              <button 
                onClick={copyToClipboard}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                title="Kopiuj link"
              >
                {isCopied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button 
                onClick={() => setGeneratedLink(null)} // Reset
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors text-center"
              >
                Utwórz kolejną
              </button>
              <button 
                onClick={() => onSimulateRead(generatedLink)}
                className="py-3 px-4 rounded-xl bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 font-medium text-sm transition-colors flex items-center justify-center gap-2 group"
              >
                <Eye className="w-4 h-4" />
                Symuluj Odczyt
              </button>
            </div>

            <div className="mt-8">
               <div className="flex gap-4 opacity-50 justify-center">
                  <div className="w-8 h-8 rounded bg-green-500/20"></div>
                  <div className="w-8 h-8 rounded bg-blue-500/20"></div>
                  <div className="w-8 h-8 rounded bg-purple-500/20"></div>
               </div>
               <p className="text-[10px] text-center text-slate-600 mt-2">Działa z WhatsApp, Messenger, SMS</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
