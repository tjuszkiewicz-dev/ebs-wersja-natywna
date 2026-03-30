
import React, { useState } from 'react';
import { ChevronLeft, Zap, Play, Lock, Activity, Unlock, PlayCircle, X, Maximize2, Crown } from 'lucide-react';
import { PREMIUM_CONTENT } from './constants';

interface PremiumLibraryViewProps {
    balance: number;
    sendMessage: (cost: number, desc: string) => Promise<any>;
    setViewMode: (mode: any) => void;
    theme: any;
    unlockedContent: string[];
    setUnlockedContent: (content: any) => void;
    isSubscribed: boolean; // New prop
}

export const PremiumLibraryView = ({ balance, sendMessage, setViewMode, theme, unlockedContent, setUnlockedContent, isSubscribed }: PremiumLibraryViewProps) => {
    const [activeVideo, setActiveVideo] = useState<string | null>(null);

    const unlockContent = async (item: any) => {
        // FREE for Subscribers
        if (isSubscribed) {
            setUnlockedContent((prev: any) => [...prev, item.id]);
            // Optional: Send 0 cost transaction for stats
            // sendMessage(0, `Unlock Premium (Pass): ${item.title}`); 
            return;
        }

        // PAY for standard
        if (balance < item.price) {
            alert(`Niewystarczające środki. Wymagane: ${item.price} pkt.`);
            return;
        }
        if (confirm(`Czy chcesz odblokować "${item.title}" za ${item.price} pkt?`)) {
            try {
                await sendMessage(item.price, `Unlock Content: ${item.title}`);
                setUnlockedContent((prev: any) => [...prev, item.id]);
            } catch (e) {
                alert('Błąd transakcji.');
            }
        }
    };

    const playVideo = (videoId: string) => {
        setActiveVideo(videoId);
    };

    const ClockIcon = ({size}: {size: number}) => <Activity size={size}/>;
    const SparklesIcon = ({className, size}: any) => <Zap className={className} size={size}/>;

    return (
        <div className="animate-fade-in pt-6 space-y-8">
            <div className="flex items-center gap-4 px-4 md:px-0">
                <button onClick={() => setViewMode('DASHBOARD')} className={`p-2 rounded-lg transition-colors ${theme.textSec} hover:text-foreground hover:bg-surface/50`}>
                    <ChevronLeft size={24}/>
                </button>
                <div>
                    <h2 className={`text-2xl font-bold ${theme.highlight}`}>Premium Studio</h2>
                    <p className={`text-xs ${theme.textSec}`}>Masterclass i Sesje Somatyczne. Inwestuj w siebie.</p>
                </div>
            </div>

            <div className="space-y-8 px-4 md:px-0">
                {/* Masterclass Section */}
                <div>
                    <h3 className="text-sm font-bold text-foreground-muted uppercase tracking-widest mb-4 flex items-center gap-2"><SparklesIcon className="text-amber-400" size={14}/> Masterclass Wideo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {PREMIUM_CONTENT.filter(i => i.type === 'MASTERCLASS').map(item => {
                            const isUnlocked = unlockedContent.includes(item.id) || isSubscribed;
                            
                            return (
                                <div key={item.id} className={`group rounded-2xl overflow-hidden ${theme.card} hover:border-indigo-500/30 transition-all relative`}>
                                    <div className={`h-40 ${item.bg} flex items-center justify-center relative overflow-hidden`}>
                                        {/* Thumbnail Abstract */}
                                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent"></div>
                                        
                                        {isUnlocked ? (
                                            <button onClick={() => playVideo(item.videoId || '')} className="w-16 h-16 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-transform hover:scale-110">
                                                <Play size={32} className="fill-current ml-1"/>
                                            </button>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 z-10">
                                                <div className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white/50 border border-white/10">
                                                    <Lock size={20}/>
                                                </div>
                                                <button 
                                                    onClick={() => unlockContent(item)}
                                                    className="bg-black/60 hover:bg-emerald-600/90 hover:scale-105 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2"
                                                >
                                                    Odblokuj <span className="text-emerald-400">{item.price} pkt</span>
                                                </button>
                                            </div>
                                        )}
                                        {isSubscribed && <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg"><Crown size={10}/> PASS</div>}
                                    </div>
                                    <div className="p-5">
                                        <h4 className={`font-bold text-lg mb-1 ${theme.highlight}`}>{item.title}</h4>
                                        <div className={`flex justify-between items-center text-xs ${theme.textSec}`}>
                                            <span>{item.author}</span>
                                            <span className="flex items-center gap-1"><ClockIcon size={12}/> {item.duration}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Somatic Section */}
                <div>
                    <h3 className="text-sm font-bold text-foreground-muted uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={14} className="text-teal-400"/> Sesje Somatyczne</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {PREMIUM_CONTENT.filter(i => i.type === 'SOMATIC').map(item => {
                            const isUnlocked = unlockedContent.includes(item.id) || isSubscribed;
                            
                            return (
                                <div key={item.id} className={`p-4 rounded-2xl ${theme.card} hover:bg-surface/50 transition-colors relative group`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}>
                                            <Activity size={20}/>
                                        </div>
                                        {isUnlocked ? (
                                            <div className="text-emerald-400"><Unlock size={16}/></div>
                                        ) : (
                                            <div className="text-slate-400"><Lock size={16}/></div>
                                        )}
                                    </div>
                                    <h4 className={`font-bold text-sm mb-1 ${theme.highlight}`}>{item.title}</h4>
                                    <p className={`text-[10px] ${theme.textSec} mb-3`}>{item.duration} • Praca z ciałem</p>
                                    
                                    {isUnlocked ? (
                                        <button onClick={() => playVideo(item.videoId || '')} className={`w-full bg-surface/50 hover:bg-surface text-foreground py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-border`}>
                                            <PlayCircle size={14}/> Odtwórz
                                        </button>
                                    ) : (
                                        <button onClick={() => unlockContent(item)} className="w-full border border-border hover:border-emerald-500/50 hover:bg-emerald-500/10 text-foreground-muted hover:text-emerald-500 py-2 rounded-lg text-xs font-bold transition-all">
                                            {item.price} pkt
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Video Modal */}
            {activeVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-4xl bg-black rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl">
                        <button onClick={() => setActiveVideo(null)} className="absolute top-4 right-4 z-10 text-white bg-black/50 p-2 rounded-full hover:bg-white/20 transition-colors">
                            <X size={24}/>
                        </button>
                        <div className="aspect-video w-full bg-black flex items-center justify-center relative">
                            <iframe 
                                width="100%" 
                                height="100%" 
                                src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1&controls=0`} 
                                title="Video Player" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                            ></iframe>
                        </div>
                        <div className="p-4 flex justify-between items-center bg-[#111]">
                            <h3 className="text-white font-bold">Odtwarzanie...</h3>
                            <div className="flex gap-2">
                                <button className="text-slate-400 hover:text-white"><Maximize2 size={20}/></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
