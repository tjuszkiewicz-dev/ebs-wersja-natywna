
import React, { useState, useEffect, useRef } from 'react';
import { Brain, ArrowRight, ChevronLeft, Send, Coins, Mic, MicOff, Volume2, VolumeX, Lock, Crown } from 'lucide-react';
import { GoogleGenerativeAI as GoogleGenAI } from "@google/generative-ai";

interface AICoachViewProps {
    currentUser: any;
    balance: number;
    sendMessage: (cost: number, desc: string) => Promise<any>;
    setViewMode: (mode: any) => void;
    theme: any;
    isOLED: boolean;
    checkInDone: boolean;
    mood: number;
    stress: number;
    energy: number;
    dailyBurden: string;
    isSubscribed: boolean; // New prop
}

export const AICoachView = ({ currentUser, balance, sendMessage, setViewMode, theme, isOLED, checkInDone, mood, stress, energy, dailyBurden, isSubscribed }: AICoachViewProps) => {
    const [aiSessionActive, setAiSessionActive] = useState(false);
    const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
        { role: 'model', text: checkInDone 
            ? `Widzę, że Twój nastrój to ${mood}/5, a stres ${stress}/5. Czy chcesz porozmawiać o tym, co Cię dziś obciąża: "${dailyBurden}"?` 
            : 'Dzień dobry. Jestem Twoim trenerem poznawczym. Jeśli czujesz przytłoczenie lub lęk, pomogę Ci zidentyfikować myśli automatyczne. O czym chcesz porozmawiać?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    
    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(false); // Auto-read responses
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize Speech APIs
    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthRef.current = window.speechSynthesis;

            // Browser compatibility check for SpeechRecognition
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.lang = 'pl-PL';
                recognitionRef.current.interimResults = false;

                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setInput(transcript);
                    handleSend(transcript); // Auto-send on voice end
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
                
                recognitionRef.current.onerror = (event: any) => {
                    console.error("Speech error", event.error);
                    setIsListening(false);
                };
            }
        }
    }, []);

    const speakText = (text: string) => {
        if (!synthRef.current || !voiceEnabled) return;
        
        // Cancel previous speech
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pl-PL';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);

        synthRef.current.speak(utterance);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            // Stop speaking if actively speaking to listen
            synthRef.current?.cancel();
            setIsSpeaking(false);
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const startSession = async () => {
        // PAYMENT LOGIC
        if (isSubscribed) {
            // Free for subscribers
            setAiSessionActive(true);
        } else {
            // Charge per use
            if (balance < 5) {
                alert('Niewystarczająca ilość środków (Wymagane: 5 pkt). Kup pakiet lub doładuj konto.');
                return;
            }
            if (confirm("Rozpocząć sesję za 5 pkt? \n(Wskazówka: Pass miesięczny znosi opłaty)")) {
                try {
                    await sendMessage(5, 'AI Cognitive Coach Session (Single)');
                    setAiSessionActive(true);
                } catch (e) {
                    alert('Błąd płatności.');
                }
            }
        }
    };

    const handleSend = async (manualInput?: string) => {
        const textToSend = manualInput || input;
        if (!textToSend.trim() || isTyping) return;
        
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
        setIsTyping(true);

        try {
            const apiKey = localStorage.getItem('ebs_ai_key_v1') || '';
            if (!apiKey) {
                setMessages(prev => [...prev, { role: 'model', text: 'Błąd: Brak klucza API Google Gemini. Skonfiguruj go w ustawieniach (LocalStorage: ebs_ai_key_v1).' }]);
                return;
            }

            const ai = new GoogleGenAI(apiKey);
            const model = ai.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                systemInstruction: (checkInDone 
                    ? `KONTEKST UŻYTKOWNIKA: Nastrój: ${mood}/5, Stres: ${stress}/5, Energia: ${energy}/5. Główny problem: "${dailyBurden}". `
                    : `KONTEKST: Użytkownik nie zrobił jeszcze check-inu. `) + " Jesteś empatycznym terapeutą CBT. Odpowiadaj krótko, ciepło i po ludzku. Unikaj list punktowanych, używaj języka naturalnego, idealnego do syntezy mowy."
            });

            const chat = model.startChat({
                history: messages.map(m => ({ 
                    role: m.role === 'user' ? 'user' : 'model', 
                    parts: [{ text: m.text }] 
                }))
            });

            const result = await chat.sendMessage(textToSend);
            const response = result.response.text();

            setMessages(prev => [...prev, { role: 'model', text: response }]);
            
            // Auto-speak response if voice mode is preferred
            if (voiceEnabled) {
                speakText(response);
            }

        } catch (error) {
            console.error("AI Error", error);
            setMessages(prev => [...prev, { role: 'model', text: 'Wystąpił błąd połączenia.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const ArrowRightIcon = ({className}: {className?: string}) => <ArrowRight size={18} className={className}/>;

    if (!aiSessionActive) {
        return (
            <div className="h-full flex items-center justify-center animate-fade-in p-6">
                <div className={`max-w-md w-full p-8 rounded-3xl ${theme.card} text-center relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-400 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                        <Brain size={40} />
                    </div>
                    <h2 className={`text-2xl font-bold mb-2 ${theme.highlight}`}>AI Cognitive Coach</h2>
                    <p className={`text-sm mb-8 leading-relaxed ${theme.textSec}`}>
                        Prywatna sesja z asystentem trenowanym na protokołach CBT. 
                        Teraz z obsługą głosową dla pełnej swobody myśli.
                    </p>
                    
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={startSession}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
                        >
                            <span className="flex items-center gap-2">
                                Rozpocznij Sesję 
                                {isSubscribed ? (
                                    <span className="bg-amber-400 text-amber-900 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"><Crown size={10}/> FREE</span>
                                ) : (
                                    <span className="bg-black/20 px-2 py-0.5 rounded text-xs font-mono text-indigo-200">5 pkt</span>
                                )}
                            </span>
                            <ArrowRightIcon className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button onClick={() => setViewMode('DASHBOARD')} className={`text-sm ${theme.textSec} hover:text-foreground py-2 transition-colors`}>Wróć</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col animate-fade-in pt-4 max-w-3xl mx-auto w-full relative">
            <div className="flex items-center justify-between mb-4 px-4 md:px-0">
                <button onClick={() => { synthRef.current?.cancel(); setViewMode('DASHBOARD'); }} className={`p-2 rounded-lg transition-colors ${theme.textSec} hover:text-foreground hover:bg-surface/50`}>
                    <ChevronLeft size={24}/>
                </button>
                <div className="flex flex-col items-center">
                    <h2 className={`text-lg font-bold flex items-center gap-2 ${theme.highlight}`}><Brain size={18} className="text-indigo-400"/> Sesja Terapeutyczna</h2>
                    {isSpeaking && <span className="text-[10px] text-indigo-400 font-mono animate-pulse">AI mówi...</span>}
                </div>
                
                <button 
                    onClick={() => {
                        if (voiceEnabled) synthRef.current?.cancel();
                        setVoiceEnabled(!voiceEnabled);
                    }}
                    className={`p-2 rounded-lg transition-colors ${voiceEnabled ? 'text-indigo-400 bg-indigo-500/10' : `${theme.textSec} hover:bg-surface/50`}`}
                    title={voiceEnabled ? "Wyłącz lektora" : "Włącz lektora"}
                >
                    {voiceEnabled ? <Volume2 size={24}/> : <VolumeX size={24}/>}
                </button>
            </div>

            <div className={`flex-1 rounded-2xl overflow-hidden flex flex-col ${theme.card} relative`}>
                
                {/* Visualizer Overlay when Listening */}
                {isListening && (
                    <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-75"></div>
                            <div className="relative w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(79,70,229,0.5)]">
                                <Mic size={32}/>
                            </div>
                        </div>
                        <p className="mt-8 text-white font-bold text-lg animate-pulse">Słucham Cię...</p>
                        <button onClick={toggleListening} className="mt-4 bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-full text-sm font-bold backdrop-blur-md transition-colors">
                            Anuluj
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : `${isOLED ? 'bg-white/10 border-white/5 text-slate-200' : 'bg-surface border border-border text-foreground'} rounded-tl-none`
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className={`${isOLED ? 'bg-white/10' : 'bg-surface border border-border'} px-4 py-3 rounded-2xl rounded-tl-none flex gap-1`}>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef}></div>
                </div>
                
                <div className={`p-4 border-t ${isOLED ? 'bg-black border-white/10' : 'bg-surface border-border'}`}>
                    <div className="flex gap-2 items-end">
                        <button 
                            onClick={toggleListening}
                            className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white' : `bg-surface border ${isOLED ? 'border-white/10 text-slate-300' : 'border-border text-foreground-muted'} hover:text-indigo-500`}`}
                            title="Rozmawiaj"
                        >
                            {isListening ? <MicOff size={20}/> : <Mic size={20}/>}
                        </button>
                        
                        <input 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder={isListening ? "Mów teraz..." : "Napisz wiadomość..."}
                            className={`flex-1 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-500 ${theme.input}`}
                            disabled={isListening}
                        />
                        
                        <button 
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isTyping}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all"
                        >
                            <Send size={20}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
