import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Home, Plane, HeartPulse, GraduationCap, CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  onSelect?: (product: string) => void;
}

const CATEGORIES = [
  {
    id: 'ocac',
    icon: Car,
    name: 'OC / AC',
    title: 'Ubezpieczenie samochodu OC/AC',
    desc: 'Kompleksowa ochrona pojazdu z asystą drogową przez całą dobę.',
    img: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&q=80&w=800', 
    price: 38,
    features: [
      'OC — obowiązkowe ubezpieczenie komunikacyjne',
      'AC — ochrona własnego pojazdu od szkód',
      'Assistance Comfort: pomoc 24/7 w trasie',
      'NNW kierowcy i pasażerów',
      'Szyby — wymiana bez udziału własnego',
      'Zniżka do 30% dla pracowników objętych BBS'
    ],
    showCalcInput: true,
  },
  {
    id: 'dom',
    icon: Home,
    name: 'Dom i Mieszkanie',
    title: 'Ubezpieczenie domu i mieszkania',
    desc: 'Ochrona przed zdarzeniami losowymi i kradzieżą.',
    img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800', 
    price: 15,
    features: [
      'Pożar i inne zdarzenia losowe',
      'Kradzież z włamaniem i rabunek',
      'OC w życiu prywatnym (także za psa lub kota)',
      'Assistance domowy',
      'Przepięcia, stłuczenia szyb i zalania'
    ],
    showCalcInput: false,
  },
  {
    id: 'podroze',
    icon: Plane,
    name: 'Podróże',
    title: 'Ubezpieczenie turystyczne',
    desc: 'Bezpieczne wyjazdy zagraniczne i krajowe.',
    img: 'https://images.unsplash.com/photo-1436491865332-7a61ce2ed364?auto=format&fit=crop&q=80&w=800', 
    price: 5,
    features: [
      'Koszty leczenia za granicą',
      'Ratownictwo i transport',
      'Ubezpieczenie bagażu',
      'NNW w podróży',
      'COVID-19 i choroby przewlekłe'
    ],
    showCalcInput: false,
  },
  {
    id: 'zdrowie',
    icon: HeartPulse,
    name: 'Zdrowie',
    title: 'Prywatne ubezpieczenie zdrowotne',
    desc: 'Szybki dostęp do specjalistów i badań poza kolejką.',
    img: 'https://images.unsplash.com/photo-1542884748-2b87b36b6b90?auto=format&fit=crop&q=80&w=800', 
    price: 45,
    features: [
      'Nielimitowane wizyty u specjalistów',
      'Szeroki zakres badań diagnostycznych',
      'Prowadzenie ciąży',
      'Stomatologia i rehabilitacja',
      'Dostęp do placówek w całej Polsce'
    ],
    showCalcInput: false,
  },
  {
    id: 'edukacja',
    icon: GraduationCap,
    name: 'Edukacja',
    title: 'Polisa posagowa dla dziecka',
    desc: 'Oszczędności na wymarzone studia i start w dorosłość.',
    img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800', 
    price: 20,
    features: [
      'Gwarantowany kapitał dla dziecka',
      'Ochrona życia rodzica',
      'Renta po osieroceniu',
      'Premie za osiągnięcia edukacyjne',
      'Wypłata za nieszczęśliwe wypadki'
    ],
    showCalcInput: false,
  },
];

