
import React, { useState } from 'react';
import { IntegrationConfig, WebhookLog } from '../../../types';
import { RefreshCw, Settings, Activity, Terminal, Link2, ShieldCheck, Database, CreditCard, FileText, Send, PieChart, Users, Power } from 'lucide-react';
import { IntegrationConfigModal } from './IntegrationConfigModal';

// STRATEGICZNY MOCKUP INTEGRACJI
// Odzwierciedla podział na Fundament, Workflow i Zarządzanie
const INITIAL_INTEGRATIONS: IntegrationConfig[] = [
    // --- I. FUNDAMENT (MUST-HAVE) ---
    { 
        id: 'INT-ENOVA', name: 'Enova365 (Kadry i Płace)', provider: 'ENOVA', type: 'HR_PAYROLL', category: 'FOUNDATION', status: 'CONNECTED', 
        description: 'Synchronizacja listy pracowników i wynagrodzeń.',
        businessGoal: 'Eliminacja ręcznego dodawania i usuwania pracowników (Onboarding/Offboarding).',
        lastSync: new Date().toISOString(), config: { endpointUrl: 'https://api.enova.firma.pl/v1', webhookEvents: ['EMPLOYEE_HIRED', 'PAYROLL_CLOSED'] } 
    },
    { 
        id: 'INT-ACC', name: 'Comarch ERP (Księgowość)', provider: 'COMARCH', type: 'ACCOUNTING', category: 'FOUNDATION', status: 'DISCONNECTED', 
        description: 'Eksport faktur i not księgowych.',
        businessGoal: 'Automatyczne księgowanie kosztów benefitów w systemie finansowym.',
        config: { webhookEvents: [] } 
    },

    // --- II. WORKFLOW & BEZPIECZEŃSTWO ---
    { 
        id: 'INT-AUTENTI', name: 'Autenti (e-Podpis)', provider: 'AUTENTI', type: 'SIGNATURE', category: 'WORKFLOW', status: 'ATTENTION', 
        description: 'Podpisywanie umów i regulaminów.',
        businessGoal: 'Pełna ścieżka prawna bez papieru (Umowy Odkupu, RODO).',
        config: { webhookEvents: [], apiKey: '***_EXPIRED' } // Simulated issue
    },
    { 
        id: 'INT-SSO', name: 'Azure Active Directory', provider: 'AZURE', type: 'IDENTITY', category: 'WORKFLOW', status: 'DISCONNECTED', 
        description: 'Centralne logowanie (SSO).',
        businessGoal: 'Bezpieczeństwo. Pracownik loguje się firmowym kontem Microsoft.',
        config: { webhookEvents: [] } 
    },

    // --- III. AUTOMATYZACJA & ZARZĄDZANIE ---
    { 
        id: 'INT-MAIL', name: 'Sendgrid (Powiadomienia)', provider: 'SENDGRID', type: 'COMMUNICATION', category: 'AUTOMATION', status: 'CONNECTED', 
        description: 'Wysyłka kodów i potwierdzeń.',
        businessGoal: 'Gwarancja dostarczalności e-maili do pracowników.',
        lastSync: new Date().toISOString(), config: { webhookEvents: [] } 
    },
    { 
        id: 'INT-BI', name: 'Power BI (Raportowanie)', provider: 'POWERBI', type: 'BI', category: 'MANAGEMENT', status: 'DISCONNECTED', 
        description: 'Zaawansowana analityka dla Zarządu.',
        businessGoal: 'Wizualizacja ROI, rotacji i kosztów w czasie rzeczywistym.',
        config: { webhookEvents: [] } 
    }
];

const MOCK_LOGS: WebhookLog[] = [
    { id: 'LOG-1', integrationId: 'INT-ENOVA', event: 'EMPLOYEE_HIRED', status: 'SUCCESS', timestamp: new Date().toISOString(), payloadSnippet: '{ "userId": "EMP-99", "action": "onboarding" }' },
    { id: 'LOG-3', integrationId: 'INT-AUTENTI', event: 'SIGN_ERROR', status: 'FAILED', timestamp: new Date(Date.now() - 86400000).toISOString(), payloadSnippet: '{ "error": "Token expired" }' }
];

