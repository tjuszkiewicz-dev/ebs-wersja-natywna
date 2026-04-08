import React from 'react';
import { motion } from 'motion/react';
import { Shield, CheckCircle, ArrowRight, Umbrella, Globe, Users } from 'lucide-react';

interface SignalIdunaSectionProps {
  onSelect?: (planName: string) => void;
}

const tiers = [
  {
    id: 'classic',
    name: 'CLASSIC',
    subtitle: 'Solidna podstawa',
    price: 'od 49 zł/mies.',
    color: '#2563EB',
    badge: null,
    features: ['Zwrot za leczenie ambulatoryjne', 'Leki refundowane', 'Podstawowa rehabilitacja'],
  },
  {
    id: 'classic-plus',
    name: 'CLASSIC PLUS',
    subtitle: 'Rozszerzona ochrona',
    price: 'od 89 zł/mies.',
    color: '#3b82f6',
    badge: null,
    features: ['Wszystko z CLASSIC', 'Specjaliści bez skierowań', 'Stomatologia podstawowa'],
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    subtitle: 'Komfort & spokój',
    price: 'od 139 zł/mies.',
    color: '#7C3AED',
    badge: 'Rekomendowany',
    features: ['Wszystko z CLASSIC PLUS', 'Pobyt szpitalny 90 dni/rok', 'Opieka psychologiczna', 'Rehabilitacja rozszerzona'],
  },
  {
    id: 'premium-plus',
    name: 'PREMIUM PLUS',
    subtitle: 'Pełna ochrona',
    price: 'od 199 zł/mies.',
    color: '#6d28d9',
    badge: null,
    features: ['Wszystko z PREMIUM', 'Pobyt szpitalny 180 dni/rok', 'Refundacja leków do 100%', 'Diagnostyka VIP'],
  },
  {
    id: 'prestige',
    name: 'PRESTIGE',
    subtitle: 'Bez kompromisów',
    price: 'od 349 zł/mies.',
    color: '#b45309',
    badge: 'Premium',
    features: ['Nieograniczona opieka szpitalna', 'Leczenie za granicą', 'Personal Health Manager', 'Ubezpieczenie NNW w cenie'],
  },
];

const extras = [
  { icon: Users, label: 'Grupowe na życie', desc: 'Ochrona dla całego zespołu' },
  { icon: Shield, label: 'NNW', desc: 'Następstwa nieszczęśliwych wypadków' },
  { icon: Globe, label: 'Turystyczne', desc: 'Podróże służbowe i prywatne' },
  { icon: Umbrella, label: 'Na życie', desc: 'Zabezpieczenie dla bliskich' },
];

export const SignalIdunaSection: React.FC<SignalIdunaSectionProps> = ({ onSelect }) => {
  return (
    <section className="py-10">
      <motion.div
        className="flex items-center justify-between mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden p-1.5">
            <img
              src="https://stratton-prime.pl/assets/signal_iduna_polska_logo-MX6YVCfs.png"
              alt="Signal Iduna"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.innerHTML = '<span style="font-size:8px;font-weight:700;color:#2563EB">SIGNAL</span>';
                }
              }}
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Signal Iduna</h2>
            <p className="text-sm text-gray-500 font-medium">Ubezpieczenia Zdrowotne & Życiowe</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
          <Shield size={12} className="text-blue-600" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Certyfikowany Partner</span>
        </div>
        </motion.div>

      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory no-scrollbar -mx-1 px-1">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.id}
            className="relative rounded-2xl p-5 border-2 cursor-pointer group flex-shrink-0 snap-start bg-white"
            style={{ borderColor: tier.color + '33', width: 'clamp(200px, 45vw, 240px)' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            whileHover={{ y: -4, boxShadow: '0 10px 28px rgba(0,0,0,0.09)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect?.(tier.name)}
          >
            {tier.badge && (
              <div
                className="absolute -top-2.5 right-4 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest"
                style={{ background: tier.color }}
              >
                {tier.badge}
              </div>
            )}
            <div
              className="inline-block text-xs font-black px-2.5 py-1 rounded-lg mb-3 tracking-wider"
              style={{ background: tier.color + '18', color: tier.color }}
            >
              {tier.name}
            </div>
            <p className="text-gray-500 text-xs mb-1">{tier.subtitle}</p>
            <p className="font-black text-xl text-gray-900 mb-4">{tier.price}</p>
            <ul className="space-y-1.5">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                  <CheckCircle size={12} className="mt-0.5 flex-shrink-0" style={{ color: tier.color }} />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className="mt-4 w-full py-2 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 text-white"
              style={{ background: tier.color }}
            >
              Sprawdź ofertę
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
</motion.div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-2 md:hidden">← przewiń, aby zobaczyć więcej planów →</p>

      <div className="mt-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Dodatkowe produkty</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {extras.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="bg-white rounded-xl px-4 py-3.5 border border-gray-100 shadow-sm cursor-pointer hover:border-blue-200 hover:bg-blue-50 transition-all group"
              onClick={() => onSelect?.(label)}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                <Icon size={16} className="text-blue-600" />
              </div>
              <p className="text-xs font-bold text-gray-800">{label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
