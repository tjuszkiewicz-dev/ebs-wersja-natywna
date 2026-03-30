
import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { Layers, Ticket, Clock, ShoppingCart, Banknote, TrendingUp, ExternalLink, Activity } from 'lucide-react';
import { Voucher, VoucherStatus, Order, OrderStatus, Commission, AuditLogEntry } from '../../types';
import { StatCard } from '../ui/StatCard';

interface Props {
  vouchers: Voucher[];
  orders: Order[];
  commissions: Commission[];
  auditLogs: AuditLogEntry[];
  onLogClick: (entry: AuditLogEntry) => void;
}

export const AdminStats: React.FC<Props> = ({ vouchers, orders, commissions, auditLogs, onLogClick }) => {
  const stats = useMemo(() => {
    const paidOrders = orders.filter(o => o.status === OrderStatus.PAID);

    return {
      active: vouchers.filter(v => v.status === VoucherStatus.ACTIVE || v.status === VoucherStatus.DISTRIBUTED).length,
      reserved: vouchers.filter(v => v.status === VoucherStatus.RESERVED).length,
      consumed: vouchers.filter(v => v.status === VoucherStatus.CONSUMED).length,
      expired: vouchers.filter(v => v.status === VoucherStatus.EXPIRED || v.status === VoucherStatus.BUYBACK_PENDING || v.status === VoucherStatus.BUYBACK_COMPLETE).length,
      voucherTurnover: paidOrders.reduce((acc, o) => acc + o.voucherValue, 0), 
      revenue: paidOrders.reduce((acc, o) => acc + o.feeValue, 0),
    };
  }, [vouchers, orders]);

  // Mock data for the chart based on recent activity (Simulated Trend)
  const trendData = [
      { name: 'Pon', emission: 4000, redemption: 2400 },
      { name: 'Wt', emission: 3000, redemption: 1398 },
      { name: 'Śr', emission: 2000, redemption: 9800 },
      { name: 'Czw', emission: 2780, redemption: 3908 },
      { name: 'Pt', emission: 1890, redemption: 4800 },
      { name: 'Sob', emission: 2390, redemption: 3800 },
      { name: 'Ndz', emission: 3490, redemption: 4300 },
  ];

  return (
    <div className="space-y-6 mb-8">
        {/* TOP ROW: KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
                label="Pula Platformy" 
                value={vouchers.length} 
                icon={Layers} 
                color="slate" 
                className="bg-slate-900 text-white border-slate-800"
            />
            <StatCard 
                label="Środki w Obiegu" 
                value={stats.active + stats.reserved} 
                subValue={`W tym rezerwacja: ${stats.reserved}`}
                icon={Activity} 
                color="indigo" 
            />
            <StatCard 
                label="Wykorzystanie" 
                value={stats.consumed} 
                subValue="Zrealizowane usługi"
                icon={ShoppingCart} 
                color="emerald" 
            />
            <StatCard 
                label="Przychód (Fee)" 
                value={`${stats.revenue.toLocaleString()} PLN`} 
                trend="+12% m/m"
                trendDirection="up"
                icon={TrendingUp} 
                color="blue"
            />
        </div>

        {/* MIDDLE ROW: CHARTS & LOGS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* LEFT: FINANCIAL FLOW CHART */}
            <div className="xl:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[320px]">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Banknote size={20} className="text-emerald-600"/> Przepływ Środków (Ostatnie 7 dni)
                </h3>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorEmission" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorRedemption" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8"/>
                            <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8"/>
                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                            <Area type="monotone" dataKey="emission" name="Emisja (Wpływy)" stroke="#6366f1" fillOpacity={1} fill="url(#colorEmission)" />
                            <Area type="monotone" dataKey="redemption" name="Umorzenie (Zakupy)" stroke="#10b981" fillOpacity={1} fill="url(#colorRedemption)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* RIGHT: MINI AUDIT LOG */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[320px]">
                <h3 className="font-semibold text-slate-700 mb-3 text-sm flex justify-between items-center">
                    Ostatnie Zdarzenia
                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">LIVE_FEED</span>
                </h3>
                <div className="space-y-0 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                    {auditLogs.slice(0, 8).map((log, idx) => {
                        const isClickable = !!log.targetEntityId;
                        return (
                            <div 
                                key={log.id} 
                                onClick={() => isClickable && onLogClick(log)}
                                className={`text-[11px] border-l-2 pl-3 py-2 transition-colors relative ${
                                    idx === 0 ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 hover:bg-slate-50'
                                } ${isClickable ? 'cursor-pointer group' : ''}`}
                            >
                                <div className="flex justify-between text-slate-400 mb-0.5">
                                    <span className="font-mono text-[9px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    {isClickable && <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 text-blue-500"/>}
                                </div>
                                <p className="font-bold text-slate-700 leading-tight mb-0.5">
                                    {log.action}
                                </p>
                                <p className="text-slate-500 truncate" title={log.details}>{log.details}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    </div>
  );
};