export const HRIntegrationsManager: React.FC = () => {
    const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS);
    const [logs, setLogs] = useState(MOCK_LOGS);
    const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

    const toggleStatus = (id: string) => {
        setIntegrations(prev => prev.map(i => {
            if (i.id === id) {
                const newStatus = i.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
                // Mock validation alert
                if (newStatus === 'CONNECTED' && i.id === 'INT-ACC') {
                    alert("Wymagana konfiguracja klucza API dla Comarch ERP.");
                    return i;
                }
                return { 
                    ...i, 
                    status: newStatus,
                    lastSync: newStatus === 'CONNECTED' ? new Date().toISOString() : i.lastSync
                };
            }
            return i;
        }));
    };

    const handleSaveConfig = (id: string, newConfig: any) => {
        setIntegrations(prev => prev.map(i => 
            i.id === id ? { ...i, config: newConfig, status: 'CONNECTED' } : i
        ));
    };

    const selectedIntegration = integrations.find(i => i.id === selectedConfigId);

    // Grouping Helper
    const renderSection = (title: string, subtitle: string, category: string, icon: React.ReactNode) => {
        const sectionItems = integrations.filter(i => i.category === category);
        
        return (
            <div className="mb-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-200 pb-2">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        {icon}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-base">{title}</h3>
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sectionItems.map(int => (
                        <div key={int.id} className={`group bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col h-full ${
                            int.status === 'CONNECTED' ? 'border-emerald-200' : 
                            int.status === 'ATTENTION' ? 'border-amber-200' : 'border-slate-200 grayscale opacity-80 hover:opacity-100 hover:grayscale-0'
                        }`}>
                            {/* Status Indicator Stripe */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                int.status === 'CONNECTED' ? 'bg-emerald-500' : 
                                int.status === 'ATTENTION' ? 'bg-amber-500' : 'bg-slate-300'
                            }`}></div>

                            <div className="flex justify-between items-start mb-3 pl-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                                        int.provider === 'ENOVA' ? 'bg-orange-500' : 
                                        int.provider === 'SAP' ? 'bg-blue-700' : 
                                        int.provider === 'MILLENIUM' ? 'bg-pink-600' :
                                        int.provider === 'AUTENTI' ? 'bg-indigo-600' :
                                        'bg-slate-600'
                                    }`}>
                                        {int.provider[0]}
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm">{int.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${
                                        int.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 
                                        int.status === 'ATTENTION' ? 'bg-amber-500' : 'bg-slate-300'
                                    }`}></span>
                                </div>
                            </div>

                            <div className="pl-2 mb-4 flex-1">
                                <p className="text-xs text-slate-500 mb-2 italic min-h-[32px]">"{int.businessGoal}"</p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded w-fit">
                                    <Activity size={10}/>
                                    <span>Sync: {int.lastSync ? new Date(int.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Nigdy'}</span>
                                </div>
                            </div>

                            <div className="pl-2 pt-3 border-t border-slate-100 flex gap-2 mt-auto">
                                <button 
                                    onClick={() => setSelectedConfigId(int.id)}
                                    className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-indigo-600 transition flex items-center justify-center gap-1"
                                >
                                    <Settings size={12}/> Konfiguruj
                                </button>
                                <button 
                                    onClick={() => toggleStatus(int.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                                        int.status === 'CONNECTED' 
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                        : 'bg-slate-900 text-white hover:bg-slate-800'
                                    }`}
                                    title={int.status === 'CONNECTED' ? "Rozłącz integrację" : "Aktywuj połączenie"}
                                >
                                    <Power size={12}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Header / Global Status */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Link2 size={24} className="text-indigo-600"/> Centrum Integracji (API)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                        Zarządzaj przepływem danych między platformą benefitową a systemami Twojej firmy. 
                        Aktywne integracje oszczędzają Twój czas i eliminują błędy ręczne.
                    </p>
                </div>
                <div className="flex gap-4 text-xs font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-slate-700">2 Aktywne</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-slate-700">1 Uwaga</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        <span className="text-slate-400">3 Nieaktywne</span>
                    </div>
                </div>
            </div>

            {/* SECTIONS */}
            {renderSection('I. Fundament Systemu', 'Integracje krytyczne dla działania kadr i finansów.', 'FOUNDATION', <Database size={20}/>)}
            {renderSection('II. Workflow & Bezpieczeństwo', 'Automatyzacja obiegu dokumentów i logowania.', 'WORKFLOW', <ShieldCheck size={20}/>)}
            {renderSection('III. Automatyzacja & Zarządzanie', 'Powiadomienia i raporty zarządcze.', 'MANAGEMENT', <PieChart size={20}/>)}

            {/* EVENT LOGS (Mini) */}
            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 mt-8">
                <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <Terminal size={14} className="text-emerald-500"/> Ostatnie zdarzenia (API Logs)
                    </h3>
                    <button className="text-[10px] text-slate-500 hover:text-white transition flex items-center gap-1 bg-slate-800 px-2 py-1 rounded">
                        <RefreshCw size={10}/> Odśwież
                    </button>
                </div>
                <div className="p-0">
                    <table className="w-full text-left text-[10px] text-slate-400 font-mono">
                        <tbody className="divide-y divide-slate-800">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-800/30 transition">
                                    <td className="p-2 text-slate-500 w-32">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                    <td className="p-2 text-indigo-400 w-24">{log.integrationId}</td>
                                    <td className="p-2 font-bold text-slate-300 w-32">{log.event}</td>
                                    <td className="p-2 w-20">
                                        {log.status === 'SUCCESS' 
                                            ? <span className="text-emerald-500">200 OK</span>
                                            : <span className="text-red-500">500 ERR</span>
                                        }
                                    </td>
                                    <td className="p-2 text-slate-600 truncate max-w-xs opacity-70">
                                        {log.payloadSnippet}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Config Modal */}
            {selectedIntegration && (
                <IntegrationConfigModal 
                    isOpen={!!selectedIntegration}
                    onClose={() => setSelectedConfigId(null)}
                    integration={selectedIntegration}
                    onSave={handleSaveConfig}
                />
            )}
        </div>
    );
};
