
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
  index: number;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onClose, index }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000); // Auto dismiss after 5s

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const getStyles = () => {
    switch (toast.type) {
      case 'SUCCESS':
        return 'bg-white border-l-4 border-emerald-500 text-slate-800 shadow-lg shadow-emerald-900/5 ring-1 ring-black/5';
      case 'ERROR':
        return 'bg-white border-l-4 border-red-500 text-slate-800 shadow-lg shadow-red-900/5 ring-1 ring-black/5';
      case 'WARNING':
        return 'bg-white border-l-4 border-amber-500 text-slate-800 shadow-lg shadow-amber-900/5 ring-1 ring-black/5';
      default:
        return 'bg-white border-l-4 border-blue-500 text-slate-800 shadow-lg shadow-blue-900/5 ring-1 ring-black/5';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'SUCCESS': return <CheckCircle size={20} className="text-emerald-500" />;
      case 'ERROR': return <AlertCircle size={20} className="text-red-500" />;
      case 'WARNING': return <AlertTriangle size={20} className="text-amber-500" />;
      default: return <Info size={20} className="text-blue-500" />;
    }
  };

  return (
    <div 
        className={`flex items-start gap-3 p-4 rounded-lg transition-all duration-300 w-full md:w-96 transform translate-x-0 ${getStyles()} animate-in slide-in-from-right-full fade-in`}
        style={{ marginBottom: '0.75rem' }}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm mb-0.5 text-slate-800">{toast.title}</h4>
        <p className="text-xs text-slate-500 leading-relaxed">{toast.message}</p>
      </div>
      <button 
        onClick={() => onClose(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
      >
        <X size={16} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-0 md:right-4 z-[200] flex flex-col items-end px-4 md:px-0 pointer-events-none max-h-screen overflow-hidden py-2">
      {/* Container wrapper needs pointer-events-none so it doesn't block clicks on the page, 
          but children need pointer-events-auto */}
      <div className="pointer-events-auto flex flex-col items-end">
        {toasts.map((t, idx) => (
          <ToastItem key={t.id} toast={t} onClose={removeToast} index={idx} />
        ))}
      </div>
    </div>
  );
};
