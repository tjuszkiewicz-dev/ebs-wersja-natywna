
import React from 'react';
import { LucideIcon, SearchX } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "Brak danych",
  description = "Nie znaleziono żadnych elementów spełniających kryteria.",
  icon: Icon = SearchX,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 ${className}`}>
      <div className="bg-white p-4 rounded-full shadow-sm mb-4">
        <Icon size={32} className="text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-700 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed mb-6">
        {description}
      </p>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
};
