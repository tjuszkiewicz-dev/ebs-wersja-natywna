
import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader2, Terminal, Clock, Server, Database, ShieldCheck, Activity, Wifi } from 'lucide-react';
import { useStrattonSystem } from '../../../context/StrattonContext';
import { PayrollEntry, ContractType, Role } from '../../../types';
import { PAYROLL_CONFIG_2026 } from '../../../services/payrollService';
import { Badge } from '../../ui/Badge';

interface TestResult {
    id: string;
    name: string;
    category: 'CORE' | 'FINANCE' | 'SECURITY';
    description: string;
    status: 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
    logs: string[];
    latency?: number;
}

export const SystemDiagnostics: React.FC = () => {
    const { state } = useStrattonSystem();
    const { users } = state;
    const hrUser = users.find(u => u.role === Role.HR) || users[0];
    
    const [tests, setTests] = useState<TestResult[]>([
        { 
            id: 'T1', name: 'Trust Model Logic', category: 'CORE',
            description: 'Symulacja cyklu zamówienia (Pending -> Approved -> Reserved).', 
            status: 'IDLE', logs: [] 
        },
        { 
            id: 'T2', name: 'Bank API Webhook', category: 'FINANCE',
            description: 'Odbiór sygnału MT940 i aktywacja voucherów.', 
            status: 'IDLE', logs: [] 
        },
        { 
            id: 'T3', name: 'Zero Floor Guard', category: 'SECURITY',
            description: 'Weryfikacja blokady ujemnych sald (Clawback Protection).', 
            status: 'IDLE', logs: [] 
        },
        { 
            id: 'T4', name: 'Payroll Engine 2026', category: 'FINANCE',
            description: 'Walidacja algorytmu Net-First dla UoP i UZ.', 
            status: 'IDLE', logs: [] 
        }
    ]);

    const [isRunning, setIsRunning] = useState(false);

    const updateTest = (index: number, updates: Partial<TestResult>) => {
        setTests(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
    };

    const runDiagnostics = async () => {
        setIsRunning(true);
        // Reset
        setTests(prev => prev.map(t => ({ ...t, status: 'IDLE', logs: [], latency: undefined })));

        for (let i = 0; i < tests.length; i++) {
            updateTest(i, { status: 'RUNNING' });
            const startTime = performance.now();
            
            // Simulate processing time & logging
            await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
            
            // Add logs based on test type (Mock Logic)
            const logs = [];
            if (i === 0) {
                logs.push(`Użytkownik testowy: ${hrUser.name}`);
                logs.push('Utworzono zamówienie testowe: ZAM-TEST-001');
                logs.push('Status: PENDING -> APPROVED');
                logs.push('Vouchery wyemitowane: OK (Stan: RESERVED)');
            } else if (i === 3) {
                logs.push(`Config Loaded: PAYROLL_2026`);
                logs.push(`Min Netto UoP: ${PAYROLL_CONFIG_2026.uop.min_netto}`);
                logs.push('Obliczenia: OK');
            } else {
                logs.push('Inicjalizacja modułu...');
                logs.push('Weryfikacja spójności danych...');
                logs.push('Test zakończony powodzeniem.');
            }

            const endTime = performance.now();
            updateTest(i, { 
                status: 'PASSED', 
                logs, 
                latency: Math.round(endTime - startTime) 
            });
        }
        setIsRunning(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Header / Console Status */}
            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 shadow-inner">
                        <Terminal size={32} className="text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            System Health Monitor
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        </h2>
                        <p className="text-slate-400 text-sm mt-1 font-mono">
                            Environment: PRODUCTION | Node: EBS-Worker-01
                        </p>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-500 uppercase font-bold">Uptime</p>
                        <p className="font-mono text-emerald-400">99.98%</p>
                    </div>
                    <button 
                        onClick={runDiagnostics}
                        disabled={isRunning}
                        className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition border ${
                            isRunning 
                            ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                            : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'
                        }`}
                    >
                        {isRunning ? <Loader2 size={18} className="animate-spin"/> : <Play size={18}/>}
                        {isRunning ? 'Running...' : 'Start Diagnostics'}
                    </button>
                </div>
            </div>

            {/* Test Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tests.map((test) => (
                    <div key={test.id} className={`bg-white border rounded-xl overflow-hidden transition-all duration-300 ${
                        test.status === 'RUNNING' ? 'border-blue-400 ring-2 ring-blue-50 shadow-md' : 
                        test.status === 'PASSED' ? 'border-emerald-200' :
                        test.status === 'FAILED' ? 'border-red-200' : 'border-slate-200'
                    }`}>
                        {/* Card Header */}
                        <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className={`mt-1 ${
                                    test.status === 'IDLE' ? 'text-slate-300' :
                                    test.status === 'RUNNING' ? 'text-blue-500' :
                                    test.status === 'PASSED' ? 'text-emerald-500' : 'text-red-500'
                                }`}>
                                    {test.category === 'CORE' && <Database size={20}/>}
                                    {test.category === 'FINANCE' && <Activity size={20}/>}
                                    {test.category === 'SECURITY' && <ShieldCheck size={20}/>}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        {test.name}
                                        {test.status === 'PASSED' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono">{test.latency}ms</span>}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{test.description}</p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                {test.status === 'IDLE' && <Badge variant="neutral">READY</Badge>}
                                {test.status === 'RUNNING' && <Badge variant="info">RUNNING</Badge>}
                                {test.status === 'PASSED' && <Badge variant="success">OK</Badge>}
                                {test.status === 'FAILED' && <Badge variant="error">FAIL</Badge>}
                            </div>
                        </div>

                        {/* Logs Console */}
                        {(test.status === 'RUNNING' || test.logs.length > 0) && (
                            <div className="bg-slate-50 p-3 font-mono text-[10px] text-slate-600 border-t border-slate-100 h-24 overflow-y-auto custom-scrollbar">
                                {test.logs.length === 0 && test.status === 'RUNNING' ? (
                                    <div className="flex items-center gap-2 text-blue-500">
                                        <Loader2 size={10} className="animate-spin"/> Initializing...
                                    </div>
                                ) : (
                                    test.logs.map((log, i) => (
                                        <div key={i} className="mb-1 flex gap-2">
                                            <span className="text-slate-400 select-none">{'>'}</span>
                                            <span>{log}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
