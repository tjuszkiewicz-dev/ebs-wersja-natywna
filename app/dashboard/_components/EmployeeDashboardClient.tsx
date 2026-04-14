'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardEmployee } from '@/views/DashboardEmployee';
import { Sidebar } from '@/components/Sidebar';

const SoftAurora = dynamic(() => import('@/components/ui/SoftAurora'), { ssr: false });
import { GlobalSearch } from '@/components/GlobalSearch';
import { ToastContainer } from '@/components/Toast';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { NotificationHistoryModal } from '@/components/notifications/NotificationHistoryModal';
import { useStrattonSystem } from '@/context/StrattonContext';
import { supabaseBrowser } from '@/lib/supabase';
import { Search, Settings, Wallet, Clock, X } from 'lucide-react';

function EmployeeLayout() {
  const { state, actions } = useStrattonSystem();
  const { vouchers, buybacks, services, transactions, notifications, toasts } = state;
  const currentUser = state.currentUser;

  const [currentView,          setCurrentView]        = useState('WALLET');
  const [isMobileSidebarOpen,  setMobileSidebarOpen]  = useState(false);
  const [isDesktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isSearchOpen,         setSearchOpen]         = useState(false);
  const [isHistoryModalOpen,   setHistoryModalOpen]   = useState(false);
  const [showOrangePopup,      setShowOrangePopup]    = useState(true);

  const closeOrangePopup = () => {
    setShowOrangePopup(false);
  };

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

  // Nearest expiry date among active vouchers
  const activeVouchers = myVouchers.filter(v => v.status === 'DISTRIBUTED' && v.expiryDate);
  const nearestExpiry = activeVouchers
    .map(v => new Date(v.expiryDate!))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const expiryLabel = nearestExpiry
    ? nearestExpiry < new Date()
      ? 'wygasło'
      : nearestExpiry.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : 'brak';

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    actions.logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen font-sans text-slate-900 relative overflow-hidden" style={{ backgroundColor: '#080613' }}>

      {/* Aurora background */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <SoftAurora
          speed={0.4}
          scale={1.2}
          brightness={1.6}
          color1="#30df6a"
          color2="#4297cd"
          noiseFrequency={2}
          noiseAmplitude={3}
          bandHeight={0.7}
          bandSpread={1}
          octaveDecay={0.27}
          layerOffset={0.25}
          colorSpeed={1}
          enableMouseInteraction={false}
          mouseInfluence={0.25}
        />
      </div>

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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 transition-all duration-300">

        {/* HEADER */}
        <header className="h-16 md:h-20 flex items-center px-4 md:px-8 flex-shrink-0 z-40 relative border-b bg-black border-black">

          {/* LEFT */}
          <div className="flex-1 flex items-center gap-4">
            <button
              onClick={() => setDesktopSidebarOpen(prev => !prev)}
              className="self-stretch -ml-1 px-2 rounded-lg transition flex items-center justify-center overflow-visible hover:bg-white/10"
            >
              <img src="/ebs-black.svg" alt="EBS" style={{ height: 62, width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }}
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
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition w-96 bg-white/20 border border-white/30 text-white/70 hover:bg-white/25"
            title="Szukaj (Ctrl+K)"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Szukaj...</span>
            <span className="px-1.5 rounded text-[10px] border bg-white/15 border-white/30 text-white/60">Ctrl+K</span>
          </button>

          {/* RIGHT */}
          <div className="flex-1 flex items-center gap-3 justify-end">

            {/* BALANCE WIDGET */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5">
              <Wallet size={14} className="text-emerald-400 flex-shrink-0" />
              <div className="text-right leading-none">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Twoje saldo</p>
                <p className="text-sm font-black text-white">{currentUser.voucherBalance ?? 0} <span className="text-xs font-normal text-white/50">pkt</span></p>
              </div>
            </div>

            {/* EXPIRY WIDGET */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5">
              <Clock size={14} className={nearestExpiry && nearestExpiry < new Date() ? 'text-red-400' : 'text-amber-400'} />
              <div className="text-right leading-none">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Wygasają za</p>
                <p className={`text-sm font-black ${nearestExpiry && nearestExpiry < new Date() ? 'text-red-400' : 'text-white'}`}>{expiryLabel}</p>
              </div>
            </div>

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
        <main id="main-scroll-container" className="flex-1 overflow-y-auto relative scroll-smooth p-4 md:p-6" style={{ zoom: '0.9' }}>
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

      {/* ORANGE POPUP AD */}
      {showOrangePopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closeOrangePopup}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeOrangePopup}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              aria-label="Zamknij"
            >
              <X size={16} className="text-white" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/popup_orange.png"
              alt="Najszybszy światłowód i ponad 200 kanałów TV"
              className="w-full h-auto block"
            />
          </div>
        </div>
      )}

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
