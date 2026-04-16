'use client';

// ── EmployerDashboardClient ───────────────────────────────────────────────────
// Layout identyczny jak App.tsx dla roli HR:
//   Sidebar + header (EBS logo, pozdrowienie, wyszukiwarka, powiadomienia,
//   ustawienia, wyloguj) + main z DashboardNewHR.
// Używa dokładnie tych samych komponentów co wersja Vite.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardNewHR } from '@/views/DashboardNewHR';
import { Sidebar } from '@/components/Sidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { ToastContainer } from '@/components/Toast';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { NotificationHistoryModal } from '@/components/notifications/NotificationHistoryModal';
import { HRSettingsModal } from '@/components/hr/HRSettingsModal';
import { useStrattonSystem } from '@/context/StrattonContext';
import { supabaseBrowser } from '@/lib/supabase';
import { Role } from '@/types';
import type { Notification } from '@/types';
import { Settings, Search } from 'lucide-react';

// ── Wewnętrzny layout — używa StrattonContext z DashboardBootstrap ────────────
function HRLayout() {
  const { state, actions } = useStrattonSystem();
  const { users, companies, vouchers, orders, notifications, toasts } = state;
  const currentUser = state.currentUser;

  // ── Stan UI (identyczny jak App.tsx) ──────────────────────────────────────
  const [currentView,          setCurrentView]          = useState<string>('hr-order');
  const [isMobileSidebarOpen,  setMobileSidebarOpen]    = useState(false);
  const [isDesktopSidebarOpen, setDesktopSidebarOpen]   = useState(true);
  const [isSearchOpen,         setSearchOpen]           = useState(false);
  const [isSettingsOpen,       setSettingsOpen]         = useState(false);
  const [isHistoryModalOpen,   setHistoryModalOpen]     = useState(false);

  // Ctrl+K — otwiera GlobalSearch
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

  // ── WSZYSTKIE HOOKI PRZED WCZESNYMI RETURNAMI (React Rules of Hooks) ─────
  const company = useMemo(
    () => currentUser ? (companies.find(c => c.id === currentUser.companyId) ?? null) : null,
    [currentUser, companies]
  );

  const myNotifications = useMemo(
    () => currentUser ? notifications.filter(n => n.userId === currentUser.id) : [],
    [notifications, currentUser]
  );

  const unreadCount = useMemo(
    () => myNotifications.filter(n => !n.read).length,
    [myNotifications]
  );

  const handleLogout = useCallback(async () => {
    await supabaseBrowser.auth.signOut();
    actions.logout();
    window.location.href = '/login';
  }, [actions]);

  const handleNotificationClick = useCallback((n: Notification) => {
    if (!n.read) actions.handleMarkSingleNotificationRead(n.id);
    if (n.targetEntityType === 'ORDER') setCurrentView('hr-history');
  }, [actions]);

  // ── Wczesne returny dopiero po wszystkich hookach ─────────────────────────
  if (!currentUser) return null;

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-700">
        Brak przypisanej firmy. Skontaktuj się z administratorem.
      </div>
    );
  }

  // ── Dane dla dashboardu (nie-hooki, mogą być po strażnikach) ─────────────
  const myEmployees = users.filter(
    u => u.companyId === company.id && u.role === Role.EMPLOYEE
  );
  const myOrders   = orders.filter(o => o.companyId === company.id);
  const myVouchers = vouchers.filter(v => v.companyId === company.id);

  // ── Render (identyczny layout jak App.tsx) ────────────────────────────────
  return (
    <div className="flex h-screen font-sans text-slate-900 relative overflow-hidden bg-slate-100">

      <ToastContainer toasts={toasts} removeToast={actions.removeToast} />

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(view) => { setCurrentView(view); setSearchOpen(false); }}
        onInspectUser={() => {}}
        onLogout={handleLogout}
      />

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
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

      {/* ── PRAWA KOLUMNA: header + main ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative transition-all duration-300">

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <header className="h-16 md:h-20 flex items-center px-4 md:px-8 flex-shrink-0 z-40 relative border-b bg-white border-slate-200">

          {/* LEFT: logo + pozdrowienie */}
          <div className="flex-1 flex items-center gap-4">
            <button
              onClick={() => setDesktopSidebarOpen(prev => !prev)}
              className="self-stretch -ml-1 px-2 rounded-lg transition flex items-center justify-center overflow-visible hover:bg-slate-100"
            >
              <img
                src="/ebs-black.svg"
                alt="EBS"
                style={{ height: 62, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold leading-tight text-slate-900">
                Cześć,{' '}
                <span style={{ color: '#7C3AED' }}>
                  {currentUser.name.split(' ')[0]}
                </span>
              </h2>
            </div>
          </div>

          {/* CENTER: wyszukiwarka */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition w-96 bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 hover:border-slate-300"
            title="Szukaj (Ctrl+K)"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Szukaj...</span>
            <span className="px-1.5 rounded text-[10px] border bg-white border-slate-200 text-slate-400">
              Ctrl+K
            </span>
          </button>

          {/* RIGHT: powiadomienia + ustawienia + użytkownik */}
          <div className="flex-1 flex items-center gap-3 justify-end">

            <NotificationCenter
              notifications={myNotifications}
              unreadCount={unreadCount}
              onMarkRead={actions.handleMarkNotificationsRead}
              onAction={(id, action) => actions.handleNotificationAction(id, action)}
              onClearAll={actions.handleClearNotifications}
              onViewHistory={() => setHistoryModalOpen(true)}
              onNotificationClick={handleNotificationClick}
            />

            <button
              title="Ustawienia"
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full transition text-slate-400 hover:bg-slate-100"
            >
              <Settings size={20} />
            </button>

            {/* User / wyloguj — identyczny styl jak App.tsx */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border transition group border-slate-200 bg-white hover:border-red-300 hover:bg-red-50"
              title="Wyloguj się"
            >
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold text-slate-700 group-hover:text-red-400">
                  {currentUser.name}
                </p>
                <p className="text-xs uppercase text-slate-400">
                  {currentUser.role}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold border transition group-hover:bg-red-500 group-hover:text-white bg-slate-100 text-slate-600 border-slate-200">
                {currentUser.name.charAt(0)}
              </div>
            </button>

          </div>
        </header>

        {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
        <main
          id="main-scroll-container"
          className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth"
        >
          <div className="max-w-7xl mx-auto">
            <DashboardNewHR
              company={company}
              employees={myEmployees}
              vouchers={myVouchers}
              orders={myOrders}
              currentUser={currentUser}
              onLogout={handleLogout}
              currentView={currentView}
              onViewChange={setCurrentView}
            />
          </div>
        </main>
      </div>

      {/* ── MODALE ──────────────────────────────────────────────────────── */}
      {isSettingsOpen && (
        <HRSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setSettingsOpen(false)}
          currentUser={currentUser}
          company={company}
        />
      )}

      <NotificationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        notifications={myNotifications}
        onClearAll={actions.handleClearNotifications}
        onNotificationClick={handleNotificationClick}
      />

    </div>
  );
}

// ── Export: owija layout w DashboardBootstrap (auth sync + StrattonProvider) ──
export function EmployerDashboardClient() {
  return (
    <DashboardBootstrap>
      <HRLayout />
    </DashboardBootstrap>
  );
}
