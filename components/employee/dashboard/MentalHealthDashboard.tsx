
import React, { useState, useEffect } from 'react';
import { 
    Brain, Heart, Zap, Anchor, Moon, Play, Pause, X, ChevronRight, 
    MessageSquare, Activity, Shield, ArrowRight, User, Wallet, Crown, Sun, Lock, 
    Compass, Layout, Sparkles, CheckCircle2, Leaf
} from 'lucide-react';
import { User as UserType } from '../../../types';

// Import Internal Sub-Components
import { CheckInFlow, ProgramView, JournalView, GratitudeView, TeamPulseView } from './mental-health/DashboardViews';
import { SOSView } from './mental-health/SOSView';
import { AICoachView } from './mental-health/AICoachView';
import { FocusFlowSession } from './mental-health/FocusFlowSession';
import { FocusRadioWidget } from './mental-health/FocusRadioWidget';
import { StressHeatmap } from './mental-health/StressHeatmap';
import { PremiumLibraryView } from './mental-health/PremiumLibraryView';
import { SOS_SCENARIOS } from './mental-health/constants';

interface MentalHealthDashboardProps {
    currentUser: UserType;
    balance: number;
    onSpend: (amount: number, description: string) => Promise<void>;
    onExit: () => void;
}

type MHViewMode = 'DASHBOARD' | 'CHECKIN' | 'SOS' | 'COACH' | 'FOCUS' | 'LIBRARY' | 'JOURNAL' | 'GRATITUDE' | 'PROGRAM' | 'TEAM';

