
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Info, AlertTriangle, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { Notification, NotificationAction, NotificationPriority } from '../../types';

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: () => void;
  onAction: (notificationId: string, action: NotificationAction) => void;
  onClearAll: () => void;
  onViewHistory: () => void;
  onNotificationClick: (n: Notification) => void; 
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  onMarkRead,
  onAction,
  onClearAll,
  onViewHistory,
  onNotificationClick
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  // Calculate position on open
  useEffect(() => {
    if (isOpen && buttonRef.current) {
        const updatePosition = () => {
            const rect = buttonRef.current!.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 12, // 12px gap
                right: window.innerWidth - rect.right
            });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
        onMarkRead();
    }
    setIsOpen(!isOpen);
  };

  const handleItemClick = (n: Notification) => {
      onNotificationClick(n);
      setIsOpen(false); 
  };

  const getPriorityColor = (priority?: NotificationPriority) => {
      switch(priority) {
          case 'CRITICAL': return 'bg-red-50 border-l-4 border-red-500';
          case 'HIGH': return 'bg-amber-50 border-l-4 border-amber-500';
          default: return 'bg-white border-l-4 border-slate-200';
      }
  };

  const getIcon = (type: string, priority?: NotificationPriority) => {
      if (priority === 'CRITICAL') return <Zap size={18} className="text-red-600 fill-red-100" />;
      switch(type) {
          case 'SUCCESS': return <CheckCircle size={18} className="text-emerald-500" />;
          case 'WARNING': return <AlertTriangle size={18} className="text-amber-500" />;
          case 'ERROR': return <AlertCircle size={18} className="text-red-500" />;
          default: return <Info size={18} className="text-blue-500" />;
      }
  };

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={handleToggle}
        className={`p-2.5 rounded-full transition relative ${isOpen ? 'bg-slate-100 text-emerald-600' : 'text-slate-500 hover:bg-slate-100 hover:text-emerald-600'}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ pointerEvents: 'none' }}>
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" 
                style={{ pointerEvents: 'auto' }}
                onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <div 
                className="bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col absolute rounded-xl animate-in fade-in zoom-in-95 origin-top-right"
                style={{
                    pointerEvents: 'auto',
                    // Mobile: Fixed position logic (CSS media query equivalent in JS)
                    ...(window.innerWidth < 768 ? {
                        top: '70px',
                        left: '16px',
                        right: '16px',
                        maxHeight: '60vh'
                    } : {
                        // Desktop: Calculated position
                        top: `${dropdownPos.top}px`,
                        right: `${dropdownPos.right}px`,
                        width: '384px', // w-96
                        maxHeight: '500px'
                    })
                }}
            >
                <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h3 className="font-bold text-slate-700 text-sm">Powiadomienia</h3>
                    <div className="flex gap-2">
                        <button onClick={onViewHistory} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition">HISTORIA</button>
                        {notifications.length > 0 && (
                            <button onClick={onClearAll} className="text-[10px] font-bold text-slate-500 hover:text-red-600 transition">WYCZYŚĆ</button>
                        )}
                        <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600 p-1">
                            <X size={18}/>
                        </button>
                    </div>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar flex-1 bg-white">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <Bell size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-xs">Brak nowych powiadomień</p>
                        </div>
                    ) : (
                        notifications.slice(0, 10).map(n => (
                            <div 
                                key={n.id} 
                                className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer group ${getPriorityColor(n.priority)}`}
                                onClick={() => handleItemClick(n)}
                            >
                                <div className="flex gap-3">
                                    <div className="mt-0.5 shrink-0">{getIcon(n.type, n.priority)}</div>
                                    <div className="flex-1">
                                        <p className={`text-sm leading-snug ${n.read ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>
                                            {n.message}
                                        </p>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(n.date).toLocaleString()}
                                            </span>
                                            {n.action && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                    n.action.completed 
                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                    : n.action.variant === 'primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                                                }`}>
                                                    {n.action.completed ? n.action.completedLabel : n.action.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {notifications.length > 10 && (
                    <div className="p-2 text-center border-t border-slate-100 bg-slate-50 shrink-0">
                        <button onClick={onViewHistory} className="text-xs font-bold text-indigo-600 hover:underline">
                            Zobacz wszystkie ({notifications.length})
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
      )}
    </>
  );
};
