
import React from 'react';
import { Grid3X3, Zap } from 'lucide-react';

interface StressHeatmapProps {
    isOLED: boolean;
    theme: any;
    checkInDone: boolean;
    stress: number;
}

export const StressHeatmap = ({ isOLED, theme, checkInDone, stress }: StressHeatmapProps) => {
    // Dynamic Heatmap based on current check-in (simulated history)
    const generateDynamicHeatmap = () => {
        const base = [
            [1, 2, 4, 1], [2, 4, 5, 2], [1, 2, 3, 1],
            [1, 1, 2, 1], [1, 2, 4, 3], [0, 0, 1, 0], [0, 1, 3, 4]
        ];
        // If check-in just done, update "Today" (Assuming Tuesday for demo)
        if (checkInDone) {
            base[1][1] = stress; // Set Tuesday Noon to current stress
        }
        return base;
    };

    const heatData = generateDynamicHeatmap();
    const days = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
    const times = ['Rano', '12:00', '16:00', 'Noc'];

    return (
        <div className={`p-6 rounded-2xl ${theme.card} relative overflow-hidden group`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className={`text-lg font-bold ${isOLED ? 'text-white' : 'text-white'}`}>Biorytm Stresu</h3>
                    <p className={`text-xs ${theme.textSec}`}>Analiza wzorców napięcia (30 dni).</p>
                </div>
                <Grid3X3 className="text-indigo-500 opacity-50" size={20}/>
            </div>

            <div className="flex gap-2">
                <div className="flex flex-col justify-between py-1">
                    {days.map(d => <span key={d} className="text-[10px] text-slate-500 font-bold uppercase h-4 leading-4">{d}</span>)}
                </div>
                <div className="flex-1 grid grid-cols-4 gap-1">
                    {heatData.map((dayRow, dIdx) => (
                        <React.Fragment key={dIdx}>
                            {dayRow.map((val, tIdx) => {
                                // Heatmap Logic
                                let bg = isOLED ? 'bg-[#111]' : 'bg-black/20';
                                let shadow = '';
                                if (val === 2) bg = 'bg-indigo-900/60';
                                if (val === 3) bg = 'bg-indigo-600/80';
                                if (val === 4) {
                                    bg = 'bg-violet-500';
                                    shadow = isOLED ? 'shadow-[0_0_10px_rgba(139,92,246,0.6)]' : '';
                                }
                                if (val >= 5) {
                                    bg = 'bg-fuchsia-500';
                                    shadow = isOLED ? 'shadow-[0_0_15px_rgba(217,70,239,0.8)]' : '';
                                }

                                return (
                                    <div 
                                        key={`${dIdx}-${tIdx}`} 
                                        className={`h-4 rounded-sm transition-all hover:scale-110 cursor-default ${bg} ${shadow}`}
                                        title={`Stres: ${val}/5`}
                                    ></div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            
            {/* X Axis Labels */}
            <div className="flex justify-between pl-6 mt-2">
                {times.map(t => <span key={t} className="text-[9px] text-slate-600 uppercase font-mono w-1/4 text-center">{t}</span>)}
            </div>

            <div className={`mt-4 pt-4 border-t ${isOLED ? 'border-white/10' : 'border-white/5'}`}>
                <div className="flex items-start gap-2">
                    <Zap size={14} className="text-fuchsia-500 mt-0.5"/>
                    <div>
                        <p className={`text-xs ${isOLED ? 'text-slate-300' : 'text-slate-200'}`}>
                            Twoje krytyczne okno to <strong className="text-fuchsia-400">Wtorek 14:00 - 16:00</strong>.
                        </p>
                        <p className="text-xs text-slate-500">Zalecana sesja: "Reset 90 sekund" przed spotkaniem.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
