
import React, { useState, useEffect, useMemo } from 'react';
import { Order, Voucher, BuybackAgreement, AuditLogEntry, Commission, NotificationConfig, ServiceItem, SystemConfig, EntityType, User, Company, Role } from '../types';
import { AlertTriangle, Clock, DollarSign, Shield, Settings, TrendingUp, Activity, Building2, Landmark, HelpCircle, Lock, LayoutGrid, Layers, FileText, ArrowRight, Wallet, X } from 'lucide-react';
import { AdminStats } from '../components/admin/AdminStats';
import { VoucherManager } from '../components/admin/VoucherManager';
import { OrdersTable } from '../components/admin/OrdersTable';
import { AdminBuybackManager } from '../components/admin/dashboard/AdminBuybackManager';
import { AdminFinancePanel } from '../components/admin/dashboard/AdminFinancePanel';
import { AdminQuarterlyReport } from '../components/admin/dashboard/AdminQuarterlyReport';
import { AdminConfigPanel } from '../components/admin/dashboard/AdminConfigPanel';
import { AdminAuditLog } from '../components/admin/dashboard/AdminAuditLog';
import { SystemDiagnostics } from '../components/admin/dashboard/SystemDiagnostics';
import { AdminCompaniesList } from '../components/admin/dashboard/AdminCompaniesList';
import { CompanyInspectionModal } from '../components/admin/modals/CompanyInspectionModal';
import { PaymentReconcile } from '../components/admin/finance/PaymentReconcile';
import { SupportTicketSystem } from '../components/support/SupportTicketSystem'; 
import { ComplianceHub } from '../components/admin/compliance/ComplianceHub'; 
import { ToastType } from '../components/Toast';
import { useStrattonSystem } from '../context/StrattonContext';
import { PageHeader } from '../components/layout/PageHeader'; 
import { Tabs } from '../components/ui/Tabs'; 
import { DashboardNewHR } from './DashboardNewHR';

interface Props {
  currentView: string; 
  orders: Order[];
  vouchers: Voucher[];
  users: User[]; 
  companies: Company[];
  buybacks: BuybackAgreement[];
  auditLogs: AuditLogEntry[];
  commissions: Commission[];
  notificationConfigs: NotificationConfig[];
  services: ServiceItem[];
  systemConfig: SystemConfig;
  onApproveOrder: (id: string) => void;
  onSimulateBankPayment: (id: string, success: boolean) => void;
  onApproveBuyback: (id: string) => void;
  onSimulateExpiration: () => void;
  onViewDocument: (type: 'DEBIT_NOTE' | 'VAT_INVOICE' | 'BUYBACK_AGREEMENT' | 'PROTOCOL', data: any) => void;
  onUpdateNotificationConfig: (config: NotificationConfig) => void;
  onUpdateSystemConfig: (config: SystemConfig) => void;
  onUpdateCompanyConfig: (companyId: string, updates: Partial<Company>) => void; 
  onManualEmission: (amount: number, description: string) => void;
  onToast?: (title: string, message: string, type: ToastType) => void;
}

type Tab = 'OVERVIEW' | 'COMPANIES' | 'ORDERS' | 'BANKING' | 'BUYBACKS' | 'FINANCE' | 'QUARTERLY' | 'CONFIG' | 'AUDIT' | 'DIAGNOSTICS' | 'SUPPORT' | 'COMPLIANCE';
type Category = 'OPERATIONS' | 'FINANCE_CRM' | 'SYSTEM';

