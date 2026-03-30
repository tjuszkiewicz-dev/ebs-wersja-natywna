
import React, { useState } from 'react';
import { Mail, Smartphone, Bell, AppWindow, ToggleRight, ToggleLeft, Info } from 'lucide-react';
import { NotificationTrigger, NotificationPreferenceItem } from '../../types';

// Mock Data for initial state (In real app, this comes from API)
const INITIAL_PREFERENCES: NotificationPreferenceItem[] = [
    { 
        id: 'PREF-01', 
        trigger: NotificationTrigger.VOUCHER_GRANTED, 
        label: 'Otrzymanie środków (Vouchery)',
        channels: { email: true, sms: true, push: true, inApp: true } 
    },
    { 
        id: 'PREF-02', 
        trigger: NotificationTrigger.ORDER_PENDING, 
        label: 'Nowe zamówienie do akceptacji',
        channels: { email: true, sms: false, push: true, inApp: true } 
    },
    { 
        id: 'PREF-03', 
        trigger: NotificationTrigger.ORDER_UNPAID, 
        label: 'Monit płatności (Faktury)',
        channels: { email: true, sms: true, push: false, inApp: true } 
    },
    { 
        id: 'PREF-04', 
        trigger: NotificationTrigger.SYSTEM_ALERT, 
        label: 'Alerty Bezpieczeństwa',
        channels: { email: true, sms: true, push: true, inApp: true } 
    },
    { 
        id: 'PREF-05', 
        trigger: NotificationTrigger.VOUCHER_EXPIRING, 
        label: 'Wygasanie środków',
        channels: { email: false, sms: false, push: true, inApp: true } 
    }
];

export const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState(INITIAL_PREFERENCES);

  const toggleChannel = (prefId: string, channel: keyof typeof INITIAL_PREFERENCES[0]['channels']) => {
      setPreferences(prev => prev.map(p => {
          if (p.id === prefId) {
              return { 
                  ...p, 
                  channels: { ...p.channels, [channel]: !p.channels[channel] }
              };
          }
          return p;
      }));
  };

  return (
    <div className="space-y-6">
        <div>
            <h2 className="text-lg font-bold text-slate-800">Centrum Preferencji</h2>
            <p className="text-sm text-slate-500">Zarządzaj kanałami komunikacji dla poszczególnych zdarzeń.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-bold text-slate-700 w-1/3">Zdarzenie</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 text-center w-32">
                                <div className="flex flex-col items-center gap-1">
                                    <Mail size={18} />
                                    <span className="text-[10px] uppercase">E-mail</span>
                                </div>
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-500 text-center w-32">
                                <div className="flex flex-col items-center gap-1">
                                    <Smartphone size={18} />
                                    <span className="text-[10px] uppercase">SMS</span>
                                </div>
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-500 text-center w-32">
                                <div className="flex flex-col items-center gap-1">
                                    <Bell size={18} />
                                    <span className="text-[10px] uppercase">Push</span>
                                </div>
                            </th>
                            <th className="px-4 py-3 font-semibold text-slate-500 text-center w-32">
                                <div className="flex flex-col items-center gap-1">
                                    <AppWindow size={18} />
                                    <span className="text-[10px] uppercase">In-App</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {preferences.map((pref) => (
                            <tr key={pref.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4 font-medium text-slate-800">
                                    {pref.label}
                                </td>
                                {(['email', 'sms', 'push', 'inApp'] as const).map(channel => (
                                    <td key={channel} className="px-4 py-4 text-center">
                                        <button 
                                            onClick={() => toggleChannel(pref.id, channel)}
                                            className="text-slate-300 hover:text-slate-500 transition focus:outline-none"
                                        >
                                            {pref.channels[channel] ? (
                                                <ToggleRight size={28} className="text-emerald-500" />
                                            ) : (
                                                <ToggleLeft size={28} />
                                            )}
                                        </button>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
            <Info size={20} className="text-blue-600 mt-0.5" />
            <div>
                <h4 className="text-sm font-bold text-blue-800">Polityka Powiadomień Krytycznych</h4>
                <p className="text-xs text-blue-700 mt-1">
                    Niektóre powiadomienia (np. reset hasła, błędy płatności) są wysyłane niezależnie od ustawień preferencji ze względów bezpieczeństwa.
                </p>
            </div>
        </div>
    </div>
  );
};
