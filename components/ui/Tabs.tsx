
import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export const Tabs: React.FC<TabsProps> = ({ items, activeTab, onChange, className = '', variant = 'pills' }) => {
  return (
    <div className={`flex overflow-x-auto no-scrollbar gap-1 ${className} ${variant === 'underline' ? 'border-b border-slate-200' : 'p-1 bg-slate-100/80 rounded-xl w-max'}`}>
      {items.map((item) => {
        const isActive = activeTab === item.id;
        
        if (variant === 'underline') {
            return (
                <button
                    key={item.id}
                    onClick={() => onChange(item.id)}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                        isActive 
                        ? 'border-indigo-600 text-indigo-700' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    {item.icon} {item.label}
                    {item.count !== undefined && (
                        <span className="ml-1 bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{item.count}</span>
                    )}
                </button>
            );
        }

        // Pills variant (Default)
        return (
            <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                    isActive 
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
            >
                {item.icon} {item.label}
                {item.count !== undefined && item.count > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {item.count}
                    </span>
                )}
            </button>
        );
      })}
    </div>
  );
};