export const MentalHealthDashboard: React.FC<MentalHealthDashboardProps> = ({ currentUser, balance, onSpend, onExit }) => {
    // --- STATE ---
    const [viewMode, setViewMode] = useState<MHViewMode>('DASHBOARD');
    const [activeSosProgram, setActiveSosProgram] = useState<any>(null);
    
    // User State
    const [checkInDone, setCheckInDone] = useState(false);
    const [mood, setMood] = useState(3);
    const [stress, setStress] = useState(3);
    const [energy, setEnergy] = useState(3);
    const [dailyBurden, setDailyBurden] = useState('');
    const [unlockedContent, setUnlockedContent] = useState<string[]>([]);
    
    // Theme Config - Default to Light Mode (Calming)
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    // --- THEME DEFINITIONS ---
    const theme = isDarkMode ? {
        bg: 'bg-slate-950',
        textMain: 'text-slate-50',
        textSec: 'text-slate-400',
        card: 'bg-slate-900 border border-slate-800',
        cardHover: 'hover:bg-slate-800',
        highlight: 'text-white',
        input: 'bg-slate-800 border-slate-700 text-white',
        accent: 'text-teal-400',
        accentBg: 'bg-teal-500/20',
        nav: 'bg-slate-950/90 border-slate-800',
        buttonPrimary: 'bg-white text-slate-950 hover:bg-slate-200'
    } : {
        bg: 'bg-[#fafafa]', // Warm white
        textMain: 'text-slate-800',
        textSec: 'text-slate-500',
        card: 'bg-white border border-slate-100 shadow-sm',
        cardHover: 'hover:shadow-md hover:-translate-y-0.5',
        highlight: 'text-slate-900',
        input: 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white',
        accent: 'text-emerald-600',
        accentBg: 'bg-emerald-50',
        nav: 'bg-white/90 border-slate-200 backdrop-blur-md',
        buttonPrimary: 'bg-slate-900 text-white hover:bg-slate-800'
    };

    // --- HANDLERS ---

    const handleStartSos = (program: any) => {
        setActiveSosProgram(program);
        setViewMode('SOS');
    };

    const handleSubmitCheckIn = () => {
        setCheckInDone(true);
        setViewMode('DASHBOARD');
    };

    // --- MAIN DASHBOARD RENDERER ---
    const renderDashboard = () => (
        <div className="space-y-8 animate-in fade-in pb-32">
            {/* Header Greeting */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className={`text-3xl font-bold ${theme.highlight} tracking-tight`}>
                        Dzień dobry, {currentUser.name.split(' ')[0]}.
                    </h1>
                    <p className={`text-base ${theme.textSec} mt-2 max-w-xl`}>
                        Zwolnij na chwilę. Jak możemy Ci dzisiaj pomóc w osiągnięciu równowagi?
                    </p>
                </div>
                {/* Subscription Status Pill */}
                <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full border ${theme.card} text-xs font-bold ${theme.accent}`}>
                    <CheckCircle2 size={14}/> Dostęp Aktywny (Premium)
                </div>
            </div>

            {/* Daily Check-In Hero */}
            {!checkInDone ? (
                <div 
                    onClick={() => setViewMode('CHECKIN')}
                    className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 shadow-xl cursor-pointer group transition-all hover:shadow-2xl"
                >
                    <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-emerald-600/20 to-transparent"></div>
                    <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl group-hover:bg-teal-500/30 transition-colors"></div>
                    
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-xs mb-3">
                                <Activity size={14}/> Daily Check-in
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Jak się dzisiaj czujesz?</h3>
                            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                                Poświęć 30 sekund na analizę swojego nastroju. Pomoże nam to dobrać odpowiednie ćwiczenia.
                            </p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-full backdrop-blur-md group-hover:bg-white/20 transition-all group-hover:scale-110 border border-white/10">
                            <ArrowRight className="text-white" size={28}/>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={`grid grid-cols-3 gap-px bg-slate-200 rounded-2xl overflow-hidden border border-slate-200 shadow-sm`}>
                    <div className="bg-white p-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Nastrój</p>
                        <p className="text-2xl font-bold text-teal-600">{mood}/5</p>
                    </div>
                    <div className="bg-white p-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Stres</p>
                        <p className="text-2xl font-bold text-rose-500">{stress}/5</p>
                    </div>
                    <div className="bg-white p-6 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Energia</p>
                        <p className="text-2xl font-bold text-amber-500">{energy}/5</p>
                    </div>
                </div>
            )}

            {/* Quick Tools Grid */}
            <div>
                <h3 className={`text-sm font-bold uppercase tracking-widest ${theme.textSec} mb-4 ml-1`}>Narzędzia</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button onClick={() => setViewMode('COACH')} className={`p-6 rounded-2xl flex flex-col items-start gap-4 transition-all group ${theme.card} ${theme.cardHover}`}>
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                            <Brain size={24}/>
                        </div>
                        <div className="text-left">
                            <span className={`block text-base font-bold ${theme.highlight}`}>AI Coach</span>
                            <span className={`text-xs ${theme.textSec}`}>Terapia CBT</span>
                        </div>
                    </button>
                    
                    <button onClick={() => setViewMode('FOCUS')} className={`p-6 rounded-2xl flex flex-col items-start gap-4 transition-all group ${theme.card} ${theme.cardHover}`}>
                        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                            <Zap size={24}/>
                        </div>
                        <div className="text-left">
                            <span className={`block text-base font-bold ${theme.highlight}`}>Focus</span>
                            <span className={`text-xs ${theme.textSec}`}>Deep Work</span>
                        </div>
                    </button>

                    <button onClick={() => setViewMode('LIBRARY')} className={`p-6 rounded-2xl flex flex-col items-start gap-4 transition-all group ${theme.card} ${theme.cardHover}`}>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                            <Play size={24} className="fill-current"/>
                        </div>
                        <div className="text-left">
                            <span className={`block text-base font-bold ${theme.highlight}`}>Studio</span>
                            <span className={`text-xs ${theme.textSec}`}>Masterclass</span>
                        </div>
                    </button>

                    <button onClick={() => setViewMode('GRATITUDE')} className={`p-6 rounded-2xl flex flex-col items-start gap-4 transition-all group ${theme.card} ${theme.cardHover}`}>
                        <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                            <Heart size={24}/>
                        </div>
                        <div className="text-left">
                            <span className={`block text-base font-bold ${theme.highlight}`}>Dziennik</span>
                            <span className={`text-xs ${theme.textSec}`}>Wdzięczność</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* SOS Bar */}
            <div className="bg-slate-100 rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
                {SOS_SCENARIOS.map(sc => (
                    <button 
                        key={sc.id}
                        onClick={() => handleStartSos(sc)}
                        className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-rose-200 hover:bg-rose-50 transition-colors group min-w-[200px]"
                    >
                        <div className={`p-2 rounded-full bg-slate-100 group-hover:bg-white group-hover:text-rose-500 transition-colors text-slate-500`}>
                            <sc.icon size={18}/>
                        </div>
                        <div className="text-left">
                            <span className="block font-bold text-sm text-slate-700 group-hover:text-rose-700">{sc.label}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{sc.sub}</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StressHeatmap isOLED={isDarkMode} theme={theme} checkInDone={checkInDone} stress={stress} />
                <FocusRadioWidget theme={theme} />
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen ${theme.bg} ${theme.textMain} font-sans transition-colors duration-300 flex flex-col`}>
            
            {/* Top Navigation Bar */}
            <div className={`sticky top-0 z-30 px-4 md:px-8 py-4 flex justify-between items-center border-b ${theme.nav}`}>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onExit}
                        className={`p-2.5 rounded-xl border border-transparent hover:bg-slate-100 hover:border-slate-200 transition ${theme.textSec}`}
                        title="Wróć do Panelu Pracownika"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2 rounded-lg text-white shadow-sm">
                            <Leaf size={20} className="fill-white/20"/>
                        </div>
                        <span className={`font-bold text-lg tracking-tight hidden md:block ${theme.highlight}`}>EBS Wellbeing</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`hidden md:flex flex-col items-end mr-2`}>
                        <span className="text-[10px] font-bold uppercase text-slate-400">Twoje Saldo</span>
                        <span className={`font-mono font-bold text-sm ${theme.accent}`}>{balance} PKT</span>
                    </div>

                    <button 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`p-2.5 rounded-xl transition border border-transparent hover:bg-slate-100 hover:border-slate-200 ${theme.textSec}`}
                    >
                        {isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}
                    </button>
                    
                    <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                        <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">
                            {currentUser.name.charAt(0)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-5xl mx-auto p-4 md:p-8">
                    {/* Render active view based on state */}
                    {viewMode === 'DASHBOARD' && renderDashboard()}
                    {viewMode === 'CHECKIN' && <CheckInFlow theme={theme} setViewMode={setViewMode} mood={mood} setMood={setMood} stress={stress} setStress={setStress} energy={energy} setEnergy={setEnergy} dailyBurden={dailyBurden} setDailyBurden={setDailyBurden} submitCheckIn={handleSubmitCheckIn} />}
                    {viewMode === 'SOS' && <SOSView activeProgram={activeSosProgram} setViewMode={setViewMode} />}
                    {viewMode === 'COACH' && <AICoachView currentUser={currentUser} balance={balance} sendMessage={onSpend} setViewMode={setViewMode} theme={theme} isOLED={isDarkMode} checkInDone={checkInDone} mood={mood} stress={stress} energy={energy} dailyBurden={dailyBurden} isSubscribed={true} />}
                    {viewMode === 'FOCUS' && <FocusFlowSession theme={theme} setViewMode={setViewMode} />}
                    {viewMode === 'LIBRARY' && <PremiumLibraryView balance={balance} sendMessage={onSpend} setViewMode={setViewMode} theme={theme} unlockedContent={unlockedContent} setUnlockedContent={setUnlockedContent} isSubscribed={true} />}
                    {viewMode === 'JOURNAL' && <JournalView theme={theme} setViewMode={setViewMode} />}
                    {viewMode === 'GRATITUDE' && <GratitudeView theme={theme} setViewMode={setViewMode} />}
                    {viewMode === 'PROGRAM' && <ProgramView theme={theme} setViewMode={setViewMode} />}
                    {viewMode === 'TEAM' && <TeamPulseView theme={theme} setViewMode={setViewMode} />}
                </div>
            </div>

            {/* Mobile Bottom Navigation (Native App Feel) */}
            {viewMode === 'DASHBOARD' && (
                <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 pb-safe flex justify-between items-center z-40 ${isDarkMode ? 'bg-slate-950 border-slate-800' : ''}`}>
                    <button className="flex flex-col items-center gap-1 text-emerald-600">
                        <Layout size={24}/>
                        <span className="text-[10px] font-bold">Pulpit</span>
                    </button>
                    <button onClick={() => setViewMode('LIBRARY')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600">
                        <Compass size={24}/>
                        <span className="text-[10px] font-medium">Odkrywaj</span>
                    </button>
                    <button onClick={() => setViewMode('CHECKIN')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600">
                        <Activity size={24}/>
                        <span className="text-[10px] font-medium">Raport</span>
                    </button>
                </div>
            )}
        </div>
    );
};
