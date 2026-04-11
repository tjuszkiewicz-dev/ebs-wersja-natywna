
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import SoftAurora from './components/ui/SoftAurora';
import { DashboardAdminNew } from './views/DashboardAdminNew';
import { DashboardNewHR } from './views/DashboardNewHR';
import { DashboardEmployee } from './views/DashboardEmployee';
import { DashboardSales } from './views/DashboardSales';
import { LoginScreen } from './views/LoginScreen';
import { Role, Order, BuybackAgreement, Notification, User, DistributionBatch, VoucherStatus } from './types';
import { Search, Settings, Wallet, Clock } from 'lucide-react';
import { DocumentModal } from './components/DocumentModal';
import { ToastContainer } from './components/Toast';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { NotificationHistoryModal } from './components/notifications/NotificationHistoryModal';
import { StrattonProvider, useStrattonSystem } from './context/StrattonContext';
import { UserInspectionModal } from './components/admin/modals/UserInspectionModal';
import { GlobalSearch } from './components/GlobalSearch'; 
import { SessionGuard } from './components/security/SessionGuard'; 
import { EmployeeSettingsModal } from './components/employee/EmployeeSettingsModal';
import { HRSettingsModal } from './components/hr/HRSettingsModal';
import { HrViewGuard } from './components/layout/HrViewGuard';
import { canAccessView } from './utils/permissions';

