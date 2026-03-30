
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  color?: 'emerald' | 'indigo' | 'blue' | 'amber' | 'slate' | 'red';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, subValue, icon: Icon, trend, trendDirection = 'neutral', color = 'slate', onClick, className = ''
}) => {
  
  const colorStyles = {
      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      amber: 'bg-amber-50 text-amber-600 border-amber-100',
      red: 'bg-red-50 text-red-600 border-red-100',
      slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  const activeStyle = colorStyles[color];

  return (
    <div 
        onClick={onClick}
        className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : ''} ${className}`}
    >
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg ${activeStyle}`}>
                <Icon size={20} />
            </div>
            {trend && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    trendDirection === 'up' ? 'bg-emerald-100 text-emerald-700' : 
                    trendDirection === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                }`}>
                    {trend}
                </span>
            )}
        </div>
        
        <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
            {subValue && <p className="text-xs text-slate-500 mt-1 font-medium">{subValue}</p>}
        </div>
    </div>
  );
};
