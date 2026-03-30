
import React, { useState, useEffect } from 'react';
import { ChevronRight, Target, Pause, Play, RefreshCw, Shield } from 'lucide-react';

interface FocusFlowSessionProps {
    theme: any;
    setViewMode: (mode: any) => void;
}

export const FocusFlowSession = ({ theme, setViewMode }: FocusFlowSessionProps) => {
    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 min
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'WORK' | 'BREAK'>('WORK');
    const [blockedApps, setBlockedApps] = useState(0);

    useEffect(() => {
        let interval: any = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(time => time - 1);
                // Simulate blocking distractions randomly
                if (Math.random() > 0.9) setBlockedApps(prev => prev + 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    const toggleTimer = () => setIsActive(!isActive);
    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(mode === 'WORK' ? 25 * 60 : 5 * 60);
        setBlockedApps(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full flex flex-col animate-fade-in pt-4 max-w-2xl mx-auto w-full px-4">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setViewMode('DASHBOARD')} className={`p-2 rounded-lg transition-colors ${theme.textSec} hover:text-foreground hover:bg-surface/50`}>
                    <ChevronRight size={24} className="rotate-180"/>
                </button>
                <div>
                    <h2 className={`text-2xl font-bold flex items-center gap-2 ${theme.highlight}`}>
                        <Target className="text-rose-500"/> Focus Flow
                    </h2>
                    <p className={`text-xs ${theme.textSec}`}>Deep Work Protocol • License Active</p>
                </div>
            </div>

            <div className={`flex-1 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden ${theme.card} shadow-2xl`}>
                {isActive && (
                    <div className="absolute inset-0 bg-rose-500/5 animate-pulse"></div>
                )}

                <div className="relative z-10 text-center w-full">
                    <div className="flex justify-center gap-4 mb-8">
                        <button 
                            onClick={() => { setMode('WORK'); setTimeLeft(25*60); setIsActive(false); }}
                            className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${mode === 'WORK' ? 'bg-rose-500 text-white' : 'bg-surface text-foreground-muted'}`}
                        >
                            Deep Work
                        </button>
                        <button 
                            onClick={() => { setMode('BREAK'); setTimeLeft(5*60); setIsActive(false); }}
                            className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${mode === 'BREAK' ? 'bg-teal-500 text-white' : 'bg-surface text-foreground-muted'}`}
                        >
                            Short Break
                        </button>
                    </div>

                    <div className={`text-8xl md:text-9xl font-mono font-bold tracking-tighter mb-8 tabular-nums ${isActive ? 'text-rose-500' : theme.highlight}`}>
                        {formatTime(timeLeft)}
                    </div>

                    <div className="flex justify-center gap-6 mb-12">
                        <button 
                            onClick={toggleTimer}
                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-xl ${isActive ? 'bg-surface border-2 border-rose-500 text-rose-500' : 'bg-rose-600 text-white hover:bg-rose-500'}`}
                        >
                            {isActive ? <Pause size={32} className="fill-current"/> : <Play size={32} className="fill-current ml-1"/>}
                        </button>
                        <button 
                            onClick={resetTimer}
                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all bg-surface border border-border ${theme.textSec} hover:text-foreground hover:border-rose-500/30`}
                        >
                            <RefreshCw size={24}/>
                        </button>
                    </div>

                    <div className={`max-w-xs mx-auto p-4 rounded-xl border flex items-center justify-between ${theme.bg === 'bg-black' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                                <Shield size={18}/>
                            </div>
                            <div className="text-left">
                                <div className={`text-[10px] font-bold uppercase ${theme.textSec}`}>Distraction Shield</div>
                                <div className={`text-xs font-bold ${theme.highlight}`}>Active</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-rose-500">{blockedApps}</div>
                            <div className={`text-[9px] ${theme.textSec}`}>Zablokowane</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
