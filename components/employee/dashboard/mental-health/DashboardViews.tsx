
import React from 'react';
import { X, ChevronLeft, BookOpen, ArrowRight, CheckCircle, Heart, BarChart3, Activity } from 'lucide-react';

// --- CheckInFlow ---
export const CheckInFlow = ({ theme, mood, setMood, stress, setStress, energy, setEnergy, dailyBurden, setDailyBurden, submitCheckIn, setViewMode }: any) => (
    <div className="h-full flex flex-col items-center justify-center animate-fade-in p-4">
         <div className={`max-w-lg w-full p-8 rounded-3xl ${theme.card} relative`}>
             <button onClick={() => setViewMode('DASHBOARD')} className={`absolute top-6 right-6 ${theme.textSec} hover:text-foreground`}><X size={24}/></button>
             <h2 className={`text-2xl font-bold mb-6 ${theme.highlight}`}>Codzienny Check-in</h2>
             
             <div className="space-y-6">
                 <div>
                     <label className={`text-xs uppercase font-bold ${theme.textSec} mb-2 block`}>Nastrój ({mood}/5)</label>
                     <input type="range" min="1" max="5" value={mood} onChange={e => setMood(Number(e.target.value))} className="w-full accent-teal-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                     <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>Źle</span><span>Wspaniale</span></div>
                 </div>
                 <div>
                     <label className={`text-xs uppercase font-bold ${theme.textSec} mb-2 block`}>Poziom Stresu ({stress}/5)</label>
                     <input type="range" min="1" max="5" value={stress} onChange={e => setStress(Number(e.target.value))} className="w-full accent-rose-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                     <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>Luz</span><span>Panika</span></div>
                 </div>
                 <div>
                     <label className={`text-xs uppercase font-bold ${theme.textSec} mb-2 block`}>Energia ({energy}/5)</label>
                     <input type="range" min="1" max="5" value={energy} onChange={e => setEnergy(Number(e.target.value))} className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                     <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>Wyczerpanie</span><span>Moc</span></div>
                 </div>
                 <div>
                     <label className={`text-xs uppercase font-bold ${theme.textSec} mb-2 block`}>Co Cię dziś obciąża? (Opcjonalne)</label>
                     <textarea 
                        value={dailyBurden}
                        onChange={e => setDailyBurden(e.target.value)}
                        className={`w-full rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${theme.input}`}
                        rows={2}
                        placeholder="Krótka notatka..."
                     />
                 </div>
                 
                 <button onClick={submitCheckIn} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all">
                     Zapisz
                 </button>
             </div>
         </div>
    </div>
);

