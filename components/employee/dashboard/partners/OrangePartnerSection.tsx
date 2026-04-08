import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Wifi, Heart, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';

interface OrangePartnerSectionProps {
  onSelect?: (offer: string) => void;
}

const TABS = ['Wszystkie', 'Internet', 'Abonamenty', 'Pakiety Love'];

const OFFERS = [
  {
    id: 'internet',
    tab: 'Internet',
    type: 'INTERNET DOMOWY',
    name: 'Światłowód Pro 2.0',
    badge: 'BESTSELLER',
    icon: Wifi,
    desc: 'Super szybki internet światłowodowy do Twojego domu.',
    features: ['do 600 Mb/s symetrycznie', 'Router Wi-Fi 6 w zestawie', 'Umowa na 24 miesiące'],
    featureDotColor: 'bg-slate-400',
    chips: ['Brak limitu danych', 'Instalacja w 48h'],
    oldPrice: null,
    price: '59',
    savingsText: null,
    isPopular: false,
    btnClass: 'bg-[#111827] text-white hover:bg-black',
  },
  {
    id: 'mobile',
    tab: 'Abonamenty',
    type: 'ABONAMENT KOMÓRKOWY',
    name: 'Plan Firmowy L',
    badge: null,
    icon: Smartphone,
    desc: 'Nielimitowane rozmowy i SMSy, duży pakiet danych.',
    features: ['100 GB internetu mobilnego', '5G Ready', 'Umowa na 24 miesiące'],
    featureDotColor: 'bg-[#ff7900]',
    chips: ['Rozmowy bez limitu', 'SMS/MMS bez limitu', 'Roaming UE', 'eSIM'],
    oldPrice: '99 pkt',
    price: '45',
    savingsText: 'Oszczędzasz 54 pkt',
    isPopular: true,
    btnClass: 'bg-[#ff7900] text-white hover:bg-[#e66a00] shadow-md shadow-orange-500/20',
  },
  {
    id: 'love',
    tab: 'Pakiety Love',
    type: 'PAKIET RODZINNY',
    name: 'Orange Love Mini',
    badge: 'OSZCZĘDZASZ',
    icon: Heart,
    desc: 'Pakiet usług dla całej rodziny w jednej cenie.',
    features: ['Internet + komórka + TV', 'do 300 Mb/s', 'Umowa na 24 miesiące'],
    featureDotColor: 'bg-slate-400',
    chips: ['Cała rodzina w planie', 'Orange TV w pakiecie'],
    oldPrice: null,
    price: '89',
    savingsText: null,
    isPopular: false,
    btnClass: 'bg-[#111827] text-white hover:bg-black',
  }
];

