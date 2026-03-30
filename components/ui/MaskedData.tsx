
import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface MaskedDataProps {
  value: string | number;
  type?: 'TEXT' | 'MONEY' | 'IBAN' | 'PESEL';
  visible?: boolean; // Controlled externally if needed
}

export const MaskedData: React.FC<MaskedDataProps> = ({ value, type = 'TEXT', visible = false }) => {
  const [isRevealed, setIsRevealed] = useState(visible);

  const toggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsRevealed(!isRevealed);
  };

  const getMaskedValue = () => {
      const strVal = String(value);
      if (type === 'MONEY') return '•••• PLN';
      if (type === 'IBAN') return `PL •••• •••• ••••`;
      if (type === 'PESEL') return '•••••••••••';
      return '••••••••';
  };

  const getDisplayValue = () => {
      if (type === 'MONEY') return typeof value === 'number' ? value.toFixed(2) + ' PLN' : value;
      if (type === 'IBAN') return String(value).replace(/(.{4})/g, '$1 ').trim();
      return value;
  };

  return (
    <div 
        className={`inline-flex items-center gap-2 group cursor-pointer select-none transition-all rounded px-1.5 py-0.5 ${isRevealed ? 'bg-indigo-50/50' : 'bg-slate-100/50 hover:bg-slate-100'}`}
        onClick={toggle}
        title={isRevealed ? "Kliknij, aby ukryć" : "Kliknij, aby odsłonić (RODO)"}
    >
        <span className={`font-mono text-sm ${isRevealed ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>
            {isRevealed ? getDisplayValue() : getMaskedValue()}
        </span>
        <div className="text-slate-400 group-hover:text-indigo-600 transition-colors">
            {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </div>
    </div>
  );
};