// --- ProgramView ---
export const ProgramView = ({ theme, setViewMode }: any) => (
    <div className="animate-fade-in pt-6 space-y-6">
        <div className="flex items-center gap-4 px-4 md:px-0">
            <button onClick={() => setViewMode('DASHBOARD')} className={`p-2 rounded-lg transition-colors ${theme.textSec} hover:text-foreground hover:bg-surface/50`}>
                <ChevronLeft size={24}/>
            </button>
            <h2 className={`text-2xl font-bold ${theme.highlight}`}>Baza Wiedzy (Free)</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-0">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className={`p-6 rounded-2xl ${theme.card} hover:bg-surface/50 transition-colors cursor-pointer group`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-200 dark:bg-slate-700/50 rounded-xl text-slate-500 dark:text-slate-300 group-hover:text-foreground dark:group-hover:text-white transition-colors">
                            <BookOpen size={24}/>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-foreground-muted">Artykuł</span>
                    </div>
                    <h3 className={`font-bold mb-2 ${theme.highlight}`}>Techniki radzenia sobie ze stresem #{i}</h3>
                    <p className={`text-xs ${theme.textSec} mb-4`}>Krótki przewodnik po metodach relaksacji w biurze.</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-teal-500 font-bold transition-colors">
                        Czytaj <ArrowRight size={14}/>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// --- JournalView ---
export const JournalView = ({ theme, setViewMode }: any) => (
    <div className="h-full flex flex-col animate-fade-in pt-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4 px-4 md:px-0">
            <button onClick={() => setViewMode('DASHBOARD')} className={`p-2 rounded-lg transition-colors ${theme.textSec} hover:text-foreground hover:bg-surface/50`}>
                <ChevronLeft size={24}/>
            </button>
            <h2 className={`text-lg font-bold flex items-center gap-2 ${theme.highlight}`}><BookOpen size={18} className="text-emerald-400"/> Dziennik Myśli</h2>
            <button className="text-sm font-bold text-emerald-500 hover:text-emerald-400">Historia</button>
        </div>

        <div className={`flex-1 rounded-2xl p-6 flex flex-col gap-4 ${theme.card}`}>
            <div className="text-sm text-foreground-muted font-mono">{new Date().toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <textarea 
                className={`flex-1 w-full bg-transparent resize-none outline-none ${theme.highlight} text-lg leading-relaxed placeholder-slate-500`}
                placeholder="Zacznij pisać... Co dziś zajmuje Twoje myśli?"
                autoFocus
            />
            <div className="flex justify-end">
                <button onClick={() => { alert('Zapisano w pamięci lokalnej (szyfrowane).'); setViewMode('DASHBOARD'); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                    <CheckCircle size={18}/> Zapisz Wpis
                </button>
            </div>
        </div>
    </div>
);

// --- GratitudeView ---
export const GratitudeView = ({ theme, setViewMode }: any) => (
    <div className="h-full flex items-center justify-center animate-fade-in p-4">
         <div className={`max-w-md w-full p-8 rounded-3xl ${theme.card} relative`}>
             <button onClick={() => setViewMode('DASHBOARD')} className={`absolute top-6 right-6 ${theme.textSec} hover:text-foreground`}><X size={24}/></button>
             <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-6 text-amber-400 mx-auto">
                 <Heart size={32} className="fill-current"/>
             </div>
             <h2 className={`text-2xl font-bold mb-2 text-center ${theme.highlight}`}>Dziennik Wdzięczności</h2>
             <p className={`text-sm text-center mb-8 ${theme.textSec}`}>Wymień 3 rzeczy, za które jesteś dziś wdzięczny.</p>
             
             <div className="space-y-4">
                 {[1, 2, 3].map(i => (
                     <div key={i} className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold font-mono">{i}.</span>
                         <input type="text" className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${theme.input}`} placeholder="Jestem wdzięczny za..."/>
                     </div>
                 ))}
                 
                 <button onClick={() => { alert('Wspaniale! Budujesz pozytywne nawyki.'); setViewMode('DASHBOARD'); }} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all mt-4">
                     Zapisz
                 </button>
             </div>
         </div>
    </div>
);

// --- TeamPulseView ---
export const TeamPulseView = ({ theme, setViewMode }: any) => (
    <div className="animate-fade-in pt-6 space-y-6">
        <div className="flex items-center gap-4 px-4 md:px-0">
            <button onClick={() => setViewMode('DASHBOARD')} className={`p-2 rounded-lg transition-colors ${theme.textSec} hover:text-foreground hover:bg-surface/50`}>
                <ChevronLeft size={24}/>
            </button>
            <h2 className={`text-2xl font-bold ${theme.highlight}`}>Team Pulse (Manager View)</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 md:px-0">
            <div className={`p-6 rounded-2xl ${theme.card}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme.highlight}`}><BarChart3 size={20} className="text-indigo-400"/> Średni Poziom Stresu</h3>
                <div className="h-64 flex items-end justify-between gap-2 px-4 border-b border-border pb-2">
                    {[40, 65, 30, 80, 55, 45, 60].map((h, i) => (
                        <div key={i} className="w-full bg-indigo-500/20 hover:bg-indigo-500/40 rounded-t-lg relative group transition-all" style={{height: `${h}%`}}>
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">{h}%</div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500 font-mono">
                    <span>Pn</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pt</span><span>Sb</span><span>Nd</span>
                </div>
            </div>

            <div className={`p-6 rounded-2xl ${theme.card}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme.highlight}`}><Activity size={20} className="text-teal-400"/> Udział w Programach</h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400"><span>Mindfulness</span><span>78%</span></div>
                        <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-teal-500 w-[78%]"></div></div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400"><span>CBT Tools</span><span>45%</span></div>
                        <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 w-[45%]"></div></div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400"><span>Premium Video</span><span>12%</span></div>
                        <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-orange-500 w-[12%]"></div></div>
                    </div>
                </div>
                <div className={`mt-8 p-4 rounded-xl border border-border ${theme.bg === 'bg-black' ? 'bg-white/5' : 'bg-surface/50'}`}>
                    <h4 className={`font-bold text-sm mb-1 ${theme.highlight}`}>Rekomendacja AI</h4>
                    <p className={`text-xs ${theme.textSec}`}>Zespół wykazuje podwyższony stres w czwartki. Rozważ "Ciche Godziny" w czwartkowe poranki.</p>
                </div>
            </div>
        </div>
    </div>
);
