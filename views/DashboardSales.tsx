
import React, { useState } from 'react';
import { User, Commission, Company, Order, Role } from '../types';
import { SalesStats } from '../components/sales/dashboard/SalesStats';
import { TeamPerformance } from '../components/sales/dashboard/TeamPerformance';
import { SalesCommissionTable } from '../components/sales/SalesCommissionTable';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { LayoutDashboard, DollarSign } from 'lucide-react';

interface DashboardSalesProps {
  currentUser: User;
  commissions: Commission[];
  companies: Company[];
  orders: Order[];
  allUsers: User[]; // Needed for hierarchy view
}

type Tab = 'OVERVIEW' | 'COMMISSIONS';

export const DashboardSales: React.FC<DashboardSalesProps> = ({ 
  currentUser, commissions, companies, orders, allUsers 
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');

  // Filter data for the current user context
  const myCommissions = commissions.filter(c => c.agentId === currentUser.id);
  
  // My Companies (Direct or Indirect)
  const myCompanies = companies.filter(c => 
      c.advisorId === currentUser.id || 
      c.managerId === currentUser.id || 
      c.directorId === currentUser.id
  );

  // My Orders (Orders from my companies)
  const myOrders = orders.filter(o => myCompanies.some(c => c.id === o.companyId));

  // Chart Data: Commission Mix
  const acquisition = myCommissions.filter(c => c.type === 'ACQUISITION').reduce((a, b) => a + b.amount, 0);
  const recurring = myCommissions.filter(c => c.type === 'RECURRING').reduce((a, b) => a + b.amount, 0);
  
  const chartData = [
      { name: 'Pozyskanie (New Biz)', value: acquisition, color: '#4f46e5' }, // Indigo
      { name: 'Utrzymanie (Recurring)', value: recurring, color: '#10b981' }  // Emerald
  ];

  return (
    <div className="space-y-6">
        <PageHeader 
            title="Panel Sprzedaży" 
            description={`Witaj, ${currentUser.name} (${currentUser.role}). Zarządzaj swoim portfelem i prowizjami.`}
        >
            <Tabs 
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id as Tab)}
                items={[
                    { id: 'OVERVIEW', label: 'Pulpit', icon: <LayoutDashboard size={16}/> },
                    { id: 'COMMISSIONS', label: 'Prowizje', icon: <DollarSign size={16}/> }
                ]}
            />
        </PageHeader>

        {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <SalesStats 
                    role={currentUser.role}
                    commissions={myCommissions}
                    myCompanies={myCompanies}
                    orders={myOrders}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Team Performance (only for Managers/Directors) */}
                    <div className="lg:col-span-2">
                        {(currentUser.role === Role.DIRECTOR || currentUser.role === Role.MANAGER) ? (
                            <TeamPerformance 
                                currentUser={currentUser}
                                allUsers={allUsers}
                                allCompanies={companies}
                                allOrders={orders}
                            />
                        ) : (
                            /* Advisor View: Recent Companies */
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
                                <h3 className="font-bold text-slate-800 mb-4">Moje Aktywne Firmy</h3>
                                <div className="space-y-3">
                                    {myCompanies.length === 0 && <p className="text-slate-400 text-sm">Brak przypisanych firm.</p>}
                                    {myCompanies.map(c => (
                                        <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div>
                                                <p className="font-bold text-sm text-slate-700">{c.name}</p>
                                                <p className="text-xs text-slate-400">NIP: {c.nip}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-slate-500 uppercase">Saldo Aktywne</p>
                                                <p className="font-mono text-emerald-600 font-bold">{c.balanceActive} pkt</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Commission Structure Chart */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[300px]">
                        <h3 className="font-bold text-slate-800 mb-2">Struktura Przychodu</h3>
                        <div className="flex-1 w-full h-full relative">
                             {acquisition + recurring > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                             ) : (
                                 <div className="flex items-center justify-center h-full text-slate-400 text-sm">Brak danych</div>
                             )}
                             {/* Center Text */}
                             {(acquisition + recurring > 0) && (
                                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                     <div className="text-center">
                                         <span className="block text-2xl font-bold text-slate-800">{(acquisition + recurring).toFixed(0)}</span>
                                         <span className="text-[10px] uppercase text-slate-400 font-bold">PLN</span>
                                     </div>
                                 </div>
                             )}
                        </div>
                        <div className="mt-4 space-y-2">
                            {chartData.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="flex items-center gap-2 text-slate-600">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                                        {item.name}
                                    </span>
                                    <span className="font-bold">{item.value.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'COMMISSIONS' && (
            <div className="animate-in slide-in-from-bottom-4 duration-300">
                <SalesCommissionTable commissions={myCommissions} />
            </div>
        )}
    </div>
  );
};
