
import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode; // Slot for Tabs or Stats underneath
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, description, actions, children, className = '' 
}) => {
  return (
    <div className={`mb-6 animate-in fade-in slide-in-from-top-2 duration-300 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-slate-500 mt-1">
              {description}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            {actions}
          </div>
        )}
      </div>
      
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};
