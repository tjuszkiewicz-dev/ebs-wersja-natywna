
import React, { useState } from 'react';
import { Globe, ShoppingCart, Bell, LayoutTemplate, Shield, Save, Plus, Edit2, RefreshCw, Database, Link, Building2, User, RotateCcw, AlertTriangle } from 'lucide-react';
import { SystemConfig, NotificationConfig, ServiceItem, Company, User as UserType } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { Badge } from '../../ui/Badge';
import { NotificationPreferences } from '../../notifications/NotificationPreferences';
import { ServiceManager } from '../config/ServiceManager';
import { DocumentEditor } from '../config/DocumentEditor';
import { useStrattonSystem } from '../../../context/StrattonContext';
import { CompanyEditModal } from '../modals/CompanyEditModal';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

interface AdminConfigPanelProps {
  systemConfig: SystemConfig;
  notificationConfigs: NotificationConfig[];
  services: ServiceItem[];
  companies?: Company[]; 
  users: UserType[]; 
  onUpdateNotificationConfig: (config: NotificationConfig) => void;
  onUpdateSystemConfig: (config: SystemConfig) => void;
  onUpdateCompanyConfig?: (companyId: string, updates: Partial<Company>) => void; 
  onAddCompany?: (newCompany: Partial<Company>) => void; 
  onManualEmission: (amount: number, description: string) => void;
}

type ConfigSubTab = 'GLOBAL' | 'COMPANIES' | 'CATALOG' | 'COMMUNICATIONS' | 'DOCUMENTS' | 'SECURITY';

