
import React, { useMemo } from 'react';
import { Wallet, Grid, History, User, Heart, Scale } from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  onChangeTab: (tab: any) => void;
  onProfileClick: () => void;
  hasMentalHealth?: boolean;
  hasLegal?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ 
  activeTab, 
  onChangeTab, 
  onProfileClick,
  hasMentalHealth = false,
  hasLegal = false
}) => {
  const tabs = useMemo(() => {
    const base = [
      { id: 'WALLET', label: 'Pulpit', icon: <Wallet size={20} /> },
      { id: 'CATALOG', label: 'Zamknięty Katalog Usług', icon: <Grid size={20} /> },
      { id: 'HISTORY', label: 'Historia', icon: <History size={20} /> },
    ];

    if (hasMentalHealth) {
        base.push({ id: 'WELLBEING', label: 'Wellbeing', icon: <Heart size={20} /> });
    }
    if (hasLegal) {
        base.push({ id: 'LEGAL', label: 'Prawnik', icon: <Scale size={20} /> });
    }

    return base;
  }, [hasMentalHealth, hasLegal]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 pb-safe z-50 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChangeTab(tab.id)}
          className={`flex flex-col items-center gap-1 p-2 flex-1 rounded-xl transition-all ${
            activeTab === tab.id 
              ? 'text-emerald-600 font-bold bg-emerald-50' 
              : 'text-slate-400 font-medium hover:bg-slate-50'
          }`}
        >
          {tab.icon}
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
      
      <button 
        onClick={onProfileClick}
        className="flex flex-col items-center gap-1 p-2 text-slate-400 font-medium hover:bg-slate-50 rounded-xl"
      >
        <User size={20} />
        <span className="text-[10px]">Profil</span>
      </button>
      
      <style>{`
        .pb-safe {
            padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
};
