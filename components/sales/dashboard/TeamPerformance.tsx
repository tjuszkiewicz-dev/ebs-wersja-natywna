
import React from 'react';
import { User, Company, Order, Role } from '../../../types';
import { BarChart2, TrendingUp } from 'lucide-react';

interface TeamPerformanceProps {
  currentUser: User;
  allUsers: User[];
  allCompanies: Company[];
  allOrders: Order[];
}

export const TeamPerformance: React.FC<TeamPerformanceProps> = ({ 
  currentUser, allUsers, allCompanies, allOrders 
}) => {
  
  // 1. Identify Subordinates
  let subordinates: User[] = [];
  let roleLabel = '';

  if (currentUser.role === Role.DIRECTOR) {
      // Directors see Managers
      // Logic: Find Managers who are linked to the same companies as this Director? 
      // Simplified Logic: In this mock, we just list all Managers. In real app, proper hierarchy logic needed.
      subordinates = allUsers.filter(u => u.role === Role.MANAGER);
      roleLabel = 'Managerowie';
  } else if (currentUser.role === Role.MANAGER) {
      // Managers see Advisors
      subordinates = allUsers.filter(u => u.role === Role.ADVISOR);
      roleLabel = 'Doradcy';
  } else {
      return null; // Advisors don't see this widget
  }

  // 2. Calculate Stats per Subordinate
  const teamStats = subordinates.map(sub => {
      // Companies where this subordinate is the primary contact
      const subCompanies = allCompanies.filter(c => 
          (sub.role === Role.ADVISOR && c.advisorId === sub.id) ||
          (sub.role === Role.MANAGER && c.managerId === sub.id)
      );

      // Orders from those companies
      const subOrders = allOrders.filter(o => 
          o.status === 'PAID' && subCompanies.some(c => c.id === o.companyId)
      );

      const totalTurnover = subOrders.reduce((acc, o) => acc + o.totalValue, 0);
      const activeClients = subCompanies.length;

      return {
          user: sub,
          turnover: totalTurnover,
          clients: activeClients
      };
  }).sort((a, b) => b.turnover - a.turnover); // Sort by performance

  if (teamStats.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 size={20} className="text-indigo-600" />
                Wyniki Zespołu ({roleLabel})
            </h3>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                        <th className="px-4 py-3 font-semibold">Imię i Nazwisko</th>
                        <th className="px-4 py-3 font-semibold text-center">Klienci</th>
                        <th className="px-4 py-3 font-semibold text-right">Obrót (PLN)</th>
                        <th className="px-4 py-3 font-semibold text-right">Udział</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {teamStats.map((stat, idx) => {
                        const maxTurnover = teamStats[0].turnover || 1;
                        const percentage = (stat.turnover / maxTurnover) * 100;

                        return (
                            <tr key={stat.user.id} className="hover:bg-slate-50 transition">
                                <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {stat.user.name}
                                    <span className="block text-[10px] text-slate-400 font-normal">{stat.user.email}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{stat.clients}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                                    {stat.turnover.toLocaleString('pl-PL')}
                                </td>
                                <td className="px-4 py-3 w-32 align-middle">
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-500 rounded-full" 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
  );
};
