
import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Building2, Users, FileText, Activity, MapPin, 
  TrendingUp, Calendar, CreditCard, ShieldCheck, Edit2, Save, RotateCcw, AlertCircle,
  Clock, CheckCircle, XCircle, FileSpreadsheet, LayoutList, AlignLeft, Briefcase, DollarSign, GitMerge, FileStack, List
} from 'lucide-react';
import { 
  Company, User, Order, AuditLogEntry, Voucher, 
  VoucherStatus, OrderStatus, DistributionBatch
} from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { Badge } from '../../ui/Badge';
import { StatusBadge } from '../../ui/StatusBadge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { DocumentDownloadButton } from '../../Documents/DocumentDownloadButton';

interface CompanyInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
  employees: User[]; 
  allUsers: User[]; 
  orders: Order[];
  logs: AuditLogEntry[];
  vouchers: Voucher[];
  distributionBatches?: DistributionBatch[]; 
  onUpdateCompany: (companyId: string, data: Partial<Company>) => void;
  onViewDocument: (type: 'DEBIT_NOTE' | 'VAT_INVOICE' | 'BUYBACK_AGREEMENT', data: any) => void;
}

type Tab = 'OVERVIEW' | 'EMPLOYEES' | 'ORDERS' | 'PROTOCOLS' | 'LOGS';
type OrderViewMode = 'TABLE' | 'TIMELINE';

