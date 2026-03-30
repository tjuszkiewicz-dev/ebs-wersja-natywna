
import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { SOS_SCENARIOS } from './constants';

interface SOSViewProps {
    activeProgram: any;
    setViewMode: (mode: any) => void;
}

const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
};

export const SOSView = ({ activeProgram, setViewMode }: SOSViewProps) => {
    const program = activeProgram || SOS_SCENARIOS[0];
    const [breathPhase, setBreathPhase] = useState('Wdech');
    const [sosTimer, setSosTimer] = useState(90);

    useEffect(() => {
        let interval: any;
        
        if (program.id === 'stress') {
            interval = setInterval(() => {
                setSosTimer(t => t > 0 ? t - 1 : 0);
            }, 1000);
        } else {
            // Breathing Logic
            const cycle = () => {
                setBreathPhase(p => {
                    if (p === 'Wdech') {
                        triggerHaptic(50); // Hold click
                        return 'Zatrzymaj';
                    } else if (p === 'Zatrzymaj') {
                        triggerHaptic(200); // Exhale hum
                        return 'Wydech';
                    } else {
                        triggerHaptic([20, 30, 40, 50]); // Inhale rise
                        return 'Wdech';
                    }
                });
            };
            
            // Initial trigger
            triggerHaptic([30, 50, 30, 50, 40, 50, 50]);
            
            interval = setInterval(cycle, 4000);
        }

        return () => clearInterval(interval);
    }, [program.id]);

    return (
        <div className={`h-full flex flex-col items-center justify-center animate-fade-in p-6 relative overflow-hidden transition-colors duration-1000 ${program.activeBg}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${program.activeGradient} opacity-50`}></div>
            <button onClick={() => setViewMode('DASHBOARD')} className="absolute top-6 right-6 z-20 text-white/50 hover:text-white bg-black/20 p-2 rounded-full backdrop-blur-md"><X size={24}/></button>

            <div className="relative z-10 text-center">
                <div className={`w-24 h-24 rounded-full border-4 ${program.ringColor} flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_currentColor] ${program.text} animate-pulse`}>
                    <program.icon size={48} />
                </div>
                <h2 className="text-4xl font-bold text-white mb-2">{program.label}</h2>
                <p className="text-xl text-white/80 mb-12">{program.sub}</p>
                
                {program.id === 'stress' ? (
                        <div className="text-6xl font-mono font-bold text-white tracking-wider mb-8 tabular-nums">
                            0:{sosTimer.toString().padStart(2, '0')}
                        </div>
                ) : (
                        <div className="mb-12">
                            <div className="text-2xl font-bold text-white mb-2 uppercase tracking-widest">{breathPhase}</div>
                            <div className="w-64 h-2 bg-white/20 rounded-full mx-auto overflow-hidden">
                                <div className={`h-full bg-white transition-all duration-[4000ms] ease-linear ${breathPhase === 'Wdech' ? 'w-full' : breathPhase === 'Wydech' ? 'w-0' : 'w-full'}`}></div>
                            </div>
                        </div>
                )}

                <div className="bg-black/30 backdrop-blur-md p-6 rounded-2xl max-w-md mx-auto border border-white/10 text-white/90 text-sm leading-relaxed">
                    Skup się na animacji. Podążaj za rytmem. To minie. Jesteś bezpieczny.
                </div>
                
                <div className="mt-8 flex items-center justify-center gap-2 text-xs text-white/30">
                    <Smartphone size={14}/>
                    {typeof navigator !== 'undefined' && navigator.vibrate ? 'Haptyka aktywna' : 'Haptyka niedostępna'}
                </div>
            </div>
        </div>
    );
};