// Inner App Content (that consumes Context)
const AppContent = () => {
  const { state, actions } = useStrattonSystem(); // No arguments needed now
  
  const {
    users, currentUser, vouchers, companies, orders, buybacks,
    commissions, notifications, services, transactions, systemConfig, toasts
  } = state;

  // --- EMPLOYEE HEADER STATS CALCULATION ---
  const [expiryDisplay, setExpiryDisplay] = React.useState<string>('—');
  const [expiryUrgent,  setExpiryUrgent]  = React.useState(false);
  const [expiryExpired, setExpiryExpired] = React.useState(false);

  React.useEffect(() => {
    if (currentUser?.role !== Role.EMPLOYEE || !currentUser.companyId) return;
    const hasVouchers = (currentUser.voucherBalance ?? 0) > 0
      || vouchers.some(v => v.ownerId === currentUser.id && v.status === VoucherStatus.DISTRIBUTED);
    if (!hasVouchers) return;

    // Pobierz voucher_expiry_day z API (nie z localStorage — może być nieaktualny)
    fetch(`/api/companies/${currentUser.companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const expiryDay:    number | null = data?.voucher_expiry_day    ?? null;
        const expiryHour:   number        = data?.voucher_expiry_hour   ?? 0;
        const expiryMinute: number        = data?.voucher_expiry_minute ?? 5;
        if (!expiryDay) return;

        const tick = () => {
          const now = new Date();
          const candidate = new Date(now.getFullYear(), now.getMonth(), expiryDay, expiryHour, expiryMinute, 0, 0);
          if (candidate.getTime() <= now.getTime()) {
            setExpiryDisplay('wygasło');
            setExpiryUrgent(true);
            setExpiryExpired(true);
            return;
          }
          const diffMs = candidate.getTime() - Date.now();
          const totalHours = Math.floor(diffMs / (1000 * 3600));
          setExpiryDisplay(`${totalHours}h`);
          setExpiryUrgent(totalHours < 72);
          setExpiryExpired(false);
        };

        tick();
        const id = setInterval(tick, 60_000);
        return () => clearInterval(id);
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.companyId, currentUser?.role, currentUser?.voucherBalance]);

  // --- ROUTING STATE ---
  // Lazy initialization to prevent flashing default admin view if user is already logged in (e.g. from LocalStorage)
  const [currentView, setCurrentView] = useState<string>(() => {
      if (!currentUser) return 'admin-dashboard';
      switch (currentUser.role) {
          case Role.SUPERADMIN: return 'admin-dashboard';
          case Role.HR: return 'hr-order';
          case Role.EMPLOYEE: return 'emp-dashboard';
          case Role.ADVISOR:
          case Role.MANAGER:
          case Role.DIRECTOR: return 'sales-dashboard';
          default: return 'admin-dashboard';
      }
  });
  
  // --- UI STATE ---
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
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
                  case Role.HR: setCurrentView('hr-order'); break;
                  case Role.EMPLOYEE: setCurrentView('emp-dashboard'); break;
                  case Role.ADVISOR:
                  case Role.MANAGER:
                  case Role.DIRECTOR: setCurrentView('sales-dashboard'); break;
              }
          }
      }
  }, [currentUser?.id, currentUser?.role]); 

  // --- HANDLERS ---

  const handleOpenDocument = useCallback((type: 'DEBIT_NOTE' | 'VAT_INVOICE' | 'BUYBACK_AGREEMENT' | 'IMPORT_REPORT' | 'PROTOCOL', data: any) => {
    setDocType(type);
    setDocData(data);
    setDocModalOpen(true);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth >= 768) {
      setDesktopSidebarOpen(prev => !prev);
    } else {
      setIsMobileSidebarOpen(true);
    }
  }, []);

  const handleNotificationClick = useCallback((n: Notification) => {
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
              else if (role === Role.HR) setCurrentView('hr-history');
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
  }, [isHistoryModalOpen, actions, users, currentUser?.role]);

  // --- MEMOIZED DERIVED STATE ---

  const { company: docCompanyContext, user: docUserContext } = useMemo(() => {
    if (!docData) return { company: undefined, user: undefined };
    if (docType === 'DEBIT_NOTE' || docType === 'VAT_INVOICE') {
      const order = docData as Order;
      return { company: companies.find(c => c.id === order.companyId) };
    }
    if (docType === 'BUYBACK_AGREEMENT') {
      const agreement = docData as BuybackAgreement;
      return { user: users.find(u => u.id === agreement.userId) };
    }
    if (docType === 'IMPORT_REPORT') {
      return {
        company: companies.find(c => c.id === docData.company?.id),
        user: users.find(u => u.id === docData.user?.id),
      };
    }
    if (docType === 'PROTOCOL') {
      const batch = docData as DistributionBatch;
      return { company: companies.find(c => c.id === batch.companyId) };
    }
    return { company: undefined, user: undefined };
  }, [docData, docType, companies, users]);

  const myNotifications = useMemo(() =>
    notifications.filter(n => n.userId === currentUser?.id || (currentUser?.role === Role.SUPERADMIN && n.userId === 'ALL_ADMINS')),
    [notifications, currentUser?.id, currentUser?.role]
  );

  const unreadCount = useMemo(() => myNotifications.filter(n => !n.read).length, [myNotifications]);

  // --- AUTH GUARD ---
  if (!currentUser) {
      return (
          <>
            <ToastContainer toasts={toasts} removeToast={actions.removeToast} />
            <LoginScreen users={users} onLogin={actions.login} onLoginWithUser={actions.loginWithUser} />
          </>
      );
  }

  const renderContent = () => {
    switch (currentUser.role) {
      case Role.SUPERADMIN:
        return (
          <DashboardAdminNew
            currentView={currentView}
            onViewChange={setCurrentView}
          />
        );
      case Role.HR:
        return (
          <HrViewGuard currentUser={currentUser} companies={companies} onLogout={actions.logout}>
            {(company) => {
              const myVouchers = vouchers.filter(v => v.companyId === company.id);
              const myOrders = orders.filter(o => o.companyId === company.id);
              return (
                <DashboardNewHR
                  company={company}
                  employees={users.filter(u => u.companyId === company.id && u.role === Role.EMPLOYEE)}
                  vouchers={myVouchers}
                  orders={myOrders}
                  currentUser={currentUser}
                  onLogout={actions.logout}
                  currentView={currentView}
                  onViewChange={setCurrentView}
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
            onViewAgreement={(agreement) => handleOpenDocument('BUYBACK_AGREEMENT', agreement)}
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
    <div className={`flex h-screen font-sans text-slate-900 relative overflow-hidden ${currentUser?.role === Role.EMPLOYEE ? '' : 'bg-slate-100'}`}>
      {/* SoftAurora background — only for EMPLOYEE role */}
      {currentUser?.role === Role.EMPLOYEE && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <SoftAurora
            speed={0.6}
            scale={1.4}
            brightness={1.4}
            color1="#44fb37"
            color2="#1d6acd"
            noiseFrequency={1.5}
            noiseAmplitude={2.5}
            bandHeight={0.8}
            bandSpread={1.5}
            octaveDecay={0.04}
            layerOffset={0.9}
            colorSpeed={0.6}
            enableMouseInteraction={false}
            mouseInfluence={0.25}
          />
        </div>
      )}
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
        onToggleDesktop={() => setDesktopSidebarOpen(prev => !prev)}
        isDesktopOpen={isDesktopSidebarOpen}
        onSwitchUser={actions.logout}
        isLogout={true} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative transition-all duration-300">
        {/* Changed z-20 to z-40 to be above DashboardHR content (which uses z-30) */}
          <header className={`h-16 md:h-20 flex items-center px-4 md:px-8 flex-shrink-0 z-40 relative border-b ${currentUser?.role === Role.EMPLOYEE ? 'bg-black border-black' : 'bg-white border-slate-200'}`}>
          {/* LEFT */}
          <div className="flex-1 flex items-center gap-4">
            <button
              onClick={handleToggleSidebar}
              className={`self-stretch -ml-1 px-2 rounded-lg transition flex items-center justify-center overflow-visible ${currentUser?.role === Role.EMPLOYEE ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
            >
              <img src="/ebs-black.svg" alt="EBS" style={{ height: 62, width: 'auto', objectFit: 'contain', filter: currentUser?.role === Role.EMPLOYEE ? 'brightness(0) invert(1)' : 'none', display: 'block' }} />
            </button>
            <div className="hidden sm:block">
              <h2 className={`text-lg font-bold leading-tight ${currentUser?.role === Role.EMPLOYEE ? 'text-white' : 'text-slate-900'}`}>
                Cześć, <span style={{ color: currentUser?.role === Role.EMPLOYEE ? '#a78bfa' : '#7C3AED' }}>{currentUser.name.split(' ')[0]}</span>
              </h2>
            </div>
          </div>

          {/* CENTER: Search */}
          <button
              onClick={() => setIsSearchOpen(true)}
              className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition w-96 ${
                currentUser?.role === Role.EMPLOYEE
                  ? 'bg-white/10 border border-white/20 text-white/50 hover:bg-white/15 hover:border-white/30'
                  : 'bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 hover:border-slate-300'
              }`}
              title="Szukaj (Ctrl+K)"
          >
              <Search size={14} />
              <span className="flex-1 text-left">Szukaj...</span>
              <span className={`px-1.5 rounded text-[10px] border ${
                currentUser?.role === Role.EMPLOYEE ? 'bg-white/10 border-white/20' : 'bg-white border-slate-200 text-slate-400'
              }`}>Ctrl+K</span>
          </button>

          {/* RIGHT */}
          <div className="flex-1 flex items-center gap-3 justify-end">
            {/* SEARCH / STATS BAR for Employee */}
            {currentUser?.role === Role.EMPLOYEE && (
                <div className="hidden lg:flex items-center gap-4 mr-4 pl-4 border-l border-white/10">
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${expiryExpired ? 'bg-white/5 border-white/10 opacity-50 grayscale' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                       <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-colors ${expiryExpired ? 'bg-white/10 text-white/30 shadow-none' : 'bg-emerald-600 text-white shadow-emerald-600/20'}`}>
                          <Wallet size={18} />
                       </div>
                       <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase leading-none tracking-tight ${expiryExpired ? 'text-white/30' : 'text-emerald-400'}`}>Twoje Saldo</span>
                          <span className={`text-base font-bold leading-tight ${expiryExpired ? 'text-white/30' : 'text-white'}`}>
                            {currentUser.voucherBalance} <span className="text-xs font-normal text-white/40">pkt</span>
                          </span>
                       </div>
                    </div>

                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${expiryExpired ? 'bg-white/5 border-white/10 opacity-50 grayscale' : expiryUrgent ? 'bg-amber-500/10 border-amber-500/30 shadow-sm' : 'bg-white/5 border-white/10 opacity-60'}`}>
                       <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${expiryExpired ? 'bg-white/10 text-white/30 shadow-none' : expiryUrgent ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/10 text-white/40'}`}>
                          <Clock size={18} />
                       </div>
                       <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase leading-none tracking-tight ${expiryExpired ? 'text-white/30' : expiryUrgent ? 'text-amber-400' : 'text-white/30'}`}>Wygasają za</span>
                          <span className={`text-base font-bold leading-tight ${expiryExpired ? 'text-white/30' : expiryUrgent ? 'text-white' : 'text-white/50'}`}>{expiryDisplay}</span>
                       </div>
                    </div>
                </div>
            )}

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
                title="Ustawienia" onClick={() => setIsSettingsOpen(true)} className={`p-2 rounded-full transition relative group ${
                  currentUser?.role === Role.EMPLOYEE ? 'text-white/50 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'
                }`}
            >
                <Settings size={20} />
            </button>

            <button
               onClick={actions.logout}
               className={`hidden md:flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border transition group ${
                 currentUser?.role === Role.EMPLOYEE
                   ? 'border-white/20 bg-white/5 hover:border-red-500/40 hover:bg-red-500/10'
                   : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50'
               }`}
               title="Wyloguj się"
            >
               <div className="text-right hidden lg:block">
                  <p className={`text-xs font-bold group-hover:text-red-400 ${
                    currentUser?.role === Role.EMPLOYEE ? 'text-white/80' : 'text-slate-700'
                  }`}>{currentUser.name}</p>
                  <p className={`text-xs uppercase ${
                    currentUser?.role === Role.EMPLOYEE ? 'text-white/40' : 'text-slate-400'
                  }`}>{currentUser.role}</p>
               </div>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border transition group-hover:bg-red-500 group-hover:text-white ${
                 currentUser?.role === Role.EMPLOYEE
                   ? 'bg-white/10 text-white/70 border-white/10'
                   : 'bg-slate-100 text-slate-600 border-slate-200'
               }`}>
                  {currentUser.name.charAt(0)}
               </div>
            </button>
          </div>
        </header>

        <main id="main-scroll-container" className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth">
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

      {isSettingsOpen && currentUser.role === Role.HR ? (
          <HRSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            currentUser={currentUser}
            company={companies.find(c => c.id === currentUser.companyId)}
          />
      ) : isSettingsOpen ? (
          <EmployeeSettingsModal 
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            user={currentUser}
            onSave={(fin) => actions.handleUpdateUserFinance(currentUser.id, fin)}
          />
      ) : null}

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
