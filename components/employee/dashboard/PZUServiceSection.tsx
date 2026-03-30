import React, { useState } from 'react';
import { Car, Home, Plane, Heart, Stethoscope, GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../../ui/Button';

interface PZUServiceSectionProps {
    onCheckOffer: (category: string) => void;
}

type PZUTab = 'OC/AC' | 'DOM' | 'WOJAŻER' | 'ZDROWIE' | 'EDUKACJA';

export const PZUServiceSection: React.FC<PZUServiceSectionProps> = ({ onCheckOffer }) => {
    const [activeTab, setActiveTab] = useState<PZUTab>('OC/AC');

    const renderHeroContent = () => {
        switch (activeTab) {
            case 'OC/AC':
                return {
                    title: 'Sprawdź ofertę ubezpieczenia OC/AC',
                    desc: 'Podaj numer rejestracyjny i poznaj cenę w 3 minuty.',
                    icon: <Car size={64} className="text-blue-100" />,
                    color: 'bg-blue-600'
                };
            case 'DOM':
                return {
                    title: 'Ubezpiecz swój dom lub mieszkanie',
                    desc: 'Chroń swój majątek od zdarzeń losowych i kradzieży.',
                    icon: <Home size={64} className="text-blue-100" />,
                    color: 'bg-indigo-600'
                };
            case 'WOJAŻER':
                return {
                    title: 'Bezpieczne podróże małe i duże',
                    desc: 'Koszty leczenia i assistance w podróży zagranicznej.',
                    icon: <Plane size={64} className="text-blue-100" />,
                    color: 'bg-sky-600'
                };
            case 'ZDROWIE':
                return {
                    title: 'Zadbaj o zdrowie swoje i bliskich',
                    desc: 'Pakiety medyczne i wsparcie w razie choroby.',
                    icon: <Stethoscope size={64} className="text-blue-100" />,
                    color: 'bg-teal-600'
                };
            case 'EDUKACJA':
                return {
                    title: 'Bezpieczna szkoła i studia',
                    desc: 'Ubezpieczenie NNW dla dzieci i młodzieży uczącej się.',
                    icon: <GraduationCap size={64} className="text-blue-100" />,
                    color: 'bg-rose-600'
                };
            default:
                return { title: '', desc: '', icon: null, color: '' };
        }
    };

    const hero = renderHeroContent();

    return (
        <div className="bg-white px-6 pb-6 pt-2 rounded-2xl shadow-sm border border-slate-100 mb-8 overflow-hidden relative">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <div className="flex items-center gap-0 mb-0 -mt-4">
                        <img 
                            src="https://www.pbd.org.pl/wp-content/uploads/2019/02/pzu.png" 
                            alt="PZU" 
                            className="w-32 h-32 object-contain -ml-2"
                        />
                        <h2 className="text-xl font-bold text-slate-800 -ml-2">Ubezpieczenia PZU</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-[-10px]">Specjalne zniżki pracownicze na pakiety ubezpieczeń.</p>
                </div>
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">PARTNER</span>
            </div>

             {/* BLUE SEPARATOR LINE */}
             <div className="h-0.5 bg-blue-600 mb-6 rounded-full opacity-80 shadow-[0_0_10px_rgba(37,99,235,0.1)] relative z-10"></div>

            {/* Main Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-100 relative z-10">
                {(['OC/AC', 'DOM', 'WOJAŻER', 'ZDROWIE', 'EDUKACJA'] as PZUTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                            activeTab === tab 
                            ? 'border-blue-600 text-blue-600' 
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Hero Card */}
            <div className={`rounded-xl p-8 mb-8 text-white relative overflow-hidden transition-colors duration-500 ${hero.color}`}>
                <div className="absolute right-0 top-0 h-full w-1/2 bg-white/10 skew-x-12 transform origin-bottom translate-x-12"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="max-w-md">
                        <h3 className="text-2xl font-bold mb-2">{hero.title}</h3>
                        <p className="text-blue-100 mb-6">{hero.desc}</p>
                        
                        {activeTab === 'OC/AC' && (
                            <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm mb-4 border border-white/20">
                                <label className="text-xs text-blue-200 block mb-1">Numer rejestracyjny</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="KR 12345" 
                                        className="bg-white text-slate-800 px-3 py-2 rounded font-bold w-32 uppercase focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                    <button 
                                        onClick={() => onCheckOffer(activeTab)}
                                        className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold px-4 py-2 rounded transition-colors whitespace-nowrap"
                                    >
                                        OBLICZ SKŁADKĘ
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab !== 'OC/AC' && (
                             <button 
                                onClick={() => onCheckOffer(activeTab)}
                                className="bg-white text-slate-900 font-bold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors shadow-lg"
                            >
                                SPRAWDŹ OFERTĘ
                            </button>
                        )}
                    </div>
                    
                    <div className="hidden md:block opacity-90 transform scale-110 min-w-[400px] flex justify-end">
                        {activeTab === 'OC/AC' && (
                            <div className="w-[400px] h-[250px] relative rounded-lg overflow-hidden shadow-2xl skew-x-12 border-4 border-white/20">
                                <img 
                                    src="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&q=80&w=800" 
                                    alt="Samochód" 
                                    className="w-full h-full object-cover -skew-x-12 scale-125"
                                />
                                <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay -skew-x-12"></div>
                            </div>
                        )}
                        
                        {activeTab === 'DOM' && (
                             <div className="w-[400px] h-[250px] relative rounded-lg overflow-hidden shadow-2xl skew-x-12 border-4 border-white/20">
                                <img 
                                    src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800" 
                                    alt="Nowoczesny Dom" 
                                    className="w-full h-full object-cover -skew-x-12 scale-125"
                                />
                                <div className="absolute inset-0 bg-indigo-900/10 mix-blend-overlay -skew-x-12"></div>
                            </div>
                        )}

                        {activeTab === 'WOJAŻER' && (
                             <div className="w-[400px] h-[250px] relative rounded-lg overflow-hidden shadow-2xl skew-x-12 border-4 border-white/20">
                                <img 
                                    src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=800" 
                                    alt="Podróże" 
                                    className="w-full h-full object-cover -skew-x-12 scale-125"
                                />
                                <div className="absolute inset-0 bg-sky-900/10 mix-blend-overlay -skew-x-12"></div>
                            </div>
                        )}

                        {activeTab === 'ZDROWIE' && (
                             <div className="w-[400px] h-[250px] relative rounded-lg overflow-hidden shadow-2xl skew-x-12 border-4 border-white/20">
                                <img 
                                    src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=800" 
                                    alt="Zdrowie" 
                                    className="w-full h-full object-cover -skew-x-12 scale-125"
                                />
                                <div className="absolute inset-0 bg-teal-900/10 mix-blend-overlay -skew-x-12"></div>
                            </div>
                        )}

                        {activeTab === 'EDUKACJA' && (
                             <div className="w-[400px] h-[250px] relative rounded-lg overflow-hidden shadow-2xl skew-x-12 border-4 border-white/20">
                                <img 
                                    src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=800" 
                                    alt="Edukacja" 
                                    className="w-full h-full object-cover -skew-x-12 scale-125"
                                />
                                <div className="absolute inset-0 bg-rose-900/10 mix-blend-overlay -skew-x-12"></div>
                            </div>
                        )}

                        {activeTab !== 'OC/AC' && activeTab !== 'DOM' && activeTab !== 'WOJAŻER' && activeTab !== 'ZDROWIE' && activeTab !== 'EDUKACJA' && (
                            <div className="pr-12">
                                {hero.icon}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <h4 className="font-bold text-slate-800 mb-4 px-1 text-lg">Szybki Wybór Ubezpieczenia</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                    { label: 'Mój Samochód', desc: 'OC/AC/NNW', icon: <Car size={28}/>, id: 'OC/AC', gradient: 'from-blue-500 to-blue-600' },
                    { label: 'Mój Dom', desc: 'Majątek i OC', icon: <Home size={28}/>, id: 'DOM', url: 'https://moje.pzu.pl/pzu/property-survey?cna=house&mcid=p_pzu_pl&cid=sg_fastform_dom&_gl=1*1ln8a9c*_gcl_aw*R0NMLjE3NzE1MDAwODYuQ2owS0NRaUFodHZNQmhEQkFSSXNBTDI2cGpFS2oxQ01SSkUzaXEyZTI5cW9OcHFrSUFhV05KbFk0N01aX29jTzduekhWSU5SLUxQZ1l5MGFBdEQyRUFMd193Y0I.*_gcl_dc*R0NMLjE3NzE1MDAwODYuQ2owS0NRaUFodHZNQmhEQkFSSXNBTDI2cGpFS2oxQ01SSkUzaXEyZTI5cW9OcHFrSUFhV05KbFk0N01aX29jTzduekhWSU5SLUxQZ1l5MGFBdEQyRUFMd193Y0I.*_gcl_au*ODQwNTIyOTE4LjE3NzE1MDAwMTU.', gradient: 'from-indigo-500 to-indigo-600' },
                    { label: 'Podróże', desc: 'Polska i Świat', icon: <Plane size={28}/>, id: 'WOJAŻER', url: 'https://moje.pzu.pl/pzu/travel/policy-details?mcid=p_pzu_pl&cid=sg_fastform_travel&direction=POLAND&_gl=1*1arqxhp*_gcl_aw*R0NMLjE3NzE1MDA1MzcuQ2owS0NRaUFodHZNQmhEQkFSSXNBTDI2cGpFS2oxQ01SSkUzaXEyZTI5cW9OcHFrSUFhV05KbFk0N01aX29jTzduekhWSU5SLUxQZ1l5MGFBdEQyRUFMd193Y0I.*_gcl_dc*R0NMLjE3NzE1MDA1MzcuQ2owS0NRaUFodHZNQmhEQkFSSXNBTDI2cGpFS2oxQ01SSkUzaXEyZTI5cW9OcHFrSUFhV05KbFk0N01aX29jTzduekhWSU5SLUxQZ1l5MGFBdEQyRUFMd193Y0I.*_gcl_au*ODQwNTIyOTE4LjE3NzE1MDAwMTU.&processId=pakenc_SkqUvByma7_UdaSEzMOt2dGY9iccc6LoHgXM6ILMpbCjvh2H3i97n-Ypp3_c6VSSrFn5aGtm', gradient: 'from-sky-500 to-sky-600' },
                    { label: 'Zdrowie', desc: 'Pakiety Medyczne', icon: <Stethoscope size={28}/>, id: 'ZDROWIE', url: 'https://moje.pzu.pl/sales/package-subscription/list', gradient: 'from-teal-500 to-teal-600' },
                    { label: 'Edukacja', desc: 'NNW Szkolne', icon: <GraduationCap size={28}/>, id: 'SZKOLA', url: 'https://moje.pzu.pl/sales/generic/education?mcid=mp_mpz', gradient: 'from-rose-500 to-rose-600' }
                ].map((item) => (
                    <div 
                        key={item.label}
                        onClick={() => item.url ? window.open(item.url, '_blank') : onCheckOffer(item.id)}
                        className="relative bg-white border border-slate-100 rounded-2xl p-5 hover:border-blue-300 hover:shadow-2xl hover:-translate-y-1.5 cursor-pointer transition-all duration-300 group flex flex-col items-start justify-between min-h-[160px] overflow-visible"
                    >
                         {/* Glow Underneath */}
                         <div className={`absolute -bottom-4 left-4 right-4 h-4 bg-gradient-to-r ${item.gradient} rounded-[100%] blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300 -z-10`}></div>

                        {/* Top Animated Bar */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${item.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20 rounded-t-2xl`}></div>

                        {/* Background Decoration */}
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${item.gradient} rounded-bl-full opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
                        
                        {/* Icon Container */}
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 mb-4`}>
                            {item.icon}
                        </div>

                        {/* Text Content */}
                        <div className="z-10 w-full">
                            <h5 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">{item.label}</h5>
                            <p className="text-xs text-slate-400 group-hover:text-slate-500 transition-colors mt-1">{item.desc}</p>
                        </div>

                        {/* Hover Action */}
                        <div className="absolute bottom-5 right-5 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                             <div className={`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600`}>
                                <ArrowRight size={16} />
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
