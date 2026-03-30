
import React from 'react';
import { X, Bell, CheckCircle, AlertTriangle, AlertCircle, Info, Trash2, ArrowRight, Eye } from 'lucide-react';
import { Notification } from '../../types';
import { DataTable, Column } from '../ui/DataTable';
import { Badge } from '../ui/Badge';

interface NotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onClearAll: () => void;
  onNotificationClick?: (n: Notification) => void;
}

export const NotificationHistoryModal: React.FC<NotificationHistoryModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onClearAll,
  onNotificationClick
}) => {
  if (!isOpen) return null;

  const columns: Column<Notification>[] = [
    {
        header: 'Typ',
        accessorKey: 'type',
        sortable: true,
        className: 'w-24 align-top pt-3',
        cell: (n) => {
            switch(n.type) {
                case 'SUCCESS': return <div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500"/> <span className="text-xs font-medium text-emerald-700 hidden sm:inline">Sukces</span></div>;
                case 'WARNING': return <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500"/> <span className="text-xs font-medium text-amber-700 hidden sm:inline">Ostrzeżenie</span></div>;
                case 'ERROR': return <div className="flex items-center gap-2"><AlertCircle size={16} className="text-red-500"/> <span className="text-xs font-medium text-red-700 hidden sm:inline">Błąd</span></div>;
                default: return <div className="flex items-center gap-2"><Info size={16} className="text-blue-500"/> <span className="text-xs font-medium text-blue-700 hidden sm:inline">Info</span></div>;
            }
        }
    },
    {
        header: 'Wiadomość',
        accessorKey: 'message',
        sortable: true,
        cell: (n) => (
            <div className="py-1">
                <span className={`block text-sm leading-snug whitespace-normal break-words max-w-[350px] lg:max-w-[450px] ${n.read ? 'text-slate-600' : 'text-slate-900 font-bold'}`}>
                    {n.message}
                </span>
                {n.action && (
                    <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                        Status akcji: {n.action.completed ? 'Wykonano' : 'Oczekuje'}
                    </span>
                )}
            </div>
        )
    },
    {
        header: 'Data',
        accessorKey: 'date',
        sortable: true,
        className: 'w-32 align-top pt-3',
        cell: (n) => <span className="text-xs text-slate-500 whitespace-nowrap block">{new Date(n.date).toLocaleDateString()} <span className="text-slate-400 block text-[10px]">{new Date(n.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></span>
    },
    {
        header: 'Akcja',
        className: 'w-28 text-right align-middle',
        cell: (n) => (n.targetEntityId && onNotificationClick) ? (
            <div className="flex justify-end">
                <button 
                    onClick={(e) => { e.stopPropagation(); onNotificationClick(n); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg transition border border-indigo-200 shadow-sm"
                    title="Przejdź do szczegółów"
                >
                    Przejdź <ArrowRight size={12} />
                </button>
            </div>
        ) : null
    }
  ];

  const renderMobileCard = (n: Notification) => (
      <div 
        className={`flex flex-col gap-3 p-3 border border-slate-100 rounded-xl bg-white shadow-sm mb-3 ${n.read ? 'opacity-90' : ''} ${n.targetEntityId ? 'active:bg-slate-50' : ''}`}
        onClick={() => n.targetEntityId && onNotificationClick && onNotificationClick(n)}
      >
          <div className="flex justify-between items-start">
              {columns[0].cell && columns[0].cell(n)}
              <span className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString()}</span>
          </div>
          
          <p className={`text-sm leading-relaxed ${n.read ? 'text-slate-600' : 'text-slate-900 font-bold'}`}>{n.message}</p>
          
          {n.targetEntityId && (
              <div className="flex justify-end mt-1 border-t border-slate-50 pt-2">
                  <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg">
                      Przejdź do obiektu <ArrowRight size={14}/>
                  </button>
              </div>
          )}
      </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                    <Bell size={20} className="text-slate-600"/>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Historia Powiadomień</h2>
                    <p className="text-xs text-slate-500">Pełny rejestr komunikatów systemowych</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                    <button 
                        onClick={onClearAll}
                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1 mr-2 border border-transparent hover:border-red-100"
                    >
                        <Trash2 size={14}/> Wyczyść
                    </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition">
                    <X size={24}/>
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-0 md:p-6 overflow-hidden bg-slate-50/30 flex flex-col">
            <div className="h-full overflow-y-auto custom-scrollbar px-4 md:px-0">
                <DataTable 
                    data={notifications}
                    columns={columns}
                    mobileRenderer={renderMobileCard}
                    searchPlaceholder="Szukaj w historii..."
                    searchableFields={['message', 'type']}
                />
            </div>
        </div>
      </div>
    </div>
  );
};
