
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // np. 'max-w-lg'
  className?: string; // Dodatkowe klasy kontenera
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, onClose, title, icon, children, footer, maxWidth = 'max-w-xl', className = ''
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className={`bg-white w-full ${maxWidth} rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                {icon && <span className="text-indigo-600">{icon}</span>}
                {title}
            </h3>
            <button 
                onClick={onClose} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition"
                aria-label="Zamknij"
            >
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
            {children}
        </div>

        {/* Footer */}
        {footer && (
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                {footer}
            </div>
        )}
      </div>
    </div>
  );
};