export const OrangePartnerSection: React.FC<OrangePartnerSectionProps> = ({ onSelect }) => {
  const [activeTab, setActiveTab] = useState('Wszystkie');

  const offers = OFFERS.filter(o => activeTab === 'Wszystkie' || o.tab === activeTab);

  return (
    <section className="py-6">
      <div className="relative max-w-7xl mx-auto">
        
        {/* Animated Banner Layer */}
        <motion.div 
          className="relative bg-gradient-to-br from-[#ff7900] to-[#f06800] rounded-t-[2.5rem] rounded-b-2xl overflow-hidden px-8 py-10 md:px-12 md:py-14 shadow-lg mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Subtle background circles */}
          <div className="absolute top-[-50%] right-[-10%] w-[800px] h-[800px] rounded-full bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-50%] left-[20%] w-[600px] h-[600px] rounded-full bg-[#ff9333]/40 blur-3xl pointer-events-none" />

          {/* Special top-right text floating out a bit, anchored relative inside the card for stability */}
          <div className="absolute top-6 right-8 opacity-90 hidden md:block">
            <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">KOD: EBS-CORP</span>
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-8 items-start lg:items-center">
            
            {/* Left Box */}
            <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
              
              <motion.div 
                className="bg-white p-2 rounded-2xl shadow-[0_4px_12px_rgba(255,121,0,0.3)] shrink-0 flex items-center justify-center w-20 h-20"
                whileHover={{ scale: 1.05 }}
              >
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/c/c8/Orange_logo.svg" 
                  alt="Orange logo" 
                  className="w-full h-full object-contain rounded-xl"
                />
              </motion.div>

              <div>
                <h2 className="text-3xl sm:text-[40px] font-black text-white tracking-tight mb-2 sm:mb-1">Oferta dla pracowników</h2>
                <p className="text-[13px] sm:text-sm font-semibold text-white/90">Ekskluzywne warunki negocjowane specjalnie dla Twojej firmy</p>
              </div>

            </div>

            {/* Right Stats */}
            <div className="flex flex-wrap items-center gap-8 lg:gap-12 pl-0 sm:pl-4">
              
              <div className="flex flex-col">
                <span className="text-2xl font-black text-white leading-none mb-1">do 40%</span>
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">taniej niż cennik</span>
              </div>
              
              <div className="w-px h-10 bg-white/20 hidden sm:block" />

              <div className="flex flex-col">
                <span className="text-2xl font-black text-white leading-none mb-1">24/7</span>
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">wsparcie klienta</span>
              </div>

              <div className="bg-white text-[#ff7900] text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest shadow-sm">
                EXCLUSIVE
              </div>

            </div>
          </div>
        </motion.div>

        {/* Tabs Filter Row */}
        <div className="px-2 md:px-6 mb-8 flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 w-max shrink-0 ${
                  isActive 
                    ? 'text-[#ff7900] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Pricing Cards Grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 px-2 md:px-6 mb-12"
        >
          <AnimatePresence mode="popLayout">
            {offers.map((offer, i) => (
              <motion.div
                key={offer.id}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: 'easeOut' }}
                onClick={() => onSelect?.(offer.name)}
                className={`relative bg-white rounded-3xl cursor-pointer overflow-hidden transition-all duration-300 group
                  ${offer.isPopular 
                    ? 'border-2 border-[#ff7900] shadow-[0_12px_40px_rgb(255,121,0,0.15)] ring-4 ring-[#ff7900]/10 -mt-2' 
                    : 'border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1'
                  }
                `}
              >
                {/* Highlight Top Banner */}
                {offer.isPopular && (
                  <div className="bg-[#ff7900] text-center py-2.5">
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.15em]">
                      {offer.popularText || '★ NAJPOPULARNIEJSZY WYBÓR'}
                    </span>
                  </div>
                )}

                <div className={`p-8 lg:p-10 flex flex-col h-full ${offer.isPopular ? 'pt-8' : ''}`}>
                  
                  {/* Header part */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                        {offer.type}
                      </span>
                      <h3 className={`text-2xl font-black leading-tight ${offer.isPopular ? 'text-[#ff7900]' : 'text-slate-900'}`}>
                        {offer.name}
                      </h3>
                      {offer.badge && (
                        <div className="bg-orange-50 w-max px-2.5 py-1 rounded-md mt-1">
                          <span className="text-[10px] font-extrabold text-[#ff7900] uppercase tracking-wider">{offer.badge}</span>
                        </div>
                      )}
                    </div>
                    {/* Floating Icon */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-50 shadow-sm ${offer.isPopular ? 'bg-orange-50 text-[#ff7900]' : 'bg-white text-[#ff7900]'}`}>
                      <offer.icon size={20} strokeWidth={2} />
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-slate-500 text-sm font-medium mb-6">
                    {offer.desc}
                  </p>

                  {/* Features Bullets */}
                  <div className="flex flex-col gap-3 mb-8">
                    {offer.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${offer.featureDotColor}`} />
                        <span className="text-[13px] font-bold text-slate-700">{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Small Chips */}
                  <div className="flex flex-wrap gap-2 mb-10">
                    {offer.chips.map((chip, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{chip}</span>
                      </div>
                    ))}
                  </div>

                {/* Footer / Price Area */}
                <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">MIESIĘCZNIE</span>
                    
                    <div className="flex justify-between items-end">
                       <div className="flex items-end gap-1.5">
                         <span className="text-[40px] font-black leading-none text-slate-900">{offer.price}</span>
                         <span className="text-sm font-bold text-[#ff7900] mb-1">pkt</span>
                       </div>

                       {(offer.oldPrice || offer.savingsText) && (
                         <div className="flex flex-col items-end">
                           {offer.oldPrice && (
                             <span className="text-[11px] font-bold text-slate-400 line-through decoration-slate-400 decoration-2">{offer.oldPrice}</span>
                           )}
                           {offer.savingsText && (
                             <span className="text-xs font-bold text-emerald-500 mt-1">{offer.savingsText}</span>
                           )}
                         </div>
                       )}
                    </div>
                  </div>

                  <button 
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 font-black text-sm uppercase tracking-wider ${offer.btnClass}`}
                  >
                    WYBIERAM <ArrowRight size={18} strokeWidth={3} className="group-hover:translate-x-1.5 transition-transform" />
                  </button>

                </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Disclaimer Footer */}
        <div className="px-4">
          <div className="flex items-start sm:items-center gap-3 text-slate-400 max-w-4xl mx-auto justify-center">
            <Shield size={16} className="shrink-0 mt-0.5 sm:mt-0" strokeWidth={2} />
            <p className="text-[11px] font-semibold leading-relaxed sm:leading-normal">
              Oferta dostępna wyłącznie dla pracowników firm posiadających umowę korporacyjną z Orange Polska S.A. Ceny podane w punktach benefitowych.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
