
import React, { useState } from 'react';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { ServiceItem, ServiceType } from '../../../types';
import { ServiceIcon } from '../../ui/ServiceIcon';
import { Tabs } from '../../ui/Tabs';

interface ServiceCatalogProps {
  services: ServiceItem[];
  userBalance: number;
  onPurchase: (service: ServiceItem) => void;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ services, userBalance, onPurchase }) => {
  const [filter, setFilter] = useState<'ALL' | 'SUBSCRIPTION' | 'ONE_TIME'>('ALL');

  const getServiceTheme = (id: string, index: number) => {
      const themes = [
          { glow: 'bg-emerald-500/20', line: 'from-emerald-400 to-teal-500', icon: 'text-emerald-600 bg-emerald-50', hoverIcon: 'group-hover:text-emerald-700 group-hover:bg-emerald-100', bg: 'bg-emerald-500/5', border: 'group-hover:border-emerald-300' },
          { glow: 'bg-indigo-500/20', line: 'from-indigo-400 to-purple-500', icon: 'text-indigo-600 bg-indigo-50', hoverIcon: 'group-hover:text-indigo-700 group-hover:bg-indigo-100', bg: 'bg-indigo-500/5', border: 'group-hover:border-indigo-300' },
          { glow: 'bg-amber-500/20', line: 'from-amber-400 to-orange-500', icon: 'text-amber-600 bg-amber-50', hoverIcon: 'group-hover:text-amber-700 group-hover:bg-amber-100', bg: 'bg-amber-500/5', border: 'group-hover:border-amber-300' },
          { glow: 'bg-rose-500/20', line: 'from-rose-400 to-pink-500', icon: 'text-rose-600 bg-rose-50', hoverIcon: 'group-hover:text-rose-700 group-hover:bg-rose-100', bg: 'bg-rose-500/5', border: 'group-hover:border-rose-300' },
          { glow: 'bg-sky-500/20', line: 'from-sky-400 to-blue-500', icon: 'text-sky-600 bg-sky-50', hoverIcon: 'group-hover:text-sky-700 group-hover:bg-sky-100', bg: 'bg-sky-500/5', border: 'group-hover:border-sky-300' }
      ];

      // Assignment based on ID or index
      if(id.includes('SPOTIFY')) return themes[1]; // Indigo
      if(id.includes('FUEL')) return themes[2];    // Amber
      if(id.includes('CINEMA')) return themes[4];  // Sky

      // New Categories
      if(id.includes('SRV-AI')) return themes[1]; // AI - Indigo (Tech)
      if(id.includes('SRV-MH')) return themes[0]; // Mental Health - Emerald (Calm)
      if(id.includes('SRV-FIN')) return themes[2]; // Finance - Amber (Gold)
      if(id.includes('SRV-LIFE')) return themes[3]; // Lifestyle - Rose (Passion/Fun)

      return themes[index % themes.length];
  };

  const filteredServices = services
    .filter(s => s.isActive)
    .filter(s => filter === 'ALL' || s.type === filter);

  console.log('Rendering ServiceCatalog. Total services:', services.length, 'Filtered:', filteredServices.length);
  if (filteredServices.length > 0) {
      console.log('DEBUG First Service:', filteredServices[0]);
  }

  return (
    <div className="bg-white md:p-6 md:rounded-xl md:shadow-sm md:border border-slate-100">
        
        {/* Filters (Using Tabs) */}
        <div className="mb-6">
            <Tabs 
                activeTab={filter}
                onChange={(id) => setFilter(id as any)}
                items={[
                    { id: 'ALL', label: 'Wszystkie' },
                    { id: 'SUBSCRIPTION', label: 'Subskrypcje' },
                    { id: 'ONE_TIME', label: 'Jednorazowe' }
                ]}
            />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredServices.map((service, idx) => {
             const theme = getServiceTheme(service.id, idx);
             return (
                <div 
                    key={service.id} 
                    onClick={() => onPurchase(service)}
                    className={`group relative bg-white border border-slate-100 shadow-sm rounded-2xl p-0 hover:shadow-2xl hover:-translate-y-2 cursor-pointer transition-all duration-500 flex flex-col min-h-[340px] overflow-hidden active:scale-[0.98] ${theme.border}`}
                >
                    {/* Background: Image or Graphic */}
                    {service.image ? (
                        <div className="absolute inset-0 z-0">
                            <img 
                                src={service.image} 
                                alt={service.name} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            />
                            {/* Gradient Overlay for Readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent opacity-95 group-hover:opacity-90 transition-opacity"></div>
                        </div>
                    ) : (
                        <>
                            <div className={`absolute -right-8 -top-8 w-48 h-48 ${theme.bg} rounded-full blur-3xl transform group-hover:scale-150 transition-transform duration-700 -z-0`}></div>
                            <div className="absolute right-0 top-0 h-full w-1/4 bg-slate-50/50 -skew-x-12 transform origin-top translate-x-12 group-hover:translate-x-0 transition-transform duration-1000"></div>
                            
                            {/* Glow Underneath (No Image) */}
                            <div className={`absolute -bottom-6 left-6 right-6 h-6 ${theme.glow} rounded-[100%] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`}></div>

                            {/* Top Animated Progress Bar Effect (No Image) */}
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${theme.line} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-20 rounded-t-2xl`}></div>
                        </>
                    )}

                    {/* Content Container */}
                    <div className={`flex flex-col h-full relative z-10 p-6 ${service.image ? 'justify-between' : ''}`}>
                        
                        {/* Top Section */}
                        <div className="flex justify-between items-start mb-6">
                            {service.image ? (
                                // Minimal Glass Icon for Image Cards
                                <div className="backdrop-blur-md bg-white/10 p-2.5 rounded-xl border border-white/20 shadow-lg group-hover:bg-white/20 transition-all">
                                    <ServiceIcon iconName={service.icon} size={20} className="text-white" />
                                </div>
                            ) : (
                                // Original Large Icon for Graphic Cards
                                <div className={`p-4 ${theme.icon} rounded-2xl border border-white shadow-sm transition-all duration-300 ${theme.hoverIcon} group-hover:scale-110 group-hover:rotate-3`}>
                                    <ServiceIcon iconName={service.icon} size={32} />
                                </div>
                            )}

                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border-dashed border ${
                                service.image
                                    ? 'bg-black/30 text-white border-white/30 backdrop-blur-sm'
                                    : (service.type === ServiceType.SUBSCRIPTION 
                                        ? 'bg-white/80 text-indigo-700 border-indigo-200' 
                                        : 'bg-white/80 text-amber-700 border-amber-200')
                            }`}>
                                {service.type === ServiceType.SUBSCRIPTION ? 'Premium' : 'One-Time'}
                            </span>
                        </div>

                        {/* Middle/Bottom Section */}
                        <div className={`relative z-10 flex-1 ${service.image ? 'flex flex-col justify-end' : ''}`}>
                            <div className={`${service.image ? 'mb-2' : ''}`}>
                                <h4 className={`text-xl font-black leading-tight mb-2 group-hover:translate-x-1 transition-transform drop-shadow-sm ${service.image ? 'text-white' : 'text-slate-800'}`}>
                                    {service.name}
                                </h4>
                                
                                {/* Category Badges - Compact */}
                                <div className="flex gap-2 mb-3 flex-wrap">
                                    {service.id.includes('SRV-AI') && <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-indigo-500/80 px-2 py-0.5 rounded backdrop-blur-md border border-white/10">AI</span>}
                                    {service.id.includes('SRV-MH') && <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-emerald-500/80 px-2 py-0.5 rounded backdrop-blur-md border border-white/10">Wellbeing</span>}
                                    {service.id.includes('SRV-FIN') && <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-amber-500/80 px-2 py-0.5 rounded backdrop-blur-md border border-white/10">Finanse</span>}
                                    {service.id.includes('SRV-LIFE') && <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-rose-500/80 px-2 py-0.5 rounded backdrop-blur-md border border-white/10">Lifestyle</span>}
                                </div>
                            </div>

                            {!service.image && (
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-3xl font-black text-slate-900">{service.price}</span>
                                    <span className="text-sm font-bold text-slate-400">vou</span>
                                    {service.type === ServiceType.SUBSCRIPTION && <span className="text-[10px] text-slate-400 ml-1">/ mies.</span>}
                                </div>
                            )}
                            
                            <p className={`text-sm font-medium leading-relaxed mb-6 line-clamp-2 ${service.image ? 'text-slate-300' : 'text-slate-500 italic opacity-80'}`}>
                                {service.description}
                            </p>

                            {/* Footer / Price */}
                            <div className={`flex items-center justify-between pt-4 border-t ${service.image ? 'border-white/20' : 'border-slate-100'}`}>
                                <div className="flex flex-col">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${service.image ? 'text-slate-400' : 'text-slate-400'}`}>Koszt</span>
                                    <span className={`text-2xl font-black ${service.image ? 'text-white' : 'text-slate-900'}`}>
                                        {service.price} <span className={`text-sm font-bold ${service.image ? 'text-slate-400' : 'text-slate-400'}`}>vou</span>
                                    </span>
                                </div>
                                <button className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm group-hover:shadow-md ${
                                    service.image 
                                        ? 'bg-white text-slate-900 hover:bg-slate-200' 
                                        : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}>
                                    <ShoppingCart size={14} />
                                    <span>Wybierz</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
             );
          })}
        </div>
    </div>
  );
};
