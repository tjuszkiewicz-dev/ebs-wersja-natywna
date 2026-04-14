'use client';

import React, { useState, useEffect } from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardEmployee } from '@/views/DashboardEmployee';
import { Sidebar } from '@/components/Sidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { ToastContainer } from '@/components/Toast';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { NotificationHistoryModal } from '@/components/notifications/NotificationHistoryModal';
import { useStrattonSystem } from '@/context/StrattonContext';
import { supabaseBrowser } from '@/lib/supabase';
import { Search, Settings } from 'lucide-react';

function EmployeeLayout() {
  const { state, actions } = useStrattonSystem();
  const { vouchers, buybacks, services, transactions, notifications, toasts } = state;
  const currentUser = state.currentUser;

  const [currentView,          setCurrentView]        = useState('WALLET');
  const [isMobileSidebarOpen,  setMobileSidebarOpen]  = useState(false);
  const [isDesktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isSearchOpen,         setSearchOpen]         = useState(false);
  const [isHistoryModalOpen,   setHistoryModalOpen]   = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!currentUser) return null;

  const myVouchers     = vouchers.filter(v => v.ownerId === currentUser.id);
  const myBuybacks     = buybacks.filter(b => b.userId  === currentUser.id);
  const myTransactions = transactions.filter(t => t.userId === currentUser.id);
  const myNotifications = notifications.filter(n => n.userId === currentUser.id);
  const unreadCount     = myNotifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    actions.logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen font-sans text-slate-900 relative overflow-hidden bg-black">

      <ToastContainer toasts={toasts} removeToast={actions.removeToast} />

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(view) => { setCurrentView(view); setSearchOpen(false); }}
        onInspectUser={() => {}}
        onLogout={handleLogout}
      />

      {/* SIDEBAR */}
      <Sidebar
        currentUser={currentUser}
        currentView={currentView}
        onChangeView={setCurrentView}
        isOpen={isMobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onToggleDesktop={() => setDesktopSidebarOpen(prev => !prev)}
        isDesktopOpen={isDesktopSidebarOpen}
        onSwitchUser={handleLogout}
        isLogout={true}
      />

      {/* PRAWA KOLUMNA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative transition-all duration-300">

        {/* HEADER */}
        <header className="h-16 md:h-20 flex items-center px-4 md:px-8 flex-shrink-0 z-40 relative border-b bg-black border-black">

          {/* LEFT */}
          <div className="flex-1 flex items-center gap-4">
            <button
              onClick={() => setDesktopSidebarOpen(prev => !prev)}
              className="self-stretch -ml-1 px-2 rounded-lg transition flex items-center justify-center overflow-visible hover:bg-white/10"
            >
              <img src="/ebs-white.svg" alt="EBS" style={{ height: 62, width: 'auto', objectFit: 'contain', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).src = '/ebs-black.svg'; }}
              />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold leading-tight text-white">
                Cześć,{' '}
                <span className="text-emerald-400">{currentUser.name.split(' ')[0]}</span>
              </h2>
            </div>
          </div>

          {/* CENTER: wyszukiwarka */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition w-96 bg-white/5 border border-white/10 text-white/40 hover:bg-white/10"
            title="Szukaj (Ctrl+K)"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Szukaj...</span>
            <span className="px-1.5 rounded text-[10px] border bg-white/5 border-white/10 text-white/30">Ctrl+K</span>
          </button>

          {/* RIGHT */}
          <div className="flex-1 flex items-center gap-3 justify-end">

            <NotificationCenter
              notifications={myNotifications}
              unreadCount={unreadCount}
              onMarkRead={actions.handleMarkNotificationsRead}
              onAction={(id, action) => actions.handleNotificationAction(id, action)}
              onClearAll={actions.handleClearNotifications}
              onViewHistory={() => setHistoryModalOpen(true)}
              onNotificationClick={(n) => { if (!n.read) actions.handleMarkSingleNotificationRead(n.id); }}
            />

            <button title="Ustawienia" className="p-2 rounded-full transition text-white/40 hover:bg-white/10">
              <Settings size={20} />
            </button>

            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border transition group border-white/10 bg-white/5 hover:border-red-500/40 hover:bg-red-500/10"
              title="Wyloguj się"
            >
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold text-white/70 group-hover:text-red-400">{currentUser.name}</p>
                <p className="text-xs uppercase text-white/30">EMPLOYEE</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold border transition group-hover:bg-red-500 group-hover:text-white bg-white/10 text-white border-white/20">
                {currentUser.name.charAt(0)}
              </div>
            </button>

          </div>
        </header>

        {/* MAIN */}
        <main id="main-scroll-container" className="flex-1 overflow-y-auto relative scroll-smooth bg-black">
          <DashboardEmployee
            currentView={currentView}
            user={currentUser}
            vouchers={myVouchers}
            buybacks={myBuybacks}
            services={services}
            transactions={myTransactions}
            onViewChange={setCurrentView}
            onPurchaseService={actions.handleServicePurchase}
            onViewAgreement={() => {}}
          />
        </main>
      </div>

      <NotificationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        notifications={myNotifications}
        onClearAll={actions.handleClearNotifications}
        onNotificationClick={(n) => { if (!n.read) actions.handleMarkSingleNotificationRead(n.id); }}
      />

    </div>
  );
}

export function EmployeeDashboardClient() {
  return (
    <DashboardBootstrap>
      <EmployeeLayout />
    </DashboardBootstrap>
  );
}
