
import React, { useState, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { Download, FileText, TrendingUp, Users, Wallet, AlertCircle, Calendar, Filter, Database, FileCog, PieChart as PieIcon, Info } from 'lucide-react';
import { Company, User, Order, Voucher, VoucherStatus, OrderStatus } from '../../../types';
import { Badge } from '../../ui/Badge';

interface HRReportCenterProps {
    company: Company;
    employees: User[];
    orders: Order[];
    vouchers: Voucher[];
}

type PayrollSystem = 'ENOVA' | 'SYMFONIA' | 'OPTIMA' | 'SAP' | 'GENERIC';

const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#64748b', '#8b5cf6'];

export const HRReportCenter: React.FC<HRReportCenterProps> = ({ company, employees, orders, vouchers }) => {
    
    // --- STATE ---
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [selectedSystem, setSelectedSystem] = useState<PayrollSystem>('GENERIC');

    // --- ANALYTICS DATA PREP ---
    const activeEmployees = employees.filter(e => e.status === 'ACTIVE');
    
    // 1. Department Allocation (Pie Chart Data)
    const departmentStats = useMemo(() => {
        const stats: Record<string, number> = {};
        
        // Sum active/distributed/consumed voucher values by user department
        vouchers.forEach(v => {
            if (v.companyId !== company.id) return;
            // We consider all vouchers that are assigned to a user (Distributed, Consumed or Active/Assigned)
            if (v.ownerId && (v.status === VoucherStatus.DISTRIBUTED || v.status === VoucherStatus.CONSUMED || v.status === VoucherStatus.ACTIVE)) {
                const user = employees.find(u => u.id === v.ownerId);
                const dept = user?.organization?.department || user?.department || 'Pozostałe';
                
                stats[dept] = (stats[dept] || 0) + v.value;
            }
        });

        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Sort descending
    }, [vouchers, employees, company.id]);

    // 2. Cost Trends (Area Chart)
    const monthlyCostData = useMemo(() => {
        const data: Record<string, number> = {};
        const now = new Date();
        for(let i=5; i>=0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleString('pl-PL', { month: 'short' });
            data[key] = 0;
        }
        orders.forEach(o => {
            if(o.companyId !== company.id || o.status === OrderStatus.REJECTED) return;
            const d = new Date(o.date);
            if (now.getTime() - d.getTime() < 180 * 24 * 60 * 60 * 1000) {
                const key = d.toLocaleString('pl-PL', { month: 'short' });
                if(data[key] !== undefined) data[key] += o.totalValue;
            }
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [orders, company.id]);

    // --- SYSTEM SPECIFIC FORMATTERS ---

    const generateEnovaTXT = (data: any[]) => {
        // Enova format: KOD_PRACOWNIKA;KOD_ELEMENTU;WARTOSC;DATA
        // E.g., KOWALSKI_JAN;DOD_VOUCHER;200.00;2025-05-01
        return data.map(item => {
            const empCode = item.user.email.split('@')[0].toUpperCase(); // Mock ID
            return `${empCode};DOD_BENEFIT;${item.amount.toFixed(2).replace('.', ',')};${selectedMonth}-01`;
        }).join("\r\n");
    };

    const generateSymfoniaCSV = (data: any[]) => {
        // Symfonia: ID;Nazwisko;Imie;Kwota;Skladnik
        return data.map(item => {
            return `${item.user.id};"${item.user.name.split(' ').pop()}";"${item.user.name.split(' ')[0]}";${item.amount.toFixed(2)};VOUCHER_PRIME`;
        }).join("\n");
    };

    const generateSapCSV = (data: any[]) => {
        // SAP: PersonnelNumber,WageType,Amount,Currency,CostCenter
        return data.map(item => {
            const costCenter = item.user.organization?.department?.toUpperCase() || 'COMMON';
            // Pad ID to 8 digits for SAP
            const sapId = item.user.id.replace(/\D/g, '').padStart(8, '0'); 
            return `${sapId},3040,${item.amount.toFixed(2)},PLN,${costCenter}`;
        }).join("\n");
    };

    const generateGenericCSV = (data: any[]) => {
        return data.map(item => {
            return `"${item.user.name}";"${item.user.pesel}";"${item.user.department}";${item.amount.toFixed(2)}`;
        }).join("\n");
    };

    // --- MAIN EXPORT LOGIC ---
    const generateReport = (reportType: 'TAX' | 'COST_CENTER' | 'UTILIZATION') => {
        let content = '';
        let filename = '';
        let mimeType = 'text/csv;charset=utf-8;';

        // 1. Gather Data (Aggregate by User)
        const relevantVouchers = vouchers.filter(v => {
            if (v.companyId !== company.id) return false;
            if (v.status !== VoucherStatus.DISTRIBUTED && v.status !== VoucherStatus.CONSUMED) return false;
            return v.issueDate.startsWith(selectedMonth);
        });

        const aggregation = new Map<string, { amount: number; count: number; user: User }>();
        relevantVouchers.forEach(v => {
            if (!v.ownerId) return;
            const user = employees.find(u => u.id === v.ownerId);
            if (!user) return;

            const current = aggregation.get(v.ownerId) || { amount: 0, count: 0, user };
            aggregation.set(v.ownerId, { 
                amount: current.amount + v.value, 
                count: current.count + 1,
                user
            });
        });
        const aggregatedData = Array.from(aggregation.values());

        if (aggregatedData.length === 0 && reportType === 'TAX') {
            alert(`Brak danych (rozdanych voucherów) dla okresu ${selectedMonth}.`);
            return;
        }

        // 2. Format Data based on Selected System
        if (reportType === 'TAX') {
            switch (selectedSystem) {
                case 'ENOVA':
                    filename = `Import_Enova_${selectedMonth}.txt`;
                    content = generateEnovaTXT(aggregatedData);
                    mimeType = 'text/plain;charset=utf-8;';
                    break;
                case 'SYMFONIA':
                    filename = `Import_Symfonia_${selectedMonth}.csv`;
                    content = "ID;Nazwisko;Imie;Kwota;Skladnik\n" + generateSymfoniaCSV(aggregatedData);
                    break;
                case 'SAP':
                    filename = `Upload_SAP_HCM_${selectedMonth}.csv`;
                    content = "PersonnelNumber,WageType,Amount,Currency,CostCenter\n" + generateSapCSV(aggregatedData);
                    break;
                default: // GENERIC / OPTIMA
                    filename = `Raport_Płacowy_${selectedMonth}.csv`;
                    content = "Pracownik;PESEL;Dział;Kwota_Brutto\n" + generateGenericCSV(aggregatedData);
            }
        } 
        else if (reportType === 'COST_CENTER') {
            filename = `Raport_MPK_${selectedMonth}.csv`;
            content = "Dział (MPK);Liczba Pracowników;Suma Wydatków;Budżet Wykorzystany %\n";
            const depts = Array.from(new Set(activeEmployees.map(u => u.organization?.department || 'Ogólny')));
            content += depts.map(d => {
                const deptEmps = activeEmployees.filter(u => (u.organization?.department || 'Ogólny') === d);
                const count = deptEmps.length;
                const cost = count * 250; // Mock estimate
                return `${d};${count};${cost};85%`;
            }).join("\n");
        }
        else if (reportType === 'UTILIZATION') {
            filename = `Raport_Utylizacji_${selectedMonth}.csv`;
            content = "Pracownik;Saldo Obecne;Wydano Łącznie;Ostatnia Aktywność\n";
            content += activeEmployees.map(u => {
                const spent = vouchers.filter(v => v.ownerId === u.id && v.status === VoucherStatus.CONSUMED).length;
                return `${u.name};${u.voucherBalance};${spent};-`;
            }).join("\n");
        }

        // 3. Trigger Download
        const blob = new Blob(["\uFEFF" + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-visible">
            
            {/* 1. ANALYTICS DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT: COST ANALYSIS */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 relative overflow-visible group/chart">
                    <div className="absolute top-4 right-4 z-10">
                        <Info size={18} className="text-slate-300 hover:text-indigo-600 cursor-help transition-colors"/>
                        <div className="absolute right-0 top-6 w-56 bg-slate-800 text-white text-[10px] p-2.5 rounded-lg shadow-xl opacity-0 group-hover/chart:opacity-100 transition-opacity pointer-events-none z-50">
                            Wykres przedstawia sumę opłaconych zamówień w ostatnich 6 miesiącach (Trendy wydatkowe).
                        </div>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-indigo-600"/> Wykorzystanie Budżetu
                    </h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyCostData}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8"/>
                                <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" unit=" PLN"/>
                                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                                <Area type="monotone" dataKey="value" stroke="#4f46e5" fillOpacity={1} fill="url(#colorCost)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* RIGHT: DEPARTMENT ALLOCATION (PIE CHART) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full relative overflow-visible group/pie">
                    <div className="absolute top-4 right-4 z-10">
                        <Info size={18} className="text-slate-300 hover:text-emerald-600 cursor-help transition-colors"/>
                        <div className="absolute right-0 top-6 w-56 bg-slate-800 text-white text-[10px] p-2.5 rounded-lg shadow-xl opacity-0 group-hover/pie:opacity-100 transition-opacity pointer-events-none z-50">
                            Podział rozdysponowanych środków według działów (MPK) pracowników.
                        </div>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <PieIcon size={20} className="text-emerald-600"/> Koszty wg Działów
                    </h3>
                    {/* Fixed Height Container for Recharts */}
                    <div className="w-full h-[300px] relative">
                        {departmentStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={departmentStats}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {departmentStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value: number) => `${value.toLocaleString()} PLN`}
                                        contentStyle={{backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#1e293b'}}
                                        itemStyle={{color: '#1e293b', fontWeight: 'bold'}}
                                    />
                                    <Legend 
                                        layout="horizontal" 
                                        verticalAlign="bottom" 
                                        align="center"
                                        iconSize={10}
                                        formatter={(value) => <span className="text-xs text-slate-600 ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <AlertCircle size={32} className="opacity-20 mb-2"/>
                                <span className="text-xs">Brak rozdanych środków</span>
                            </div>
                        )}
                        
                        {/* Center Text Summary */}
                        {departmentStats.length > 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Razem</span>
                                <span className="text-xl font-bold text-slate-800">
                                    {departmentStats.reduce((a,b) => a + b.value, 0).toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. REPORT GENERATOR (ADVANCED) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                            <FileCog size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Eksport Danych Płacowych</h3>
                            <p className="text-xs text-slate-500">Generowanie plików wsadowych dla systemów płacowych (Payroll)</p>
                        </div>
                    </div>
                    
                    {/* Controls Row */}
                    <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
                        {/* Period Selector */}
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-xs font-bold text-slate-500 px-2 uppercase">Okres:</span>
                            <input 
                                type="month" 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
                            />
                        </div>

                        {/* System Selector */}
                        <div className="flex items-center gap-2 bg-indigo-50 p-1 rounded-lg border border-indigo-100 shadow-sm flex-1 lg:flex-none">
                            <div className="bg-white p-1 rounded">
                                <Database size={16} className="text-indigo-600"/>
                            </div>
                            <select 
                                value={selectedSystem}
                                onChange={(e) => setSelectedSystem(e.target.value as PayrollSystem)}
                                className="bg-transparent border-none text-sm font-bold text-indigo-900 focus:ring-0 cursor-pointer pr-8"
                            >
                                <option value="GENERIC">Standardowy (CSV)</option>
                                <option value="ENOVA">Enova365 (TXT)</option>
                                <option value="SYMFONIA">Symfonia (CSV/XML)</option>
                                <option value="SAP">SAP HCM (CSV)</option>
                                <option value="OPTIMA">Comarch Optima (XML)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Report 1: Tax (Now System Aware) */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-50">
                            <Badge variant="indigo">{selectedSystem}</Badge>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Wallet size={24}/>
                        </div>
                        <h4 className="font-bold text-slate-800 mb-1">Raport Podatkowy</h4>
                        <p className="text-xs text-slate-500 mb-4 flex-1 leading-relaxed">
                            Miesięczne zestawienie przychodów sformatowane specjalnie dla systemu <strong>{selectedSystem}</strong>.
                            Zawiera identyfikatory pracowników i kody składników.
                        </p>
                        <button 
                            onClick={() => generateReport('TAX')}
                            className="w-full py-2 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-lg text-xs hover:bg-indigo-50 flex items-center justify-center gap-2"
                        >
                            <Download size={14}/> Generuj Plik Wsadowy
                        </button>
                    </div>

                    {/* Report 2: Cost Center */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all group flex flex-col">
                        <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Users size={24}/>
                        </div>
                        <h4 className="font-bold text-slate-800 mb-1">Koszty wg MPK</h4>
                        <p className="text-xs text-slate-500 mb-4 flex-1 leading-relaxed">
                            Alokacja kosztów benefitów na działy (Miejsca Powstawania Kosztów). Używane przez Controlling.
                        </p>
                        <button 
                            onClick={() => generateReport('COST_CENTER')}
                            className="w-full py-2 bg-white border border-emerald-200 text-emerald-700 font-bold rounded-lg text-xs hover:bg-emerald-50 flex items-center justify-center gap-2"
                        >
                            <Download size={14}/> Pobierz XLSX
                        </button>
                    </div>

                    {/* Report 3: Utilization */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group flex flex-col">
                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <TrendingUp size={24}/>
                        </div>
                        <h4 className="font-bold text-slate-800 mb-1">Efektywność Benefitów</h4>
                        <p className="text-xs text-slate-500 mb-4 flex-1 leading-relaxed">
                            Analiza wykorzystania budżetu i popularności usług w czasie dla Zarządu.
                        </p>
                        <button 
                            onClick={() => generateReport('UTILIZATION')}
                            className="w-full py-2 bg-white border border-blue-200 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-50 flex items-center justify-center gap-2"
                        >
                            <Download size={14}/> Pobierz Raport
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
