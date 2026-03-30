
import { Anchor, ThermometerSnowflake, Moon } from 'lucide-react';

export const SOS_SCENARIOS = [
    { 
        id: 'panic', 
        label: 'Panikuję', 
        sub: 'Grounding 5-4-3-2-1', 
        icon: Anchor, 
        gradient: 'from-rose-500/20 to-orange-600/20',
        border: 'border-rose-500/30 hover:border-rose-500',
        text: 'text-rose-200',
        iconColor: 'text-rose-400',
        activeBg: 'bg-rose-950',
        activeGradient: 'from-rose-900/40 to-black',
        ringColor: 'border-rose-500'
    },
    { 
        id: 'stress', 
        label: 'Zalewa mnie stres', 
        sub: 'Reset 90 sekund', 
        icon: ThermometerSnowflake, 
        gradient: 'from-blue-500/20 to-cyan-600/20',
        border: 'border-blue-500/30 hover:border-blue-500',
        text: 'text-blue-200',
        iconColor: 'text-blue-400',
        activeBg: 'bg-blue-950',
        activeGradient: 'from-blue-900/40 to-black',
        ringColor: 'border-blue-500'
    },
    { 
        id: 'insomnia', 
        label: 'Nie mogę zasnąć', 
        sub: 'Skan ciała (NSDR)', 
        icon: Moon, 
        gradient: 'from-indigo-500/20 to-violet-600/20',
        border: 'border-indigo-500/30 hover:border-indigo-500',
        text: 'text-indigo-200',
        iconColor: 'text-indigo-400',
        activeBg: 'bg-indigo-950',
        activeGradient: 'from-indigo-900/40 to-black',
        ringColor: 'border-indigo-500'
    },
];

export const FOCUS_TRACKS = [
    { id: 'white_noise', name: 'Biały Szum', type: 'Maskowanie', src: 'https://cdn.pixabay.com/download/audio/2022/11/04/audio_9069d56968.mp3' },
    { id: 'rain', name: 'Deszcz (Lo-Fi)', type: 'Relaks', src: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_03e6e8e4db.mp3' },
    { id: 'binaural', name: '40Hz Binaural Beats', type: 'Głęboki Focus', src: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3' },
];

export const PREMIUM_CONTENT = [
    { id: 'master_burnout', type: 'MASTERCLASS', title: 'Wypalenie Zawodowe: Protokół Wyjścia', author: 'Dr Anna S.', duration: '45 min', price: 50, color: 'text-orange-400', bg: 'bg-orange-500/10', videoId: 'dQw4w9WgXcQ' },
    { id: 'master_sleep', type: 'MASTERCLASS', title: 'Sen Polifazowy dla Managerów', author: 'Marek Z.', duration: '60 min', price: 40, color: 'text-indigo-400', bg: 'bg-indigo-500/10', videoId: 'dQw4w9WgXcQ' },
    { id: 'soma_tre', type: 'SOMATIC', title: 'TRE: Uwalnianie Napięcia', author: 'Studio Ciało', duration: '15 min', price: 10, color: 'text-emerald-400', bg: 'bg-emerald-500/10', videoId: 'dQw4w9WgXcQ' },
    { id: 'soma_vagus', type: 'SOMATIC', title: 'Masaż Nerwu Błędnego', author: 'Fizjo Pro', duration: '10 min', price: 10, color: 'text-teal-400', bg: 'bg-teal-500/10', videoId: 'dQw4w9WgXcQ' },
];
