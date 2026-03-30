import React, { useState } from 'react';
import { ServiceItem } from '../../../types';
import { Wifi, Smartphone, Heart, ArrowRight } from 'lucide-react';
import { Button } from '../../ui/Button';

interface OrangeOfferSectionProps {
    services: ServiceItem[];
    onPurchase: (service: ServiceItem) => void;
}

type OrangeTab = 'ALL' | 'INTERNET' | 'ABONAMENT' | 'TV' | 'LOVE';

export const OrangeOfferSection: React.FC<OrangeOfferSectionProps> = ({ services, onPurchase }) => {
    const [activeTab, setActiveTab] = useState<OrangeTab>('ALL');

    // Filter only Orange services
    // Fallback to hardcoded if not present in services prop (for redundancy)
    let orangeServices = services.filter(s => s.id.startsWith('SRV-ORANGE'));
    if (orangeServices.length === 0) {
        orangeServices = [
          { 
              id: 'SRV-ORANGE-FIBER', 
              name: 'Światłowód Pro 2.0', 
              description: 'Super szybki internet światłowodowy do Twojego domu.', 
              price: 59, 
              type: 'SUBSCRIPTION' as any, 
              icon: 'Wifi' as any, 
              isActive: true 
          },
          { 
              id: 'SRV-ORANGE-GSM', 
              name: 'Plan Firmowy L', 
              description: 'Nielimitowane rozmowy i SMSy, duży pakiet danych.', 
              price: 45, 
              type: 'SUBSCRIPTION' as any, 
              icon: 'Smartphone' as any, 
              isActive: true 
          },
          { 
              id: 'SRV-ORANGE-LOVE', 
              name: 'Orange Love Mini', 
              description: 'Pakiet usług dla całej rodziny w jednej cenie.', 
              price: 89, 
              type: 'SUBSCRIPTION' as any, 
              icon: 'Heart' as any, 
              isActive: true 
          }
        ];
    }
    
    // Safety check just in case
    if (!orangeServices) orangeServices = [];

    const filteredServices = orangeServices.filter(s => {
        if (activeTab === 'ALL') return true;
        if (activeTab === 'INTERNET' && s.id.includes('FIBER')) return true;
        if (activeTab === 'ABONAMENT' && s.id.includes('GSM')) return true;
        if (activeTab === 'LOVE' && s.id.includes('LOVE')) return true;
        return false;
    });

    return (
        <div className="rounded-2xl shadow-sm border border-slate-200 mb-8 font-sans overflow-hidden">
            
            {/* HERDER - BLACK */}
            <div className="bg-black p-8 relative overflow-hidden">
                {/* Ambient Background Glow */}
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/20 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end relative z-10 gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-orange-500 flex items-center justify-center">
                                <span className="text-black text-xs font-bold">TM</span>
                            </div>
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">OFERTA <span className="text-orange-500">ORANGE</span></h2>
                        </div>
                        <p className="text-base text-gray-400 max-w-xl">
                            Specjalna oferta Orange dla pracowników Twojej firmy. <span className="text-orange-500 font-medium">Szybciej. Lepiej. Taniej.</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-orange-500 text-black text-xs font-bold px-3 py-1 uppercase tracking-wider">Exclusive</span>
                        <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 uppercase tracking-wider">Pracownik</span>
                    </div>
                </div>
            </div>

            {/* CONTENT - WHITE */}
            <div className="bg-white p-8">
                {/* Tabs - Minimalist */}
                <div className="flex gap-6 mb-8 overflow-x-auto pb-2 border-b border-slate-100">
                    {[
                        { id: 'ALL', label: 'Wszystkie' },
                        { id: 'INTERNET', label: 'Internet' },
                        { id: 'ABONAMENT', label: 'Abonamenty' },
                        { id: 'LOVE', label: 'Pakiety Love' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as OrangeTab)}
                            className={`pb-4 text-sm font-bold transition-all whitespace-nowrap relative ${
                                activeTab === tab.id 
                                ? 'text-orange-500' 
                                : 'text-slate-500 hover:text-black'
                            }`}
                        >
                            {tab.label.toUpperCase()}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Cards Grid - ENTERPRISE ANIMATIONS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredServices.map(service => (
                        <div key={service.id} className="group bg-white border border-slate-200 shadow-sm hover:shadow-[0_20px_50px_-12px_rgba(249,115,22,0.3)] hover:-translate-y-2 hover:border-orange-500 transition-all duration-500 ease-out flex flex-col relative h-full rounded-2xl overflow-hidden transform perspective-1000">
                            
                            {/* Top Orange Line Gradient */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>

                            <div className="p-8 flex-1 flex flex-col z-10 relative">
                                {/* Card Header */}
                                <div className="mb-6 relative">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block group-hover:text-orange-500 transition-colors duration-300">
                                        {service.name.includes('Światłowód') ? 'INTERNET DOMOWY' : 
                                        service.name.includes('Plan') ? 'ABONAMENT KOMÓRKOWY' : 'OSZCZĘDZAJ W PAKIECIE'}
                                    </span>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2 leading-tight group-hover:text-black transition-colors">
                                        {service.name}
                                    </h3>
                                    {/* Decorative Icon - Animated */}
                                    <div className="absolute -top-4 -right-4 text-slate-100 transform scale-150 origin-top-right transition-all group-hover:text-orange-50 group-hover:scale-[1.75] group-hover:rotate-12 duration-700 pointer-events-none">
                                        {service.name.includes('Światłowód') ? <Wifi size={80} /> : 
                                        service.name.includes('Plan') ? <Smartphone size={80} /> : 
                                        <Heart size={80} />}
                                    </div>
                                </div>

                                {/* Features */}
                                <div className="space-y-4 mb-8 flex-1">
                                    <p className="text-slate-600 text-sm leading-relaxed border-l-2 border-slate-200 pl-4 group-hover:border-orange-500 transition-colors duration-300">
                                        {service.description}
                                    </p>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center gap-3 text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                                            <Wifi size={18} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                                            <span className="font-bold">
                                                {service.name.includes('Światłowód') ? 'do 600 Mb/s' : 
                                                 service.name.includes('Plan') ? 'Internet: 100 GB' : 
                                                 'do 300 Mb/s'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                                            <div className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-900 border border-slate-200 text-[10px] font-bold rounded group-hover:bg-orange-100 group-hover:text-orange-700 group-hover:border-orange-200 transition-all">24</div>
                                            <span>Umowa na <span className="text-slate-900 font-bold">24 miesięcy</span></span>
                                        </div>
                                    </div>
                                    
                                    {/* Divider */}
                                    <div className="h-px bg-slate-100 w-full group-hover:bg-orange-100 transition-colors duration-500"></div>

                                    {service.name.includes('Plan') && (
                                        <div className="text-xs text-slate-500 mt-4 grid grid-cols-2 gap-2">
                                            <div className="flex items-center gap-1"><span className="text-orange-500">✓</span> Rozmowy bez limitu</div>
                                            <div className="flex items-center gap-1"><span className="text-orange-500">✓</span> SMS/MMS bez limitu</div>
                                            <div className="flex items-center gap-1"><span className="text-orange-500">✓</span> Roaming UE</div>
                                            <div className="flex items-center gap-1"><span className="text-orange-500">✓</span> 5G Ready</div>
                                        </div>
                                    )}
                                </div>

                                {/* Price & Action */}
                                <div className="mt-auto pt-4">
                                    <div className="flex items-baseline gap-1 mb-6">
                                        <span className="text-4xl font-extrabold text-slate-900 tracking-tighter group-hover:scale-105 transition-transform duration-300 origin-left block">{service.price}</span>
                                        <span className="text-lg font-bold text-orange-600">pkt</span>
                                        <span className="text-xs text-slate-400 ml-2 uppercase font-medium">/ miesięcznie</span>
                                    </div>
                                    
                                    <button 
                                        onClick={() => onPurchase(service)}
                                        className="w-full bg-orange-500 text-black font-bold py-4 px-6 rounded-xl hover:bg-black hover:text-white transition-all duration-300 flex items-center justify-between group/btn shadow-lg shadow-orange-500/20 hover:shadow-xl hover:translate-x-1"
                                    >
                                        <span className="tracking-wide text-sm font-extrabold">WYBIERAM</span>
                                        <ArrowRight size={20} className="transform group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
