import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, Key, Shield, LogOut, Copy, Check, Users, UserPlus } from 'lucide-react';
import { generateRandomId } from '../crypto';
import { EncryptedMessage, MessengerView } from '../types';

interface Props {
  onBack: () => void;
}

export const ChatRoom: React.FC<Props> = ({ onBack }) => {
  const [view, setView] = useState<'LOBBY' | 'ROOM'>('LOBBY');
  const [roomId, setRoomId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [messages, setMessages] = useState<EncryptedMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [ttl, setTtl] = useState(30); // Default 30 seconds
  const [isCopied, setIsCopied] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);

  // Auto-scroll to bottom only when NEW messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // Message expiry logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => prev.filter(msg => {
        const expiresAt = msg.timestamp + (msg.ttl * 1000);
        return expiresAt > now;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = () => {
    const newRoomId = generateRandomId(6).toUpperCase();
    setRoomId(newRoomId);
    setView('ROOM');
    // Add welcome message
    addSystemMessage("Pokój utworzony. Kod dostępu: " + newRoomId);
  };

  const handleJoinRoom = () => {
    if (joinCode.length < 3) return;
    setRoomId(joinCode.toUpperCase());
    setView('ROOM');
    addSystemMessage("Dołączono do pokoju " + joinCode.toUpperCase());
  };

  const addSystemMessage = (text: string) => {
    // System messages don't expire quickly
    const msg: EncryptedMessage = {
        id: Date.now().toString() + Math.random(),
        content: text, // In real app, system messages are local only
        sender: 'other', // Display as 'other' style but specific system styling
        timestamp: Date.now(),
        ttl: 3600, // 1 hour
        iv: ''
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: EncryptedMessage = {
      id: Date.now().toString(),
      content: inputValue, // In real app, this is encrypted before sending
      sender: 'me',
      timestamp: Date.now(),
      ttl: ttl,
      iv: '' // Mock
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');

    // Simulate reply for demo
    setTimeout(() => {
        const reply: EncryptedMessage = {
            id: (Date.now() + 1).toString(),
            content: "To jest automatyczna odpowiedź w trybie demo. Twoja wiadomość zniknie za " + ttl + "s.",
            sender: 'other',
            timestamp: Date.now(),
            ttl: ttl,
            iv: ''
        };
        setMessages(prev => [...prev, reply]);
    }, 2000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Render Time Left Component
  const TimeLeft = ({ timestamp, ttl }: { timestamp: number, ttl: number }) => {
    const [left, setLeft] = useState(ttl);
    
    useEffect(() => {
      const timer = setInterval(() => {
        const passed = (Date.now() - timestamp) / 1000;
        const remaining = Math.max(0, Math.ceil(ttl - passed));
        setLeft(remaining);
      }, 1000);
      return () => clearInterval(timer);
    }, [timestamp, ttl]);

    return (
      <span className="text-[10px] min-w-[20px] text-right font-mono opacity-60 flex items-center gap-1">
        {left}s <Clock className="w-3 h-3" />
      </span>
    );
  };

  if (view === 'LOBBY') {
    return (
      <div className="flex flex-col h-full bg-slate-900 text-white p-6 justify-center max-w-md mx-auto w-full animate-in fade-in duration-300">
        <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-lg shadow-emerald-900/10">
                <Users className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Prywatne Czaty</h2>
            <p className="text-slate-400 text-sm">Szyfrowane, efemeryczne pokoje rozmów. Nic nie jest zapisywane na serwerze.</p>
        </div>

        <div className="space-y-4">
            <button 
                onClick={handleCreateRoom}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-900/30 flex items-center justify-center gap-2"
            >
                <UserPlus className="w-5 h-5" />
                Utwórz Nowy Pokój
            </button>
            
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500">lub dołącz</span>
                </div>
            </div>

            <div className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="KOD POKOJU" 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center uppercase tracking-widest font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors"
                    maxLength={6}
                />
                <button 
                    onClick={handleJoinRoom}
                    disabled={joinCode.length < 3}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-xl px-6 transition-colors"
                >
                    <ArrowRightIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
        
        <button onClick={onBack} className="mt-8 text-slate-500 text-sm hover:text-slate-300 text-center">
            Wróć do menu
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center z-20 shadow-sm">
        <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                 {roomId.slice(0,2)}
             </div>
             <div>
                 <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">Pokój {roomId}</h3>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected"></div>
                 </div>
                 <button onClick={copyRoomCode} className="text-[10px] text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
                    {roomId} 
                    {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                 </button>
             </div>
        </div>
        
        <button 
            onClick={() => setView('LOBBY')}
            className="p-2 rounded hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-colors"
            title="Opuść pokój (historia zostanie usunięta)"
        >
            <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
         {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                 <Shield className="w-12 h-12 mb-2" />
                 <p className="text-sm">Wiadomości są szyfrowane end-to-end</p>
             </div>
         )}
         
         {messages.map((msg) => (
             <div 
                key={msg.id} 
                className={`flex w-full ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
             >
                 <div className={`max-w-[75%] rounded-2xl px-4 py-3 relative group transition-all duration-500 ${
                     msg.sender === 'me' 
                        ? 'bg-emerald-600 text-white rounded-br-none shadow-lg shadow-emerald-900/10' 
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                 }`}>
                     <p className="text-sm leading-relaxed">{msg.content}</p>
                     
                     <div className={`flex items-center gap-2 mt-1 text-[10px] ${msg.sender === 'me' ? 'text-emerald-200' : 'text-slate-500'} justify-end`}>
                        {msg.ttl < 3600 && <TimeLeft timestamp={msg.timestamp} ttl={msg.ttl} />}
                     </div>
                 </div>
             </div>
         ))}
         <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="p-3 bg-slate-900 border-t border-slate-800 z-20">
         <div className="flex items-center gap-2 max-w-3xl mx-auto">
             <div className="relative group">
                 <button 
                    className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700" 
                    title="Czas życia wiadomości"
                 >
                    <Clock className="w-5 h-5" />
                 </button>
                 {/* TTL Popup */}
                 <div className="absolute bottom-full left-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-2 shadow-xl hidden group-hover:flex flex-col gap-1 w-32 animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-[10px] text-slate-500 font-bold px-2 py-1">AUTO-DESTRUCT</span>
                    {[5, 10, 30, 60, 3600].map(t => (
                        <button 
                            key={t}
                            onClick={() => setTtl(t)}
                            className={`text-xs text-left px-2 py-1 rounded hover:bg-slate-700 ${ttl === t ? 'text-emerald-400 bg-slate-700' : 'text-slate-300'}`}
                        >
                            {t < 60 ? `${t} sek` : t === 60 ? '1 min' : '1 godz'}
                        </button>
                    ))}
                 </div>
             </div>

             <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Napisz wiadomość..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-full px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-white placeholder-slate-600"
                autoFocus
             />
             
             <button 
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-800 rounded-full text-white transition-all shadow-lg hover:shadow-emerald-900/30 transform active:scale-95"
             >
                <Send className="w-5 h-5" />
             </button>
         </div>
      </footer>
    </div>
  );
};

// Helper icon
const ArrowRightIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
