
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardSuperadmin } from './views/DashboardSuperadmin';
import { DashboardHR } from './views/DashboardHR';
import { DashboardEmployee } from './views/DashboardEmployee';
import { DashboardSales } from './views/DashboardSales';
import { LoginScreen } from './views/LoginScreen';
import { Role, Order, BuybackAgreement, Notification, User, Company, DistributionBatch, VoucherStatus } from './types'; 
import { Menu, Check, X, DollarSign, LogOut, Search, ShieldCheck, Settings, Wallet, Clock } from 'lucide-react';
import { DocumentModal } from './components/DocumentModal';
import { ToastContainer } from './components/Toast';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { NotificationHistoryModal } from './components/notifications/NotificationHistoryModal';
import { StrattonProvider, useStrattonSystem } from './context/StrattonContext';
import { UserInspectionModal } from './components/admin/modals/UserInspectionModal';
import { GlobalSearch } from './components/GlobalSearch'; 
import { SessionGuard } from './components/security/SessionGuard'; 
import { EmployeeSettingsModal } from './components/employee/EmployeeSettingsModal';
import { HrViewGuard } from './components/layout/HrViewGuard';
import { canAccessView } from './utils/permissions';

// Inner App Content (that consumes Context)
const AppContent = () => {
  const { state, actions } = useStrattonSystem(); // No arguments needed now
  
  const { 
    users, currentUser, vouchers, companies, orders, buybacks, auditLogs, 
    commissions, notifications, notificationConfigs, services, transactions, systemConfig, importHistory, toasts
  } = state;

  // --- EMPLOYEE HEADER STATS CALCULATION ---
  const expiringCount = React.useMemo(() => {
    if (currentUser?.role !== Role.EMPLOYEE) return 0;
    
    // Filter vouchers for this user
    const myVouchers = vouchers.filter(v => 
        v.ownerId === currentUser.id && 
        (v.status === VoucherStatus.DISTRIBUTED || v.status === VoucherStatus.RESERVED)
    );

    // Calculate count
    return myVouchers.filter(v => {
        if (!v.expiryDate) return false;
        const daysLeft = (new Date(v.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24);
        return daysLeft < 3 && daysLeft > 0;
    }).length;
  }, [vouchers, currentUser]);

  // --- ROUTING STATE ---
  // Lazy initialization to prevent flashing default admin view if user is already logged in (e.g. from LocalStorage)
  const [currentView, setCurrentView] = useState<string>(() => {
      if (!currentUser) return 'admin-dashboard';
      switch (currentUser.role) {
          case Role.SUPERADMIN: return 'admin-dashboard';
          case Role.HR: return 'hr-dashboard';
          case Role.EMPLOYEE: return 'emp-dashboard';
          case Role.ADVISOR:
          case Role.MANAGER:
          case Role.DIRECTOR: return 'sales-dashboard';
          default: return 'admin-dashboard';
      }
  });
  
  // --- UI STATE ---
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, useStateIsDesktopSidebarOpen] = useState(true);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docType, setDocType] = useState<'DEBIT_NOTE' | 'VAT_INVOICE' | 'BUYBACK_AGREEMENT' | 'IMPORT_REPORT' | 'PROTOCOL'>('DEBIT_NOTE'); 
  const [docData, setDocData] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Deep Link State
  const [inspectionUser, setInspectionUser] = useState<User | null>(null);

  // --- GLOBAL KEYBOARD LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Search with Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- EFFECT: VIEW ROUTER SYNC ---
  // Ensures view updates if user role changes dynamically (e.g. relogin as different user)
  useEffect(() => {
      if (currentUser) {
          // Only force switch if current view is not compatible with role to allow sub-navigation
          if (!canAccessView(currentUser.role, currentView)) {
              switch (currentUser.role) {
                  case Role.SUPERADMIN: setCurrentView('admin-dashboard'); break;
                  case Role.HR: setCurrentView('hr-dashboard'); break;
                  case Role.EMPLOYEE: setCurrentView('emp-dashboard'); break;
                  case Role.ADVISOR:
                  case Role.MANAGER:
                  case Role.DIRECTOR: setCurrentView('sales-dashboard'); break;
              }
          }
      }
  }, [currentUser?.id, currentUser?.role]); 

  // --- HANDLERS ---

  const handleOpenDocument = (type: 'DEBIT_NOTE' | 'VAT_INVOICE' | 'BUYBACK_AGREEMENT' | 'IMPORT_REPORT' | 'PROTOCOL', data: any, user?: User, company?: Company) => {
    setDocType(type);
    setDocData(data);
    setDocModalOpen(true);
  };
  
  const handleToggleSidebar = () => {
    if (window.innerWidth >= 768) {
      useStateIsDesktopSidebarOpen(!isDesktopSidebarOpen);
    } else {
      setIsMobileSidebarOpen(true);
    }
  };

  const handleNotificationClick = (n: Notification) => {
      // Close history modal if open
      if (isHistoryModalOpen) setIsHistoryModalOpen(false);

      if (!n.read) {
          actions.handleMarkSingleNotificationRead(n.id);
      }
      if (n.action?.type === 'REVIEW_IBAN') {
          const targetUser = users.find(u => u.id === n.action!.targetId);
          if (targetUser && currentUser?.role === Role.SUPERADMIN) {
              setInspectionUser(targetUser);
              return;
          }
      }
      if (!n.targetEntityId || !n.targetEntityType) return;
      const type = n.targetEntityType;
      const role = currentUser?.role;

      switch (type) {
          case 'ORDER':
              if (role === Role.SUPERADMIN) setCurrentView('admin-orders');
              else if (role === Role.HR) setCurrentView('hr-orders');
              break;
          case 'BUYBACK':
              if (role === Role.SUPERADMIN) setCurrentView('admin-buybacks');
              else if (role === Role.EMPLOYEE) setCurrentView('emp-history');
              break;
          case 'TICKET':
              if (role === Role.SUPERADMIN) setCurrentView('admin-dashboard'); 
              else if (role === Role.EMPLOYEE) setCurrentView('emp-dashboard'); 
              break;
          case 'USER':
              if (role === Role.SUPERADMIN) {
                  const targetUser = users.find(u => u.id === n.targetEntityId);
                  if (targetUser) setInspectionUser(targetUser);
              }
              break;
          default: break;
      }
  };

  // --- RENDER HELPERS ---

  const resolveDocContext = () => {
    if (!docData) return { company: undefined, user: undefined }; 
    if (docType === 'DEBIT_NOTE' || docType === 'VAT_INVOICE') {
       const order = docData as Order;
       const company = companies.find(c => c.id === order.companyId);
       return { company };
    }
    if (docType === 'BUYBACK_AGREEMENT') {
      const agreement = docData as BuybackAgreement;
      const user = users.find(u => u.id === agreement.userId);
      return { user };
    }
    if (docType === 'IMPORT_REPORT') {
        const importReport = docData; 
        const company = companies.find(c => c.id === importReport.company?.id); 
        const user = users.find(u => u.id === importReport.user?.id); 
        return { company, user };
    }
    if (docType === 'PROTOCOL') {
        const batch = docData as DistributionBatch;
        const company = companies.find(c => c.id === batch.companyId);
        return { company };
    }
    return { company: undefined, user: undefined };
  };
  
  // --- AUTH GUARD ---
  if (!currentUser) {
      return (
          <>
            <ToastContainer toasts={toasts} removeToast={actions.removeToast} />
            <LoginScreen users={users} onLogin={actions.login} />
          </>
      );
  }

  const { company: docCompanyContext, user: docUserContext } = resolveDocContext();
  const myNotifications = notifications.filter(n => n.userId === currentUser.id || (currentUser.role === Role.SUPERADMIN && n.userId === 'ALL_ADMINS'));
  const unreadCount = myNotifications.filter(n => !n.read).length;

  const renderContent = () => {
    switch (currentUser.role) {
      case Role.SUPERADMIN:
        return (
          <DashboardSuperadmin 
            currentView={currentView}
            orders={orders}
            vouchers={vouchers}
            users={users} 
            companies={companies}
            buybacks={buybacks}
            auditLogs={auditLogs}
            commissions={commissions}
            notificationConfigs={notificationConfigs}
            services={services}
            systemConfig={systemConfig}
            onApproveOrder={actions.handleApproveOrder}
            onSimulateBankPayment={actions.handleBankPayment}
            onApproveBuyback={actions.handleApproveBuyback}
            onSimulateExpiration={actions.simulateExpiration}
            onViewDocument={handleOpenDocument}
            onUpdateNotificationConfig={actions.handleUpdateNotificationConfig}
            onUpdateSystemConfig={actions.handleUpdateSystemConfig}
            onUpdateCompanyConfig={actions.handleUpdateCompanyConfig}
            onManualEmission={actions.handleManualEmission}
            onToast={actions.addToast}
          />
        );
      case Role.HR:
        return (
          <HrViewGuard currentUser={currentUser} companies={companies} onLogout={actions.logout}>
            {(company) => {
              const myEmployees = users.filter(u => u.companyId === company.id && u.role === Role.EMPLOYEE);
              const myOrders = orders.filter(o => o.companyId === company.id);
              const myVouchers = vouchers.filter(v => v.companyId === company.id);
              return (
                <DashboardHR
                  currentView={currentView}
                  onViewChange={setCurrentView}
                  company={company}
                  employees={myEmployees}
                  orders={myOrders}
                  vouchers={myVouchers}
                  importHistory={importHistory}
                  onPlaceOrder={actions.handlePlaceOrder}
                  onDistribute={actions.handleDistribute}
                  onPayOrder={() => actions.addToast("Integracja Bankowa", "Funkcja dostępna w pełnej wersji.", "INFO")}
                  onDeactivateEmployee={actions.handleDeactivateEmployee}
                  onViewProforma={(type, order) => handleOpenDocument(type, order, undefined, company)}
                  onBulkImport={actions.handleBulkImport}
                  onParsePayroll={actions.handleParseAndMatchPayroll}
                  onExportPayrollTemplate={actions.handleExportPayrollTemplate}
                />
              );
            }}
          </HrViewGuard>
        );
      case Role.EMPLOYEE:
        const myVouchersList = vouchers.filter(v => v.ownerId === currentUser.id);
        const myBuybacks = buybacks.filter(b => b.userId === currentUser.id);
        const myTransactions = transactions.filter(t => t.userId === currentUser.id);

        return (
          <DashboardEmployee 
            currentView={currentView}
            user={currentUser}
            vouchers={myVouchersList}
            buybacks={myBuybacks}
            services={services}
            transactions={myTransactions}
            onViewChange={setCurrentView}
            onPurchaseService={actions.handleServicePurchase}
            onViewAgreement={(agreement) => handleOpenDocument('BUYBACK_AGREEMENT', agreement, currentUser)} // Pass currentUser explicitly
          />
        );
      case Role.DIRECTOR:
      case Role.MANAGER:
      case Role.ADVISOR:
        return (
            <DashboardSales 
                currentUser={currentUser}
                commissions={commissions}
                companies={companies}
                orders={orders}
                allUsers={users}
            />
        );
      default: return <div>Rola nieznana</div>;
    }
  };

  return (
    <div className={`flex h-screen font-sans ${currentUser.role === Role.EMPLOYEE ? 'bg-[#030712] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <ToastContainer toasts={toasts} removeToast={actions.removeToast} />
      <SessionGuard /> {/* GLOBAL SECURITY GUARD */}
      
      <GlobalSearch 
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(view) => {
              setCurrentView(view);
              setIsSearchOpen(false);
          }} 
          onInspectUser={(user) => {
              if (currentUser.role === Role.SUPERADMIN) {
                  setInspectionUser(user);
                  setIsSearchOpen(false);
              } else {
                  actions.addToast("Brak Uprawnień", "Podgląd szczegółów użytkownika dostępny tylko dla Administratora.", "WARNING");
              }
          }}
          onLogout={actions.logout}
      />

      <Sidebar 
        currentUser={currentUser} 
        currentView={currentView}
        onChangeView={setCurrentView}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isDesktopOpen={isDesktopSidebarOpen} // Corrected: Pass boolean state, not setter
        onSwitchUser={actions.logout}
        isLogout={true} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
        {/* Changed z-20 to z-40 to be above DashboardHR content (which uses z-30) */}
        <header className={`h-16 md:h-20 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-40 relative border-b ${currentUser.role === Role.EMPLOYEE ? 'bg-[#030712]/80 backdrop-blur-xl border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleSidebar}
              className={`p-2 -ml-2 rounded-lg transition ${currentUser.role === Role.EMPLOYEE ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Menu size={24} />
            </button>
            <div>
              <h2 className={`text-lg font-bold hidden sm:block ${currentUser.role === Role.EMPLOYEE ? 'text-white' : 'text-slate-800'}`}>
                {currentUser.role === Role.SUPERADMIN ? 'Panel Administracyjny' :
                 currentUser.role === Role.HR ? 'Zarządzanie Kadrami' :
                 currentUser.role === Role.EMPLOYEE ? 'Strefa Pracownika' : 'Strefa Partnera'}
              </h2>
              <p className={`text-xs hidden sm:block ${currentUser.role === Role.EMPLOYEE ? 'text-slate-400' : 'text-slate-500'}`}>
                {companies.find(c => c.id === currentUser.companyId)?.name || 'Platforma Centralna'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* SEARCH / STATS BAR for Employee */}
            {currentUser?.role === Role.EMPLOYEE && (
                <div className="hidden lg:flex items-center gap-4 mr-6 pl-6 border-l border-slate-100">
                    <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                       <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
                          <Wallet size={18} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase leading-none tracking-tight">Twoje Saldo</span>
                          <span className="text-base font-bold text-slate-800 leading-tight">
                            {currentUser.voucherBalance} <span className="text-xs text-slate-400 font-normal">pkt</span>
                          </span>
                       </div>
                    </div>

                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${expiringCount > 0 ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                       <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${expiringCount > 0 ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-200 text-slate-400'}`}>
                          <Clock size={18} />
                       </div>
                       <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase leading-none tracking-tight ${expiringCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Wygasają</span>
                          <span className={`text-base font-bold leading-tight ${expiringCount > 0 ? 'text-slate-800' : 'text-slate-500'}`}>{expiringCount}</span>
                       </div>
                    </div>
                </div>
            )}

            {/* Search Trigger Button */}
            <button
                onClick={() => setIsSearchOpen(true)}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition mr-2 ${currentUser.role === Role.EMPLOYEE ? 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 hover:border-slate-300'}`}
                title="Szukaj (Ctrl+K)"
            >
                <Search size={14} />
                <span>Szukaj...</span>
                <span className="bg-white border border-slate-200 px-1.5 rounded text-[10px] shadow-sm ml-2">Ctrl+K</span>
            </button>

            <NotificationCenter 
                notifications={myNotifications}
                unreadCount={unreadCount}
                onMarkRead={actions.handleMarkNotificationsRead}
                onAction={(id, action) => {
                    if (action.type === 'REVIEW_IBAN') {
                        const targetUser = users.find(u => u.id === action.targetId);
                        if (targetUser) setInspectionUser(targetUser);
                    }
                    actions.handleNotificationAction(id, action);
                }}
                onClearAll={actions.handleClearNotifications}
                onViewHistory={() => setIsHistoryModalOpen(true)}
                onNotificationClick={handleNotificationClick}
            />
            
            <button
                title="Ustawienia" onClick={() => setIsSettingsOpen(true)} className={`p-2 rounded-full transition relative group ${currentUser.role === Role.EMPLOYEE ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                <Settings size={20} />
            </button>

            <button
               onClick={actions.logout}
               className={`hidden md:flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border transition group ${currentUser.role === Role.EMPLOYEE ? 'border-white/10 bg-white/5 hover:border-red-500/40 hover:bg-red-500/10' : 'border-slate-200 bg-white hover:border-red-200 hover:bg-red-50'}`}
               title="Wyloguj się"
            >
               <div className="text-right hidden lg:block">
                  <p className={`text-xs font-bold group-hover:text-red-400 ${currentUser.role === Role.EMPLOYEE ? 'text-slate-200' : 'text-slate-700 group-hover:text-red-700'}`}>{currentUser.name}</p>
                  <p className={`text-xs uppercase ${currentUser.role === Role.EMPLOYEE ? 'text-slate-500' : 'text-slate-400'}`}>{currentUser.role}</p>
               </div>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border transition ${currentUser.role === Role.EMPLOYEE ? 'bg-white/10 text-slate-200 border-white/10 group-hover:bg-red-500 group-hover:text-white' : 'bg-slate-100 text-slate-600 border-slate-100 group-hover:bg-red-500 group-hover:text-white'}`}>
                  {currentUser.name.charAt(0)}
               </div>
            </button>
          </div>
        </header>

        <main id="main-scroll-container" className={`flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth ${currentUser.role === Role.EMPLOYEE ? 'bg-transparent' : 'bg-slate-50/50'}`}>
           <div className="max-w-7xl mx-auto">
              {renderContent()}
           </div>
        </main>
      </div>

      <DocumentModal 
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        type={docType}
        data={docData}
        company={docCompanyContext} // Pass resolved company
        user={docUserContext}     // Pass resolved user
        template={systemConfig.buybackAgreementTemplate}
      />

      <NotificationHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        notifications={myNotifications}
        onClearAll={actions.handleClearNotifications}
        onNotificationClick={handleNotificationClick} // Added prop
      />

      {isSettingsOpen && (
          <EmployeeSettingsModal 
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            user={currentUser}
            onSave={(fin) => actions.handleUpdateUserFinance(currentUser.id, fin)}
          />
      )}

      {inspectionUser && (
          <UserInspectionModal 
              isOpen={!!inspectionUser}
              onClose={() => setInspectionUser(null)}
              user={inspectionUser}
              company={companies.find(c => c.id === inspectionUser.companyId)}
              userBuybackHistory={buybacks.filter(b => b.userId === inspectionUser.id)}
              onApproveCurrent={actions.handleApproveBuyback}
          />
      )}
    </div>
  );
};

export default function App() {
  return (
    <StrattonProvider>
      <AppContent />
    </StrattonProvider>
  );
}