export const PZUPartnerSection: React.FC<Props> = ({ onSelect }) => {
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);

  const activeCategory = CATEGORIES.find(c => c.id === activeCategoryId) || CATEGORIES[0];

  return (
    <section className="py-10">
      {/* Container matching screenshot */}
      <div className="bg-white rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col">
        
        {/* Dark Red Header */}
        <div className="bg-gradient-to-r from-[#2B1017] to-[#401625] px-6 py-8 md:px-10 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center p-2 shadow-lg">
                <img src="https://stratton-prime.pl/assets/pzu-CO8rYO_L.svg" alt="PZU" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-[#cc1a36] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
                    Benefity Pracownicze
                  </span>
                  <span className="border border-white/20 text-white/80 text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
                    Platforma BBS
                  </span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  Ubezpieczenia <span className="text-[#cc1a36]">PZU</span>
                </h2>
                <p className="text-sm font-medium text-white/70">
                  Specjalne zniżki pracownicze — do 40% taniej niż w cenniku
                </p>
              </div>
            </div>
            
            {/* Header Stats */}
            <div className="flex items-center gap-8 border-t md:border-l md:border-t-0 border-white/10 pt-4 md:pt-0 pl-0 md:pl-8">
              <div className="flex flex-col items-center">
                <p className="text-white font-black text-xl flex items-center gap-1.5">
                  <span className="text-white/60">👥</span> 16 mln+
                </p>
                <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">Klientów</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-white font-black text-xl flex items-center gap-1.5">
                  <span className="text-white/60">🏅</span> 100+
                </p>
                <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">Lat Tradycji</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-white font-black text-xl">
                  do 40%
                </p>
                <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-1">Taniej</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="px-6 md:px-10 -mt-8 relative z-20 overflow-x-auto no-scrollbar pt-2">
          <div className="bg-[#f8fafc] rounded-xl flex items-center gap-2 p-1.5 w-max shadow-md border border-white">
            {CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${
                    isActive 
                      ? 'bg-[#cc1a36] text-white shadow-md transform -translate-y-0.5' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 md:p-10 pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory.id}
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
              className="bg-[#f8fafc] rounded-[2rem] flex flex-col md:flex-row overflow-hidden border border-slate-100"
            >
              {/* Left Details */}
              <div className="flex-1 p-8 md:p-12 flex flex-col justify-center relative">
                <div className="absolute top-8 left-8 border border-red-200 bg-red-50 text-[#cc1a36] text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider flex items-center gap-1.5">
                  <span className="text-red-500">★</span> NR 1 W POLSCE
                </div>
                
                <h3 className="text-3xl font-black text-slate-900 mt-8 mb-2 leading-tight">
                  {activeCategory.title}
                </h3>
                <p className="text-sm text-slate-500 font-medium mb-8">
                  {activeCategory.desc}
                </p>

                <div className="space-y-4 mb-10 flex-1">
                  {activeCategory.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full overflow-hidden text-[#cc1a36] shrink-0">
                        <CheckCircle2 size={18} className="fill-[#cc1a36]/10" strokeWidth={2.5} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{feature}</p>
                    </div>
                  ))}
                </div>

                {/* Price and CTA */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-t border-slate-200 pt-6">Cena pracownicza od</p>
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="flex items-end gap-1.5">
                      <span className="text-5xl font-black text-slate-900 leading-none">{activeCategory.price}</span>
                      <span className="text-sm font-bold text-slate-400 mb-1">pkt / miesiąc</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {activeCategory.showCalcInput && (
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="NP. KR 12345" 
                            className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg pl-4 pr-[110px] py-3.5 outline-none shadow-sm w-full max-w-[200px]"
                          />
                          <button 
                            className="absolute right-1.5 top-1.5 bottom-1.5 bg-[#d97706] hover:bg-[#b45309] text-white text-[10px] font-black px-3 rounded-md uppercase tracking-wider transition-colors"
                            onClick={() => onSelect?.(`${activeCategory.name} - Wycena`)}
                          >
                            Oblicz składkę
                          </button>
                        </div>
                      )}
                      <button 
                        className="bg-[#cc1a36] hover:bg-[#a1142a] text-white px-6 py-3.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all hover:gap-3 shadow-md"
                        onClick={() => onSelect?.(activeCategory.name)}
                      >
                        Oblicz składkę <ArrowRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Image */}
              <div className="w-full md:w-2/5 min-h-[300px] md:min-h-full overflow-hidden relative">
                <img 
                  src={activeCategory.img} 
                  alt={activeCategory.title} 
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#f8fafc] via-transparent to-transparent opacity-50" />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom quick categories grid */}
          <div className="mt-12">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Szybki wybór kategorii
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {CATEGORIES.map((cat) => {
                const isActive = cat.id === activeCategoryId;
                const Icon = cat.icon;
                return (
                  <button
                    key={'quick-' + cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`relative p-4 rounded-xl border text-left transition-all duration-300 ${
                      isActive 
                        ? 'border-[#cc1a36] bg-[#cc1a36]/5 ring-1 ring-[#cc1a36]/20' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#cc1a36]" />}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${isActive ? 'bg-[#cc1a36] text-white shadow-sm' : 'bg-[#f1f5f9] text-slate-500'}`}>
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <p className={`text-sm font-bold ${isActive ? 'text-[#cc1a36]' : 'text-slate-700'}`}>
                      {cat.name}
                    </p>
                  </button>
                );
              })}
            </div>
            
            <p className="text-[10px] text-slate-400 font-medium text-center mt-8">
              Ubezpieczenia PZU oferowane są na warunkach grupowego zakupu pracowniczego. Ceny poglądowe — ostateczna oferta zależy od danych pojazdu/nieruchomości. Zakup wymaga akceptacji OWU PZU SA.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
