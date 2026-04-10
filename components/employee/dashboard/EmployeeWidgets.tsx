import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export const SectionDivider: React.FC<{ title: string; subtitle?: string; accent?: string }> = ({ title, subtitle, accent = '#7C3AED' }) => (
  <div className="flex items-center gap-4 py-2 mb-2">
    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: accent }} />
    <div>
      <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-white/60 font-medium">{subtitle}</p>}
    </div>
  </div>
);

export const AppIconCard: React.FC<{
  icon: React.ReactNode;
  image?: string;
  name: string;
  desc: string;
  gradient: string;
  hasAccess: boolean;
  price?: number;
  onClick: () => void;
}> = ({ icon, image, name, desc, gradient, hasAccess, price, onClick }) => (
  <motion.div
    whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="relative rounded-2xl p-5 cursor-pointer shadow-sm border border-white/20 overflow-hidden"
    style={{ background: gradient }}
  >
    {image && (
      <div className="absolute inset-0 pointer-events-none select-none">
        <img src={image} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/45" />
      </div>
    )}
    <div className="relative z-10 flex justify-between items-start mb-4">
      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
        {icon}
      </div>
      {hasAccess ? (
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-500 text-white uppercase tracking-wider">Aktywny</span>
      ) : (
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-black/30 text-white uppercase tracking-wider">{price} vou</span>
      )}
    </div>
    <h3 className="relative z-10 font-bold text-white text-sm">{name}</h3>
    <p className="relative z-10 text-xs text-white/70 mt-0.5 line-clamp-2">{desc}</p>
    <div className="relative z-10 flex items-center gap-1 mt-3 text-xs font-bold text-white/80">
      {hasAccess ? 'Otwórz aplikację' : 'Aktywuj'} <ArrowRight size={12} />
    </div>
  </motion.div>
);

export interface TabDef { id: string; icon: React.ElementType; label: string; }

export const FloatingTabBar: React.FC<{ tabs: readonly TabDef[]; activeTab: string; onSelect: (id: string) => void; }> = ({ tabs, activeTab, onSelect }) => (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden">
    <div className="flex items-center gap-1 p-1.5 rounded-full shadow-2xl border border-white/80"
      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)' }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        return (
          <motion.button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            whileTap={{ scale: 0.92 }}
            className="relative flex flex-col items-center justify-center rounded-full transition-all duration-200"
            style={{ width: 56, height: 44, gap: 2 }}
          >
            {isActive && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #2563EB)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Icon
              size={18}
              className="relative z-10"
              style={{ color: isActive ? '#ffffff' : '#9ca3af' }}
            />
            <span
              className="relative z-10 font-bold"
              style={{ fontSize: 8, color: isActive ? '#ffffff' : '#9ca3af', lineHeight: 1, letterSpacing: '0.04em' }}
            >
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  </div>
);