export const CompanyInspectionModal: React.FC<CompanyInspectionModalProps> = ({
  isOpen, onClose, company, employees, allUsers, orders, logs, vouchers, distributionBatches = [], onUpdateCompany, onViewDocument
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [orderViewMode, setOrderViewMode] = useState<OrderViewMode>('TIMELINE');
  const [isEditing, setIsEditing] = useState(false);

  // --- SALES STRUCTURE RESOLUTION ---
  const advisor = allUsers.find(u => u.id === company.advisorId);
  const manager = allUsers.find(u => u.id === company.managerId);
  const director = allUsers.find(u => u.id === company.directorId);

  // --- EDIT STATE ---
  const [editForm, setEditForm] = useState<Partial<Company>>({});

  useEffect(() => {
      if(isOpen) {
          setEditForm({
              name: company.name,
              nip: company.nip,
              advisorId: company.advisorId,
              managerId: company.managerId,
              balanceActive: company.balanceActive,
              customPaymentTermsDays: company.customPaymentTermsDays,
              customVoucherValidityDays: company.customVoucherValidityDays
          });
          setIsEditing(false);
      }
  }, [isOpen, company]);

  // --- HR LOGS FILTER ---
  const hrLogs = useMemo(() => {
      // Filter logs related to this company's context (orders, employees)
      return logs.filter(l => {
          if (l.targetEntityId === company.id) return true;
          // Check if actor is an HR from this company
          const actor = allUsers.find(u => u.id === l.actorId);
          return actor && actor.companyId === company.id && actor.role === 'HR';
      });
  }, [logs, company.id, allUsers]);

  if (!isOpen) return null;

  const handleSave = () => {
      onUpdateCompany(company.id, editForm);
      setIsEditing(false);
  };

  const handleCancel = () => {
      setEditForm({ ...company });
      setIsEditing(false);
  };

  // --- ANALYTICS DATA ---
  const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;
  const totalSpent = orders.filter(o => o.status === OrderStatus.PAID).reduce((acc, o) => acc + o.totalValue, 0);
  
  // 1. Employee Growth (Simulated)
  const growthData = useMemo(() => {
      const months = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
      let count = 0;
      return months.map((m) => {
          count += Math.ceil(employees.length / 12); 
          return { name: m, employees: Math.min(count, employees.length) };
      });
  }, [employees]);

  // 2. Monthly Spending
  const monthlySpendingData = useMemo(() => {
      const data: Record<string, number> = {};
      const now = new Date();
      
      for(let i=11; i>=0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = d.toLocaleString('pl-PL', { month: 'short' });
          data[key] = 0;
      }

      orders.forEach(o => {
          if (o.status !== OrderStatus.PAID) return;
          const d = new Date(o.date);
          if (now.getTime() - d.getTime() < 365 * 24 * 60 * 60 * 1000) {
              const key = d.toLocaleString('pl-PL', { month: 'short' });
              if (data[key] !== undefined) {
                  data[key] += o.totalValue;
              }
          }
      });

      return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // --- COLUMNS ---
  const employeeColumns: Column<User>[] = [
      { header: 'Nazwisko i Imię', accessorKey: 'name', sortable: true, cell: (u) => <span className="font-medium">{u.name}</span> },
      { header: 'Email', accessorKey: 'email', cell: (u) => <span className="text-xs text-slate-500">{u.email}</span> },
      { header: 'Dział', accessorKey: 'department', sortable: true, cell: (u) => <span className="text-xs bg-slate-100 px-2 py-1 rounded">{u.organization?.department || u.department || '-'}</span> },
      { header: 'Saldo', accessorKey: 'voucherBalance', className: 'text-right', cell: (u) => <span className="font-mono font-bold text-emerald-600">{u.voucherBalance}</span> }
  ];

  const orderColumns: Column<Order>[] = [
      { header: 'ID', accessorKey: 'id', cell: (o) => <span className="font-mono text-xs">{o.id}</span> },
      { header: 'Data', accessorKey: 'date', cell: (o) => <span className="text-xs">{new Date(o.date).toLocaleDateString()}</span> },
      { header: 'Vouchery', accessorKey: 'voucherValue', className: 'text-right', cell: (o) => <span>{o.voucherValue} PLN</span> },
      { header: 'Obsługa', accessorKey: 'feeValue', className: 'text-right', cell: (o) => <span className="text-slate-500">{o.feeValue.toFixed(2)} PLN</span> },
      { header: 'Razem', accessorKey: 'totalValue', className: 'text-right', cell: (o) => <span className="font-bold">{o.totalValue.toFixed(2)} PLN</span> },
      { header: 'Status', accessorKey: 'status', cell: (o) => <StatusBadge status={o.status} /> }
  ];

  const protocolColumns: Column<DistributionBatch>[] = [
      { header: 'Data', accessorKey: 'date', sortable: true, cell: (b) => <span className="text-slate-600 font-mono text-xs">{new Date(b.date).toLocaleDateString()}</span> },
      { header: 'ID', accessorKey: 'id', cell: (b) => <span className="font-bold text-slate-700 text-xs">{b.id}</span> },
      { header: 'Typ', cell: (b) => b.items.length > 1 ? <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">Masowy</span> : <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">Pojedynczy</span> },
      { header: 'Ilość', accessorKey: 'items', className: 'text-center', cell: (b) => <span className="text-xs font-bold">{b.items.length} os.</span> },
      { header: 'Kwota', accessorKey: 'totalAmount', className: 'text-right', cell: (b) => <span className="font-mono font-bold text-slate-800">{b.totalAmount.toLocaleString()} PLN</span> },
      { header: 'Akcja', className: 'text-right', cell: (b) => (
          <div className="flex justify-end">
              <DocumentDownloadButton docName={`Protokol_${b.id}`} type="PROTOCOL" data={b} company={company} />
          </div>
      )}
  ];

  const logColumns: Column<AuditLogEntry>[] = [
      { header: 'Czas', accessorKey: 'timestamp', cell: (l) => <span className="text-xs text-slate-500">{new Date(l.timestamp).toLocaleString()}</span> },
      { header: 'Aktor', accessorKey: 'actorName', cell: (l) => <span className="font-medium text-slate-700 text-xs">{l.actorName}</span> },
      { header: 'Akcja', accessorKey: 'action', cell: (l) => <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{l.action}</span> },
      { header: 'Szczegóły', accessorKey: 'details', cell: (l) => <span className="text-xs truncate max-w-[300px] block" title={l.details}>{l.details}</span> }
  ];

  // --- RENDERERS ---

  const renderTimeline = () => {
      const sortedOrders = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (sortedOrders.length === 0) return <div className="p-8 text-center text-slate-400">Brak historii zamówień.</div>;

      return (
          <div className="relative border-l-2 border-slate-200 ml-4 my-4 space-y-8">
              {sortedOrders.map((order) => {
                  const statusColor = order.status === OrderStatus.PAID ? 'bg-emerald-500' : 
                                      order.status === OrderStatus.REJECTED ? 'bg-red-500' : 'bg-amber-500';
                  
                  const statusIcon = order.status === OrderStatus.PAID ? <CheckCircle size={14} className="text-white"/> : 
                                     order.status === OrderStatus.REJECTED ? <XCircle size={14} className="text-white"/> : <Clock size={14} className="text-white"/>;

                  return (
                      <div key={order.id} className="relative ml-6 animate-in slide-in-from-bottom-2">
                          {/* Dot on Line */}
                          <div className={`absolute -left-[33px] top-0 w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${statusColor}`}>
                              {statusIcon}
                          </div>
                          
                          {/* Card */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <span className="font-mono text-xs text-slate-400 block">{order.id}</span>
                                      <span className="font-bold text-slate-800 text-sm">{new Date(order.date).toLocaleDateString()}</span>
                                  </div>
                                  <StatusBadge status={order.status} className="scale-90 origin-right" />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm mt-3 border-t border-slate-100 pt-3">
                                  <div>
                                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Vouchery</span>
                                      <span className="font-mono">{order.voucherValue.toLocaleString()} PLN</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Razem (Brutto)</span>
                                      <span className="font-bold text-slate-900">{order.totalValue.toLocaleString()} PLN</span>
                                  </div>
                              </div>

                              {order.status === OrderStatus.PAID && (
                                  <div className="mt-3 flex gap-2">
                                      <button 
                                        onClick={() => onViewDocument('DEBIT_NOTE', order)}
                                        className="bg-slate-50 px-2 py-1 rounded text-[10px] text-slate-500 flex items-center gap-1 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition cursor-pointer"
                                        title="Pobierz Notę"
                                      >
                                          <FileSpreadsheet size={10} /> Nota {order.docVoucherId}
                                      </button>
                                      <button 
                                        onClick={() => onViewDocument('VAT_INVOICE', order)}
                                        className="bg-slate-50 px-2 py-1 rounded text-[10px] text-slate-500 flex items-center gap-1 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition cursor-pointer"
                                        title="Pobierz Fakturę"
                                      >
                                          <FileText size={10} /> FV {order.docFeeId}
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-6 shrink-0 flex justify-between items-start relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10">
                <Building2 size={200} />
            </div>
            
            <div className="flex items-center gap-5 relative z-10 w-full">
                <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center text-3xl font-bold backdrop-blur-md border border-white/20">
                    {company.name.charAt(0)}
                </div>
                <div className="flex-1">
                    {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input 
                                type="text" 
                                value={editForm.name} 
                                onChange={e => setEditForm({...editForm, name: e.target.value})}
                                className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white font-bold text-lg focus:outline-none focus:border-indigo-500"
                            />
                            <input 
                                type="text" 
                                value={editForm.nip} 
                                onChange={e => setEditForm({...editForm, nip: e.target.value})}
                                className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold tracking-tight">{company.name}</h2>
                            <div className="flex items-center gap-4 text-slate-400 text-sm mt-1">
                                <span className="flex items-center gap-1"><CreditCard size={14}/> NIP: {company.nip}</span>
                                <span className="flex items-center gap-1"><MapPin size={14}/> Polska, Warszawa</span>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition">
                                <Save size={16}/> Zapisz
                            </button>
                            <button onClick={handleCancel} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2 text-sm font-bold transition">
                                <RotateCcw size={16}/> Anuluj
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition">
                            <Edit2 size={16}/> Edytuj
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white ml-2">
                        <X size={24} />
                    </button>
                </div>
            </div>
        </div>

        {/* TABS */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 pt-2 flex gap-1 overflow-x-auto">
            {[
                { id: 'OVERVIEW', label: 'Podsumowanie', icon: <Activity size={16}/> },
                { id: 'EMPLOYEES', label: `Pracownicy (${employees.length})`, icon: <Users size={16}/> },
                { id: 'ORDERS', label: `Zamówienia (${orders.length})`, icon: <FileText size={16}/> },
                { id: 'PROTOCOLS', label: `Protokoły (${distributionBatches.length})`, icon: <FileStack size={16}/> },
                { id: 'LOGS', label: 'Dziennik HR', icon: <List size={16}/> },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
                        activeTab === tab.id 
                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-t-lg'
                    }`}
                >
                    {tab.icon} {tab.label}
                </button>
            ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            
            {activeTab === 'OVERVIEW' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                    
                    {/* 1. KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-xs text-slate-400 font-bold uppercase">Zatrudnienie</p>
                            <p className="text-2xl font-bold text-slate-800">{activeEmployees} <span className="text-sm font-normal text-slate-400">/ {employees.length}</span></p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-xs text-slate-400 font-bold uppercase">Całkowity Obrót</p>
                            <p className="text-2xl font-bold text-emerald-600">{totalSpent.toLocaleString()} PLN</p>
                        </div>
                        <div className="p-4 rounded-xl border bg-white border-slate-200 shadow-sm">
                            <p className="text-xs text-slate-400 font-bold uppercase">Saldo Aktywne</p>
                            <p className="text-2xl font-bold text-indigo-600">{company.balanceActive} pkt</p>
                        </div>
                    </div>

                    {/* 2. SALES STRUCTURE CARD */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Briefcase size={20} className="text-indigo-600"/> Struktura Sprzedaży i Prowizje
                            </h3>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">
                                ID: {company.id}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                            {/* Advisor */}
                            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                <p className="text-[10px] text-indigo-500 uppercase font-bold mb-1">Opiekun Klienta (Podpis)</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                        {advisor?.name.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{advisor?.name || 'Brak'}</p>
                                        <p className="text-[10px] text-slate-500">{advisor?.email || '-'}</p>
                                    </div>
                                </div>
                                <div className="mt-2 text-[10px] text-indigo-400 flex items-center gap-1">
                                    <CheckCircle size={10}/> Prowizja za pozyskanie
                                </div>
                            </div>

                            {/* Manager */}
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Manager Regionu</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                        {manager?.name.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{manager?.name || 'Brak'}</p>
                                        <p className="text-[10px] text-slate-500">{manager?.email || '-'}</p>
                                    </div>
                                </div>
                                <div className="mt-2 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                    <DollarSign size={10}/> Prowizja Pasywna (2. msc+)
                                </div>
                            </div>

                            {/* Director */}
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Dyrektor Handlowy</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                        {director?.name.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{director?.name || 'Brak'}</p>
                                        <p className="text-[10px] text-slate-500">{director?.email || '-'}</p>
                                    </div>
                                </div>
                                <div className="mt-2 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                    <DollarSign size={10}/> Prowizja Pasywna (2. msc+)
                                </div>
                            </div>
                        </div>

                        {/* Integration Placeholder Info */}
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-3 text-xs text-amber-800 items-start">
                            <GitMerge size={16} className="shrink-0 mt-0.5"/>
                            <div>
                                <strong>Logika Prowizyjna:</strong> Automatyczne naliczanie prowizji dla struktury hierarchicznej (Manager/Dyrektor) od drugiego miesiąca współpracy.
                                <br/>
                                <span className="text-amber-600 opacity-80 mt-1 block">
                                    // Placeholder dla integracji backendowej (Commission Engine ID: CE-2025-V2)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. CHARTS ROW */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* CHART 1: EMPLOYEE GROWTH */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-64">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <TrendingUp size={18} className="text-blue-500"/> Wzrost Zatrudnienia (YTD)
                            </h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={growthData}>
                                        <defs>
                                            <linearGradient id="colorEmp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} stroke="#94a3b8"/>
                                        <YAxis axisLine={false} tickLine={false} fontSize={10} stroke="#94a3b8"/>
                                        <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} itemStyle={{color: '#fff'}} />
                                        <Area type="monotone" dataKey="employees" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEmp)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* CHART 2: MONTHLY SPENDING */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-64">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <CreditCard size={18} className="text-emerald-500"/> Wydatki Miesięczne (12 m-cy)
                            </h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlySpendingData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} stroke="#94a3b8"/>
                                        <YAxis axisLine={false} tickLine={false} fontSize={10} stroke="#94a3b8" />
                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} name="PLN" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'EMPLOYEES' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
                    <DataTable 
                        data={employees} 
                        columns={employeeColumns} 
                        mobileRenderer={(u) => <div>{u.name}</div>}
                        searchPlaceholder="Szukaj pracownika..."
                    />
                </div>
            )}

            {/* ORDERS TAB WITH TIMELINE */}
            {activeTab === 'ORDERS' && (
                <div className="space-y-6 animate-in fade-in">
                    
                    {/* View Switcher & Stats */}
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setOrderViewMode('TIMELINE')}
                                className={`px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition ${orderViewMode === 'TIMELINE' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                <LayoutList size={16}/> Oś Czasu
                            </button>
                            <button 
                                onClick={() => setOrderViewMode('TABLE')}
                                className={`px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition ${orderViewMode === 'TABLE' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                <AlignLeft size={16}/> Tabela
                            </button>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Średnie Zamówienie</span>
                            <span className="text-sm font-bold text-slate-800">
                                {orders.length > 0 ? (totalSpent / orders.filter(o => o.status === 'PAID').length).toLocaleString() : 0} PLN
                            </span>
                        </div>
                    </div>

                    {orderViewMode === 'TIMELINE' ? (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Historia Zamówień (Timeline)</h4>
                            {renderTimeline()}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                            <DataTable 
                                data={orders} 
                                columns={orderColumns} 
                                mobileRenderer={(o) => <div>{o.id}</div>}
                                searchPlaceholder="Szukaj zamówienia..."
                            />
                        </div>
                    )}
                </div>
            )}

            {/* PROTOCOLS TAB */}
            {activeTab === 'PROTOCOLS' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
                    <DataTable 
                        data={distributionBatches} 
                        columns={protocolColumns} 
                        mobileRenderer={(b) => <div>{b.id}</div>}
                        title="Rejestr Dystrybucji"
                        subtitle="Protokoły masowego i pojedynczego przekazania środków"
                        searchPlaceholder="Szukaj protokołu..."
                        searchableFields={['id', 'hrName']}
                    />
                </div>
            )}

            {activeTab === 'LOGS' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
                    <DataTable 
                        data={hrLogs} 
                        columns={logColumns} 
                        mobileRenderer={(l) => <div>{l.action}</div>}
                        searchPlaceholder="Szukaj w logach HR..."
                    />
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