export const AdminConfigPanel: React.FC<AdminConfigPanelProps> = ({
  systemConfig,
  notificationConfigs,
  services,
  companies = [],
  users,
  onUpdateNotificationConfig,
  onUpdateSystemConfig,
  onUpdateCompanyConfig,
  onAddCompany,
  onManualEmission
}) => {
  const { actions } = useStrattonSystem(); 
  const [configSubTab, setConfigSubTab] = useState<ConfigSubTab>('GLOBAL');
  
  // -- GLOBAL STATES --
  const [validityDays, setValidityDays] = useState(systemConfig?.defaultVoucherValidityDays || 7);
  const [paymentTerms, setPaymentTerms] = useState(systemConfig?.paymentTermsDays || 7);
  const [currency, setCurrency] = useState(systemConfig?.platformCurrency || 'PLN');
  const [minPassLength, setMinPassLength] = useState(systemConfig?.minPasswordLength || 8);
  const [sessionTimeout, setSessionTimeout] = useState(systemConfig?.sessionTimeoutMinutes || 30);
  const [pdfScaling, setPdfScaling] = useState(systemConfig?.pdfAutoScaling ?? true);
  
  // Manual Emission
  const [emissionAmount, setEmissionAmount] = useState(100);
  const [emissionReason, setEmissionReason] = useState('Pula Techniczna / Bonusowa');

  // Company Modal State
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);

  // CRM Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  // -- HANDLERS --
  
  const handleSaveSystemConfig = () => {
    onUpdateSystemConfig({ 
        ...systemConfig, 
        defaultVoucherValidityDays: validityDays,
        paymentTermsDays: paymentTerms,
        platformCurrency: currency,
        minPasswordLength: minPassLength,
        sessionTimeoutMinutes: sessionTimeout,
        pdfAutoScaling: pdfScaling
    });
  };

  const handleManualEmissionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onManualEmission(emissionAmount, emissionReason);
    setEmissionAmount(100);
  };

  const handleHardReset = () => {
      if (confirm("UWAGA: Ta operacja usunie WSZYSTKIE dane lokalne (użytkownicy, zamówienia, historia) i przywróci stan fabryczny aplikacji. Czy kontynuować?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const openAddCompany = () => {
      setEditingCompany(undefined);
      setIsCompanyModalOpen(true);
  };

  const openEditCompany = (c: Company) => {
      setEditingCompany(c);
      setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = (data: Partial<Company>) => {
      if (editingCompany && onUpdateCompanyConfig) {
          // Update
          onUpdateCompanyConfig(editingCompany.id, data);
      } else if (onAddCompany) {
          // Create
          onAddCompany(data);
      }
  };

  const handleTriggerCrmSync = async () => {
      setIsSyncing(true);
      await actions.handleCrmSync();
      setIsSyncing(false);
  };

  const companyColumns: Column<Company>[] = [
      { 
          header: 'Firma', 
          accessorKey: 'name',
          sortable: true, 
          cell: (c) => (
              <div>
                  <span className="font-bold text-slate-800 block flex items-center gap-2">
                      {c.name}
                      {c.origin === 'CRM_SYNC' && <Badge variant="indigo" className="text-[9px]">CRM Sync</Badge>}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">NIP: {c.nip}</span>
              </div>
          ) 
      },
      { 
          header: 'Opiekun (Doradca)', 
          accessorKey: 'advisorId', 
          cell: (c) => {
              const advisor = users.find(u => u.id === c.advisorId);
              return advisor ? (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold flex items-center gap-1 w-fit">
                      <User size={10}/> {advisor.name}
                  </span>
              ) : <span className="text-xs text-slate-400">-</span>;
          }
      },
      { 
          header: 'Saldo', 
          accessorKey: 'balanceActive',
          className: 'text-right', 
          cell: (c) => <span className="font-mono font-bold text-emerald-600">{c.balanceActive} pkt</span> 
      },
      { 
          header: 'Akcja', 
          className: 'text-right',
          cell: (c) => (
              <button 
                  onClick={() => openEditCompany(c)} 
                  className="p-2 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition"
              >
                  <Edit2 size={16}/>
              </button>
          ) 
      }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[700px] flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-4 flex-shrink-0">
          <h3 className="label-text mb-4 px-2">Ustawienia Platformy</h3>
          <div className="space-y-1">
              {[
                  { id: 'GLOBAL', label: 'Globalne', icon: <Globe size={18}/> },
                  { id: 'COMPANIES', label: 'Baza Firm', icon: <Building2 size={18}/> },
                  { id: 'CATALOG', label: 'Usługi (CMS)', icon: <ShoppingCart size={18}/> },
                  { id: 'COMMUNICATIONS', label: 'Komunikacja', icon: <Bell size={18}/> },
                  { id: 'DOCUMENTS', label: 'Dokumenty', icon: <LayoutTemplate size={18}/> },
                  { id: 'SECURITY', label: 'Bezpieczeństwo', icon: <Shield size={18}/> },
              ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setConfigSubTab(item.id as ConfigSubTab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        configSubTab === item.id 
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                      {item.icon} {item.label}
                  </button>
              ))}
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-200 px-2 space-y-3">
             <Button onClick={handleSaveSystemConfig} className="w-full" icon={<Save size={16}/>}>
                Zapisz Zmiany
             </Button>
             
             {/* HARD RESET BUTTON */}
             <Button onClick={handleHardReset} variant="danger" className="w-full" size="sm" icon={<RotateCcw size={14}/>}>
                Reset Systemu
             </Button>
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto relative bg-slate-50/30">
          {configSubTab === 'GLOBAL' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                  
                  {/* Central CRM Integration Status - Static Visual */}
                  <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                      <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10">
                          <Database size={150} />
                      </div>
                      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                              <h2 className="text-xl font-bold flex items-center gap-2">
                                  <Link size={24} className="text-emerald-400"/> Central CRM Integration
                              </h2>
                              <p className="text-slate-400 text-sm mt-1 max-w-lg">
                                  System jest połączony z główną bazą danych (HubSpot/Salesforce Mock).
                                  Firmy są tworzone w EBS po zmianie statusu umowy na "SIGNED".
                              </p>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                              API Connected
                          </div>
                      </div>
                  </div>

                  <div>
                      <h2 className="text-lg font-bold text-slate-800">Parametry Globalne</h2>
                      <p className="text-sm text-slate-500">Domyślne ustawienia dla wszystkich firm.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="bg-white/50">
                          <Input 
                            label="Ważność Vouchera (dni)" 
                            type="number" 
                            value={validityDays} 
                            onChange={e => setValidityDays(Number(e.target.value))} 
                          />
                      </Card>
                      <Card className="bg-white/50">
                          <Input 
                            label="Termin Płatności (dni)" 
                            type="number" 
                            value={paymentTerms} 
                            onChange={e => setPaymentTerms(Number(e.target.value))} 
                          />
                      </Card>
                  </div>

                  {/* Manual Emission */}
                  <div className="border-t border-slate-200 pt-6">
                      <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden" noPadding>
                          <div className="p-6">
                            <h3 className="font-bold text-lg mb-1 flex items-center gap-2 relative z-10 text-slate-800">
                                <Plus size={20} className="text-indigo-600"/> Emisja Manualna
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">Awaryjne generowanie puli technicznej.</p>
                            <form onSubmit={handleManualEmissionSubmit} className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 items-end mt-4">
                                <div className="md:col-span-2">
                                    <Input 
                                        required 
                                        value={emissionReason} 
                                        onChange={e => setEmissionReason(e.target.value)} 
                                        placeholder="Powód"
                                        className="bg-slate-50"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        required 
                                        value={emissionAmount} 
                                        onChange={e => setEmissionAmount(Number(e.target.value))} 
                                        className="bg-slate-50"
                                    />
                                    <Button type="submit" variant="primary" icon={<Plus size={20}/>}>Emituj</Button>
                                </div>
                            </form>
                          </div>
                      </Card>
                  </div>
              </div>
          )}

          {configSubTab === 'COMPANIES' && (
              <div className="space-y-6 animate-in fade-in">
                  
                  {/* SYNC CARD */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                      <div className="flex items-start gap-4">
                          <div className="bg-white p-3 rounded-lg text-indigo-600 shadow-sm">
                              <RefreshCw size={24} className={isSyncing ? "animate-spin" : ""}/>
                          </div>
                          <div>
                              <h3 className="font-bold text-indigo-900 text-base">Synchronizacja CRM</h3>
                              <p className="text-indigo-700 text-xs mt-1 max-w-md">
                                  Pobierz nowe firmy ze statusem <strong>SIGNED</strong> z zewnętrznego systemu. 
                                  Operacja utworzy konta firmowe i przypisze opiekunów (jeśli email pasuje).
                              </p>
                          </div>
                      </div>
                      <Button 
                          onClick={handleTriggerCrmSync}
                          isLoading={isSyncing}
                          variant="primary"
                          className="bg-indigo-600 hover:bg-indigo-700 shadow-none border-transparent"
                      >
                          {isSyncing ? 'Pobieranie...' : 'Synchronizuj Teraz'}
                      </Button>
                  </div>

                  <DataTable 
                      data={companies} 
                      columns={companyColumns} 
                      mobileRenderer={(c) => <div>{c.name}</div>} 
                      headerActions={
                          <Button 
                              onClick={openAddCompany} 
                              size="sm"
                              variant="primary"
                              icon={<Plus size={16}/>}
                          >
                              Ręczne Dodanie
                          </Button>
                      }
                      title="Zarządzanie Firmami"
                      subtitle="Lista podmiotów współpracujących"
                      searchPlaceholder="Szukaj firmy (Nazwa, NIP)..."
                      searchableFields={['name', 'nip']}
                  />
              </div>
          )}
          
          {configSubTab === 'CATALOG' && (
              <ServiceManager services={services} onManage={actions.handleManageService} />
          )}
          
          {configSubTab === 'COMMUNICATIONS' && <NotificationPreferences />}
          
          {configSubTab === 'DOCUMENTS' && (
              <DocumentEditor systemConfig={systemConfig} onUpdateConfig={onUpdateSystemConfig} />
          )}
          
          {configSubTab === 'SECURITY' && (
              <div className="space-y-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Shield size={18}/> Polityka Bezpieczeństwa</h4>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-sm text-slate-600">Timeout Sesji (min)</span>
                          <input type="number" value={sessionTimeout} onChange={e => setSessionTimeout(Number(e.target.value))} className="input-field w-16 !p-1 !text-center !text-xs"/>
                      </div>
                  </div>
                  
                  {/* DANGER ZONE */}
                  <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                      <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle size={18}/> Strefa Niebezpieczna</h4>
                      <p className="text-xs text-red-700 mb-4">Reset fabryczny usunie wszystkie dane z LocalStorage.</p>
                      <Button onClick={handleHardReset} variant="danger" size="sm" icon={<RotateCcw size={14}/>}>
                          Przywróć Ustawienia Fabryczne
                      </Button>
                  </div>
              </div>
          )}
      </div>

      {/* NEW COMPANY EDIT MODAL */}
      <CompanyEditModal 
          isOpen={isCompanyModalOpen}
          onClose={() => setIsCompanyModalOpen(false)}
          company={editingCompany}
          users={users} // Pass users for selection
          onSave={handleSaveCompany}
      />
    </div>
  );
};