// --- CRITICAL ALERT BANNER ---
const CriticalAlertBanner = ({ alerts, onClose }: { alerts: string[], onClose: () => void }) => {
    if (alerts.length === 0) return null;
    return (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between shadow-sm animate-in slide-in-from-top-2">
            <div className="flex gap-3">
                <div className="p-2 bg-red-100 rounded-lg text-red-600 shrink-0">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-red-900 text-sm">Wymagana Natychmiastowa Uwaga</h4>
                    <ul className="mt-1 space-y-1">
                        {alerts.map((alert, idx) => (
                            <li key={idx} className="text-xs text-red-700 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> {alert}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <button onClick={onClose} className="text-red-400 hover:text-red-700 p-1"><X size={18}/></button>
        </div>
    );
};

export const DashboardSuperadmin: React.FC<Props> = ({ 
  currentView,
  orders, 
  vouchers, 
  users, 
  companies, 
  buybacks, 
  auditLogs,
  commissions,
  notificationConfigs,
  services,
  systemConfig,
  onApproveOrder, 
  onSimulateBankPayment,
  onApproveBuyback,
  onSimulateExpiration,
  onViewDocument,
  onUpdateNotificationConfig,
  onUpdateSystemConfig,
  onUpdateCompanyConfig,
  onManualEmission,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [activeCategory, setActiveCategory] = useState<Category>('OPERATIONS');
  const { state, actions } = useStrattonSystem();
  const [showAlerts, setShowAlerts] = useState(true);
  
  const [inspectingCompany, setInspectingCompany] = useState<Company | null>(null);
  const [hrPanelCompanyId, setHrPanelCompanyId] = useState<string | null>(null);
  
  // --- COUNTERS ---
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const pendingBuybacks = buybacks.filter(b => b.status === 'PENDING_APPROVAL');
  const openTickets = state.tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');

  // --- SYSTEM ALERTS LOGIC ---
  const systemAlerts = useMemo(() => {
      const alerts = [];
      if (pendingBuybacks.length > 10) alerts.push(`Krytyczna kolejka odkupów: ${pendingBuybacks.length} wniosków oczekuje na decyzję.`);
      if (pendingOrders.some(o => (Date.now() - new Date(o.date).getTime()) > 86400000 * 3)) alerts.push("Zamówienia starsze niż 3 dni wciąż oczekują na akceptację.");
      const lowBalanceCompanies = companies.filter(c => c.balanceActive < 0);
      if (lowBalanceCompanies.length > 0) alerts.push(`Wykryto ${lowBalanceCompanies.length} firm z ujemnym saldem (Integrity Check Failed).`);
      return alerts;
  }, [pendingBuybacks, pendingOrders, companies]);

  // --- SYNC ROUTER & AUTO-CATEGORIZATION ---
  useEffect(() => {
      let targetTab: Tab = 'OVERVIEW';
      switch(currentView) {
          case 'admin-orders': targetTab = 'ORDERS'; break;
          case 'admin-buybacks': targetTab = 'BUYBACKS'; break;
          case 'admin-dashboard': targetTab = 'OVERVIEW'; break;
          default: targetTab = 'OVERVIEW'; break; 
      }
      setActiveTab(targetTab);
      
      if (['OVERVIEW', 'ORDERS', 'BANKING', 'BUYBACKS', 'SUPPORT'].includes(targetTab)) setActiveCategory('OPERATIONS');
      else if (['COMPANIES', 'FINANCE', 'QUARTERLY'].includes(targetTab)) setActiveCategory('FINANCE_CRM');
      else setActiveCategory('SYSTEM');

  }, [currentView]);

  const handleAuditJump = (entry: AuditLogEntry) => {
      if (!entry.targetEntityId || !entry.targetEntityType) return;

      const entityId = entry.targetEntityId;
      const type = entry.targetEntityType;

      let exists = false;
      let targetTab: Tab = 'OVERVIEW';

      switch (type) {
          case 'ORDER':
              exists = orders.some(o => o.id === entityId);
              targetTab = 'ORDERS';
              break;
          case 'BUYBACK':
              exists = buybacks.some(b => b.id === entityId);
              targetTab = 'BUYBACKS';
              break;
          case 'COMPANY':
              exists = companies.some(c => c.id === entityId);
              targetTab = 'COMPANIES';
              if (exists) {
                  const company = companies.find(c => c.id === entityId);
                  if (company) setInspectingCompany(company);
              }
              break;
          case 'TICKET':
              targetTab = 'SUPPORT';
              exists = true;
              break;
          case 'USER':
              targetTab = 'COMPLIANCE';
              exists = true;
              break;
          default:
              exists = true; 
              break;
      }

      if (exists) {
          setActiveTab(targetTab);
          if (['OVERVIEW', 'ORDERS', 'BANKING', 'BUYBACKS', 'SUPPORT'].includes(targetTab)) setActiveCategory('OPERATIONS');
          else if (['COMPANIES', 'FINANCE', 'QUARTERLY'].includes(targetTab)) setActiveCategory('FINANCE_CRM');
          else setActiveCategory('SYSTEM');

          if (onToast && !inspectingCompany) onToast("Przekierowano", `Przełączono widok do obiektu: ${entityId}`, "SUCCESS");
      } else {
          if (onToast) onToast("Błąd 404", "Ten obiekt został usunięty lub nie istnieje w systemie.", "ERROR");
      }
  };

  const handleBulkPayments = (matchedIds: string[]) => {
      matchedIds.forEach(id => {
          onSimulateBankPayment(id, true);
      });
      if(onToast) onToast("Masowa Wpłata", `Zaksięgowano pomyślnie ${matchedIds.length} zamówień.`, "SUCCESS");
  };

  const tabsMap: Record<Category, { id: Tab, label: string, icon?: React.ReactNode, count?: number, badgeColor?: string }[]> = {
      OPERATIONS: [
          { id: 'OVERVIEW', label: 'Pulpit', icon: <LayoutGrid size={14} /> },
          { id: 'ORDERS', label: 'Zamówienia', count: pendingOrders.length, icon: <AlertTriangle size={14} />, badgeColor: "bg-amber-500" },
          { id: 'BANKING', label: 'Bank & Windykacja', icon: <Landmark size={14} /> },
          { id: 'BUYBACKS', label: 'Odkupy', count: pendingBuybacks.length, icon: <Clock size={14} />, badgeColor: "bg-blue-500" },
          { id: 'SUPPORT', label: 'Helpdesk', count: openTickets.length, icon: <HelpCircle size={14} />, badgeColor: "bg-red-500" },
      ],
      FINANCE_CRM: [
          { id: 'COMPANIES', label: 'Firmy (CRM)', icon: <Building2 size={14} /> },
          { id: 'FINANCE', label: 'Prowizje', icon: <DollarSign size={14} /> },
          { id: 'QUARTERLY', label: 'Raporty Kwartalne', icon: <TrendingUp size={14} /> },
      ],
      SYSTEM: [
          { id: 'CONFIG', label: 'Konfiguracja', icon: <Settings size={14} /> },
          { id: 'COMPLIANCE', label: 'RODO & Zgody', icon: <Lock size={14} /> },
          { id: 'AUDIT', label: 'Logi Systemowe', icon: <Shield size={14} /> },
          { id: 'DIAGNOSTICS', label: 'Diagnostyka E2E', icon: <Activity size={14} /> },
      ]
  };

  const renderDashboard = () => (
    <div className="space-y-2 animate-in fade-in duration-500">
      
      {/* 1. KEY METRICS & FLOW CHART */}
      <AdminStats 
        vouchers={vouchers}
        orders={orders}
        commissions={commissions}
        auditLogs={auditLogs}
        onLogClick={handleAuditJump}
      />

      {/* 2. VOUCHER MANAGEMENT */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Layers size={20} className="text-indigo-600"/> Zarządzanie Pulą Voucherów
          </h3>
          <VoucherManager vouchers={vouchers} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      
      <PageHeader 
        title="Centrum Dowodzenia" 
        description="Zarządzanie operacjami globalnymi i audyt."
      >
        {/* LEVEL 1: CATEGORIES */}
        <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
            <button 
                onClick={() => setActiveCategory('OPERATIONS')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeCategory === 'OPERATIONS' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Activity size={16}/> Operacyjne
            </button>
            <button 
                onClick={() => setActiveCategory('FINANCE_CRM')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeCategory === 'FINANCE_CRM' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <DollarSign size={16}/> Finanse & CRM
            </button>
            <button 
                onClick={() => setActiveCategory('SYSTEM')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeCategory === 'SYSTEM' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Settings size={16}/> System
            </button>
        </div>

        {/* LEVEL 2: TABS FOR ACTIVE CATEGORY */}
        <div className="border-b border-slate-200">
            <Tabs 
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id as Tab)}
                variant="underline"
                items={tabsMap[activeCategory].map(t => ({
                    id: t.id,
                    label: t.label,
                    icon: t.icon,
                    count: t.count
                }))}
            />
        </div>
      </PageHeader>

      {/* CONTENT AREA */}
      <div className="min-h-[500px]">
          {showAlerts && <CriticalAlertBanner alerts={systemAlerts} onClose={() => setShowAlerts(false)} />}

          {activeTab === 'OVERVIEW' && renderDashboard()}
          
          {activeTab === 'SUPPORT' && state.currentUser && (
              <SupportTicketSystem 
                  currentUser={state.currentUser}
                  tickets={state.tickets}
                  onCreateTicket={actions.handleCreateTicket}
                  onReply={actions.handleReplyTicket}
                  onUpdateStatus={actions.handleUpdateTicketStatus}
              />
          )}

          {activeTab === 'COMPLIANCE' && (
              <ComplianceHub 
                  users={users}
                  logs={auditLogs}
                  onAnonymizeUser={actions.handleAnonymizeUser}
              />
          )}

          {activeTab === 'COMPANIES' && (
              <AdminCompaniesList 
                  companies={companies}
                  users={users}
                  orders={orders}
                  onInspectCompany={setInspectingCompany}
                  onSyncCrm={actions.handleCrmSync}
                  onViewHrPanel={setHrPanelCompanyId}
              />
          )}

          {activeTab === 'ORDERS' && (
              <OrdersTable 
                orders={orders}
                onApproveOrder={onApproveOrder}
                onSimulateBankPayment={onSimulateBankPayment}
                onViewDocument={onViewDocument}
              />
          )}

          {activeTab === 'BANKING' && (
              <PaymentReconcile 
                  orders={orders}
                  onProcessPayments={handleBulkPayments}
              />
          )}
          
          {activeTab === 'BUYBACKS' && (
            <AdminBuybackManager 
                buybacks={buybacks}
                users={users} 
                companies={companies} 
                onSimulateExpiration={onSimulateExpiration}
                onApproveBuyback={onApproveBuyback}
                onMarkPaid={actions.handleProcessBuybackPayment} 
                onViewDocument={onViewDocument}
            />
          )}
          
          {activeTab === 'FINANCE' && (
            <AdminFinancePanel commissions={commissions} />
          )}
          
          {activeTab === 'QUARTERLY' && (
            <AdminQuarterlyReport commissions={commissions} />
          )}
          
          {activeTab === 'CONFIG' && (
            <AdminConfigPanel 
                systemConfig={systemConfig}
                notificationConfigs={notificationConfigs}
                services={services}
                companies={companies} 
                users={users} 
                onUpdateNotificationConfig={onUpdateNotificationConfig}
                onUpdateSystemConfig={onUpdateSystemConfig}
                onUpdateCompanyConfig={onUpdateCompanyConfig} 
                onAddCompany={actions.handleAddCompany}
                onManualEmission={onManualEmission}
            />
          )}
          
          {activeTab === 'AUDIT' && (
            <AdminAuditLog 
                auditLogs={auditLogs} 
                onLogClick={handleAuditJump}
            />
          )}

          {activeTab === 'DIAGNOSTICS' && (
            <SystemDiagnostics />
          )}
      </div>

      {/* --- MODALS --- */}
      {inspectingCompany && (
          <CompanyInspectionModal 
              isOpen={!!inspectingCompany}
              onClose={() => setInspectingCompany(null)}
              company={inspectingCompany}
              employees={users.filter(u => u.companyId === inspectingCompany.id)}
              allUsers={users}
              orders={orders.filter(o => o.companyId === inspectingCompany.id)}
              logs={auditLogs.filter(l => l.targetEntityId === inspectingCompany.id || l.details.includes(inspectingCompany.name))}
              vouchers={vouchers.filter(v => v.companyId === inspectingCompany.id)}
              distributionBatches={state.distributionBatches.filter(b => b.companyId === inspectingCompany.id)} 
              onUpdateCompany={(id, data) => {
                  onUpdateCompanyConfig(id, data);
                  setInspectingCompany(prev => prev ? ({...prev, ...data}) : null);
              }}
              onViewDocument={onViewDocument}
          />
      )}

      {/* HR Panel Overlay */}
      {hrPanelCompanyId && (() => {
        const hrComp = companies.find(c => c.id === hrPanelCompanyId);
        if (!hrComp || !state.currentUser) return null;
        const hrVouchers = vouchers.filter(v => v.companyId === hrPanelCompanyId);
        const hrOrders = orders.filter(o => o.companyId === hrPanelCompanyId);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" style={{ backdropFilter: 'blur(2px)' }}>
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Building2 size={16} className="text-blue-600"/>
                <span className="font-semibold text-sm text-gray-800">Panel HR: {hrComp.name}</span>
                <span className="text-xs text-gray-400 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">Widok Administratora</span>
              </div>
              <button onClick={() => setHrPanelCompanyId(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded hover:bg-gray-100 transition">
                <X size={15}/> Zamknij panel HR
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DashboardNewHR
                company={hrComp}
                employees={users.filter(u => u.companyId === hrPanelCompanyId && u.role === Role.EMPLOYEE)}
                vouchers={hrVouchers}
                orders={hrOrders}
                currentUser={state.currentUser}
                onLogout={() => setHrPanelCompanyId(null)}
                isAdminView={true}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};
