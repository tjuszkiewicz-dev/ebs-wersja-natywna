
import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Pause } from 'lucide-react';
import { FOCUS_TRACKS } from './constants';

interface FocusRadioWidgetProps {
    theme: any;
}

export const FocusRadioWidget = ({ theme }: FocusRadioWidgetProps) => {
    const [activeTrack, setActiveTrack] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.loop = true;
        }

        const audio = audioRef.current;

        if (activeTrack) {
            const track = FOCUS_TRACKS.find(t => t.id === activeTrack);
            if (track && audio.src !== track.src) {
                audio.src = track.src;
                audio.load();
            }
            
            if (isPlaying) {
                audio.play().catch(e => console.log('Autoplay prevented:', e));
            } else {
                audio.pause();
            }
        } else {
            audio.pause();
        }

        return () => {
            // Cleanup on unmount not strictly necessary for global audio, but good practice if widget hides
            if (audio) audio.pause();
        };
    }, [activeTrack, isPlaying]);

    return (
        <div className={`p-5 rounded-2xl ${theme.card} relative overflow-hidden group`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isPlaying ? 'bg-amber-500 text-white animate-pulse' : 'bg-surface border border-border text-slate-400'}`}>
                        <Volume2 size={20}/>
                    </div>
                    <div>
                        <h4 className={`font-bold text-sm ${theme.highlight}`}>Focus Radio</h4>
                        <p className={`text-[10px] ${theme.textSec}`}>{activeTrack ? FOCUS_TRACKS.find(t => t.id === activeTrack)?.name : 'Wybierz tło'}</p>
                    </div>
                </div>
                {activeTrack && (
                    <button onClick={() => setIsPlaying(!isPlaying)} className={`hover:scale-110 transition-transform ${theme.highlight}`}>
                        {isPlaying ? <Pause size={24} className="fill-current"/> : <Play size={24} className="fill-current"/>}
                    </button>
                )}
            </div>
            
            <div className="space-y-2 relative z-10">
                {FOCUS_TRACKS.map(track => (
                    <button 
                        key={track.id}
                        onClick={() => { setActiveTrack(track.id); setIsPlaying(true); }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${activeTrack === track.id ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20' : `${theme.textSec} hover:bg-surface hover:text-foreground`}`}
                    >
                        <span>{track.name}</span>
                        {activeTrack === track.id && isPlaying && (
                            <div className="flex gap-0.5 h-3 items-end">
                                <div className="w-0.5 bg-amber-400 animate-[bounce_1s_infinite] h-full"></div>
                                <div className="w-0.5 bg-amber-400 animate-[bounce_1.2s_infinite] h-2/3"></div>
                                <div className="w-0.5 bg-amber-400 animate-[bounce_0.8s_infinite] h-1/2"></div>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
