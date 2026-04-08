import React from 'react';
import { motion } from 'motion/react';
import { Shield, ExternalLink } from 'lucide-react';

interface Props {
  onSelect?: (partner: string, product: string) => void;
}

const insurers = [
  { id: 'generali', name: 'Generali', logo: 'https://stratton-prime.pl/assets/generali-logo-big-BvD71IL4.svg', tag: 'Ubezpieczenia na życie', color: '#dc2626', product: 'Ubezpieczenie na życie', desc: 'Polisy życiowe i grupowe dla firm' },
  { id: 'ergo', name: 'Ergo Hestia', logo: 'https://stratton-prime.pl/assets/ergo%20hestia-BNiBnF0y.svg', tag: 'Ubezpieczenia Majątkowe', color: '#0891b2', product: 'Ubezpieczenia majątkowe', desc: 'Kompleksowa ochrona majątku i zdrowia' },
  { id: 'unum', name: 'Unum', logo: 'https://stratton-prime.pl/assets/unum-DTra-Rzo.png', tag: 'Ubezpieczenia Pracownicze', color: '#7C3AED', product: 'Grupowe ubezpieczenia pracownicze', desc: 'Specjalista od świadczeń pracowniczych' },
  { id: 'vienna', name: 'Vienna Life', logo: 'https://stratton-prime.pl/assets/vienna-life-logo-BWVaTBY5.webp', tag: 'Ubezpieczenia Życiowe', color: '#b45309', product: 'Ubezpieczenia życiowe', desc: 'Kapitałowe i ochronne polisy na życie' },
  { id: 'allianz', name: 'Allianz', logo: null, initials: 'AZ', tag: 'Ubezpieczenia Premium', color: '#1d4ed8', product: 'Ubezpieczenia Allianz', desc: 'Globalny lider — szeroka ochrona ubezpieczeniowa' },
  { id: 'warta', name: 'Warta', logo: null, initials: 'W', tag: 'Ubezpieczenia', color: '#0f766e', product: 'Ubezpieczenia Warta', desc: 'Komunikacja, majątek i życie' },
  { id: 'uniqa', name: 'Uniqa', logo: null, initials: 'UQ', tag: 'Ubezpieczenia Zdrowotne', color: '#7C3AED', product: 'Ubezpieczenia Uniqa', desc: 'Nowoczesne ubezpieczenia zdrowie + majątek' },
  { id: 'leadenhall', name: 'Leadenhall', logo: null, initials: 'LH', tag: 'D&O do 30 mln zł', color: '#1e3a5f', product: 'Polisa D&O', desc: 'Ubezpieczenie odpowiedzialności zarządu' },
];

export const InsurancePartnersGrid: React.FC<Props> = ({ onSelect }) => (
  <section className="py-10">
    <motion.div
      className="flex items-center justify-between mb-8"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
    >
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Ubezpieczenia</h2>
        <p className="text-sm text-gray-500 font-medium mt-0.5">Najlepsi ubezpieczyciele w jednym miejscu</p>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200">
        <Shield size={12} className="text-violet-600" />
        <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">8 partnerów</span>
      </div>
    </motion.div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {insurers.map((ins, i) => (
        <motion.div
          key={ins.id}
          className="bg-white rounded-2xl p-4 border-2 border-transparent cursor-pointer group"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          whileHover={{ borderColor: '#e5e7eb', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect?.(ins.name, ins.product)}
        >
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-3 overflow-hidden border border-gray-100">
            {ins.logo ? (
              <img
                src={ins.logo}
                alt={ins.name}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    const span = document.createElement('span');
                    span.textContent = ins.initials ?? ins.name.slice(0, 2).toUpperCase();
                    span.style.cssText = `font-size:11px;font-weight:700;color:${ins.color}`;
                    e.currentTarget.parentElement.appendChild(span);
                  }
                }}
              />
            ) : (
              <span className="text-[11px] font-black" style={{ color: ins.color }}>{ins.initials ?? ins.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <h3 className="font-bold text-gray-900 text-sm">{ins.name}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{ins.desc}</p>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ins.color + '15', color: ins.color }}>
              {ins.tag}
            </span>
            <ExternalLink size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);
