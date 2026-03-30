
import React, { useState } from 'react';
import { Company, User, Order } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { Badge } from '../../ui/Badge';
import { Building2, Users, TrendingUp, Eye, RefreshCw, Database, AlertTriangle, ArrowRight } from 'lucide-react';

interface AdminCompaniesListProps {
  companies: Company[];
  users: User[];
  orders: Order[];
  onInspectCompany: (company: Company) => void;
  onSyncCrm?: () => Promise<void>; 
}

export const AdminCompaniesList: React.FC<AdminCompaniesListProps> = ({ 
  companies, users, orders, onInspectCompany, onSyncCrm
}) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
      if (!onSyncCrm) return;
      setIsSyncing(true);
      await onSyncCrm();
      setIsSyncing(false);
  };

  const data = companies.map(c => {
      const companyEmployees = users.filter(u => u.companyId === c.id);
      const activeCount = companyEmployees.filter(u => u.status === 'ACTIVE').length;
      
      const companyOrders = orders.filter(o => o.companyId === c.id && o.status === 'PAID');
      const totalTurnover = companyOrders.reduce((acc, o) => acc + o.totalValue, 0);

      // RISK LOGIC: Low balance (under 100 or under 10 per employee) means they might need a top-up soon.
      const isLowBalance = c.balanceActive < 100 && activeCount > 5;

      return {
          ...c,
          activeEmployees: activeCount,
          totalEmployees: companyEmployees.length,
          turnover: totalTurnover,
          isLowBalance
      };
  });

  const columns: Column<typeof data[0]>[] = [
      {
          header: 'Firma',
          accessorKey: 'name',
          sortable: true,
          cell: (c) => (
              <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold border transition-colors ${c.isLowBalance ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      <Building2 size={18}/>
                  </div>
                  <div>
                      <span className="block font-bold text-slate-800 text-sm flex items-center gap-2">
                          {c.name}
                          {c.origin === 'CRM_SYNC' && <Badge variant="indigo" className="text-[9px]">API</Badge>}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">NIP: {c.nip}</span>
                  </div>
              </div>
          )
      },
      {
          header: 'Pracownicy',
          accessorKey: 'activeEmployees',
          sortable: true,
          cell: (c) => (
              <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400"/>
                  <span className="font-bold text-slate-700">{c.activeEmployees}</span>
                  <span className="text-xs text-slate-400">/ {c.totalEmployees}</span>
              </div>
          )
      },
      {
          header: 'Obrót Total',
          accessorKey: 'turnover',
          sortable: true,
          className: 'text-right',
          cell: (c) => (
              <span className="font-mono font-bold text-emerald-600">{c.turnover.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN</span>
          )
      },
      {
          header: 'Saldo Aktywne',
          accessorKey: 'balanceActive',
          sortable: true,
          className: 'text-right',
          cell: (c) => (
              <div className="flex items-center justify-end gap-2">
                  <span className={`font-mono font-bold ${c.isLowBalance ? 'text-amber-600' : 'text-slate-600'}`}>
                      {c.balanceActive} pkt
                  </span>
                  {c.isLowBalance && (
                      <span title="Niskie saldo - ryzyko zatrzymania dystrybucji">
                          <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
                      </span>
                  )}
              </div>
          )
      },
      {
          header: 'Opiekun',
          accessorKey: 'advisorId',
          cell: (c) => c.advisorId ? <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold">{c.advisorId}</span> : <span className="text-xs text-slate-300 italic">Brak</span>
      },
      {
          header: '',
          className: 'text-right',
          cell: (c) => (
              <button 
                onClick={() => onInspectCompany(c)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition"
                title="Profil Firmy"
              >
                  <ArrowRight size={18}/>
              </button>
          )
      }
  ];

  const renderMobile = (c: typeof data[0]) => (
      <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
              <span className="font-bold text-slate-800">{c.name}</span>
              {c.isLowBalance && <Badge variant="warning">Niskie Saldo</Badge>}
          </div>
          <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">Prac: {c.activeEmployees}</span>
              <span className="font-bold text-emerald-600">{c.turnover.toLocaleString()} PLN</span>
          </div>
          <button onClick={() => onInspectCompany(c)} className="w-full py-2 mt-2 bg-slate-50 text-indigo-600 font-bold text-xs rounded border border-slate-200">
              Profil Klienta
          </button>
      </div>
  );

  return (
      <div className="space-y-6">
          
          {/* CRM SYNC HEADER */}
          <div className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-2 shadow-sm">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm border border-indigo-50">
                      <Database size={20} />
                  </div>
                  <div>
                      <h3 className="font-bold text-indigo-900 text-sm">Integracja Centralna (CRM)</h3>
                      <p className="text-indigo-600/80 text-xs">Synchronizuj nowe umowy i statusy klientów.</p>
                  </div>
              </div>
              <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="px-5 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold text-xs hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm transition flex items-center gap-2 whitespace-nowrap"
              >
                  <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""}/>
                  {isSyncing ? 'Synchronizacja...' : 'Pobierz Aktualizacje'}
              </button>
          </div>

          <DataTable 
            data={data}
            columns={columns}
            mobileRenderer={renderMobile}
            title="Baza Klientów (CRM)"
            subtitle="Monitoruj saldo i aktywność firm w portfelu"
            searchPlaceholder="Szukaj firmy..."
            searchableFields={['name', 'nip', 'advisorId']}
          />
      </div>
  );
};