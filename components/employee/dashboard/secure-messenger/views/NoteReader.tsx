import React, { useState, useEffect } from 'react';
import { ShieldAlert, BookOpen, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { decryptMessage, importKey } from '../crypto';
import { MOCK_STORAGE_KEY, SecureNote } from '../types';

interface Props {
  link: string;
  onClose: () => void;
}

export const NoteReader: React.FC<Props> = ({ link, onClose }) => {
  const [step, setStep] = useState<'CONFIRM' | 'READING' | 'DESTROYED' | 'ERROR'>('CONFIRM');
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');
  
  // Extract ID and Key from the simulated link
  // Format: .../secure-read?id=XXX#KEY_BASE64
  const urlParts = link.split('?id=');
  const idPart = urlParts[1]?.split('#')[0];
  const keyPart = link.split('#')[1];

  useEffect(() => {
    if (!idPart || !keyPart) {
        setStep('ERROR');
        setErrorDetails('Nieprawidłowy link.');
    }
  }, [idPart, keyPart]);

  const handleRead = async () => {
    try {
      // 1. Fetch from Mock Storage
      const existing = sessionStorage.getItem(MOCK_STORAGE_KEY);
      if (!existing) throw new Error("Brak danych.");
      
      const notes = JSON.parse(existing);
      const note = notes[idPart] as SecureNote;

      if (!note || note.destroyed) {
        setStep('DESTROYED');
        return;
      }

      // 2. Mark as Destroyed IMMEDIATELY (Simulate strict server consistency)
      // In real world, this happens on the server side before returning data
      note.destroyed = true;
      notes[idPart] = note;
      sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(notes));

      // 3. Decrypt
      // Convert base64 key back to CryptoKey
      // The key was exported as JWK string then base64 encoded? 
      // In NoteCreator: `btoa(exportedKey)` where exportedKey is JSON string of JWK.
      const jwkString = atob(keyPart);
      const key = await importKey(jwkString);
      
      const content = await decryptMessage(note.content, note.iv, key);
      
      setDecryptedContent(content);
      setStep('READING');

    } catch (e) {
      console.error(e);
      setStep('ERROR');
      setErrorDetails('Nie udało się odszyfrować notatki. Być może została już usunięta.');
    }
  };

  if (step === 'ERROR') {
    return (
      <div className="flex flex-col h-full bg-[#fdfbf7] text-slate-800 items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-500">
           <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2">Błąd</h2>
        <p className="text-slate-600 max-w-sm">{errorDetails || 'Notatka nie istnieje lub link jest uszkodzony.'}</p>
        <button onClick={onClose} className="mt-8 text-sm text-slate-400 hover:text-slate-600 underline">Zamknij</button>
      </div>
    );
  }

  if (step === 'DESTROYED') {
    return (
      <div className="flex flex-col h-full bg-[#fdfbf7] text-slate-800 items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
           <Trash2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2">Notatka zniszczona</h2>
        <p className="text-slate-600 max-w-sm">
          Ta notatka została już odczytana i zniszczona. Nie można jej odzyskać.
        </p>
        <div className="mt-8 text-xs text-slate-400 uppercase tracking-widest">Secure Note System</div>
        <button onClick={onClose} className="mt-4 text-sm text-slate-400 hover:text-slate-600 underline">Zamknij</button>
      </div>
    );
  }

  if (step === 'READING') {
    return (
      <div className="flex flex-col h-full bg-[#fdfbf7] text-slate-800 overflow-hidden">
        <header className="p-4 bg-[#f4f1ea] border-b border-stone-200 flex justify-between items-center">
           <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Secure Note</span>
           <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
             <XCircle className="w-5 h-5" />
           </button>
        </header>
        
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-xl mx-auto bg-white shadow-sm border border-stone-100 p-8 rounded-sm min-h-[50vh] relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-300 via-yellow-300 to-orange-300"></div>
             <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap text-stone-800">
               {decryptedContent}
             </p>
          </div>
          
          <div className="mt-8 text-center text-sm text-stone-500 flex flex-col items-center gap-2">
             <CheckCircle className="w-4 h-4 text-green-500" />
             <p>Notatka została wyświetlona. Zamknięcie tego okna spowoduje jej trwałe usunięcie z pamięci przeglądarki.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#fdfbf7] text-slate-800 items-center justify-center p-8 text-center animate-in zoom-in-95 duration-300">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 text-amber-600 shadow-sm border-4 border-white">
         <ShieldAlert className="w-10 h-10" />
      </div>
      
      <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Masz nową notatkę</h2>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 max-w-sm mx-auto mb-8 text-left">
        <p className="text-stone-600 text-sm leading-relaxed">
          Ktoś wysłał Ci bezpieczną wiadomość. Po kliknięciu poniższego przycisku, treść zostanie wyświetlona <strong>tylko raz</strong>, a następnie trwale zniszczona.
        </p>
      </div>

      <button 
        onClick={handleRead}
        className="px-8 py-4 bg-stone-900 hover:bg-black text-white font-medium rounded-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
      >
        Pokaż notatkę
      </button>

      <p className="mt-6 text-xs text-stone-400">
        Nie odświeżaj strony po otwarciu.
      </p>
    </div>
  );
};
