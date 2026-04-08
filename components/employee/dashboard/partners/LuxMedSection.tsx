import React from 'react';
import { motion } from 'motion/react';
import { Heart, CheckCircle, ArrowRight, Star, Clock, Phone } from 'lucide-react';

interface LuxMedSectionProps {
  onSelect?: (packageName: string) => void;
}

const plans = [
  {
    id: 'podstawowy',
    name: 'Pakiet Podstawowy',
    price: '89 zł/mies.',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    badge: null,
    features: [
      'Konsultacje lekarskie online',
      'Medycyna pracy',
      'Podstawowa diagnostyka',
      'Pomoc w nagłych przypadkach',
    ],
  },
  {
    id: 'komfort',
    name: 'Pakiet Komfort',
    price: '149 zł/mies.',
    color: '#7C3AED',
    bg: '#faf5ff',
    border: '#ddd6fe',
    badge: 'Najpopularniejszy',
    features: [
      'Konsultacje stacjonarne i online',
      'Stomatologia podstawowa',
      'Specjaliści bez skierowań',
      'Opieka psychologiczna',
      'Diagnostyka rozszerzona',
    ],
  },
  {
    id: 'premium',
    name: 'Pakiet Premium',
    price: '249 zł/mies.',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    badge: 'VIP',
    features: [
      'Nieograniczony dostęp do specjalistów',
      'Opieka szpitalna 24/7',
      'Stomatologia pełna',
      'Wellbeing & psychologia',
      'Infolinia VIP — 5 min oczekiwania',
      'Programy profilaktyki zdrowotnej',
    ],
  },
];

export const LuxMedSection: React.FC<LuxMedSectionProps> = ({ onSelect }) => {
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
              src="https://stratton-prime.pl/assets/luxmed-DvSWTrp6.png"
              alt="LuxMed"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.innerHTML = '<span style="font-size:10px;font-weight:700;color:#16a34a">LUX</span>';
                }
              }}
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">LuxMed</h2>
            <p className="text-sm text-gray-500 font-medium">Prywatna Opieka Medyczna</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Aktywny Partner</span>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-3 gap-3 mb-8"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {[
          { icon: Clock, text: '24/7 pomoc medyczna' },
          { icon: Star, text: '4 000+ placówek w Polsce' },
          { icon: Phone, text: 'Infolinia bez kolejek' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2.5 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-green-600" />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">{text}</span>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            className="relative rounded-2xl p-6 border-2 cursor-pointer group"
            style={{ background: plan.bg, borderColor: plan.border }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: i * 0.1 }}
            whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.10)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect?.(plan.name)}
          >
            {plan.badge && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest"
                style={{ background: plan.color }}
              >
                {plan.badge}
              </div>
            )}
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-base">{plan.name}</h3>
              <p className="font-black text-2xl mt-1" style={{ color: plan.color }}>{plan.price}</p>
            </div>
            <ul className="space-y-2 mb-5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 text-white"
              style={{ background: plan.color }}
            >
              Wybierz pakiet
              <ArrowRight size={14} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-4 flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 border border-gray-100 shadow-sm"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Heart size={18} className="text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-gray-900">Medycyna Pracy w cenie</p>
          <p className="text-xs text-gray-500">Wszystkie pakiety zawierają badania wstępne, okresowe i kontrolne.</p>
        </div>
        <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">Gratis</span>
      </motion.div>
    </section>
  );
};
