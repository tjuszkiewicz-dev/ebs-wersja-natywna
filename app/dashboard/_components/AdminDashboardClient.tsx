'use client';

import React, { useState, useEffect } from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardAdminNew } from '@/views/DashboardAdminNew';
import { Sidebar } from '@/components/Sidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { ToastContainer } from '@/components/Toast';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { NotificationHistoryModal } from '@/components/notifications/NotificationHistoryModal';
import { useStrattonSystem } from '@/context/StrattonContext';
import { supabaseBrowser } from '@/lib/supabase';
import { Search, Menu } from 'lucide-react';

function AdminLayout() {
  const { state, actions } = useStrattonSystem();
  const { notifications, toasts } = state;
  const currentUser = state.currentUser;

  const [currentView,          setCurrentView]        = useState('admin-pulpit');
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

  const myNotifications = notifications.filter(n => n.userId === currentUser.id);
  const unreadCount     = myNotifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    actions.logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen font-sans text-slate-900 overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>

      <ToastContainer toasts={toasts} removeToast={actions.removeToast} />

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(view) => { setCurrentView(view); setSearchOpen(false); }}
        onInspectUser={() => {}}
        onLogout={handleLogout}
      />

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

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 transition-all duration-300">

        {/* HEADER */}
        <header className="h-16 flex items-center px-4 md:px-8 flex-shrink-0 z-40 relative border-b bg-white border-slate-200 shadow-sm">

          {/* LEFT */}
          <div className="flex-1 flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg transition text-slate-600 hover:bg-slate-100"
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
            <button
              onClick={() => setDesktopSidebarOpen(prev => !prev)}
              className="hidden md:flex self-stretch -ml-1 px-2 rounded-lg transition items-center justify-center hover:bg-slate-100"
            >
              <img src="/ebs-black.svg" alt="EBS" style={{ height: 46, width: 'auto', objectFit: 'contain' }} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-base font-bold leading-tight text-slate-900">
                Cześć, <span className="text-blue-600">{currentUser.name.split(' ')[0]}</span>
              </h2>
            </div>
          </div>

          {/* CENTER */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition w-80 bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200"
            title="Szukaj (Ctrl+K)"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Szukaj...</span>
            <span className="px-1.5 rounded text-[10px] border bg-white border-slate-200 text-slate-400">Ctrl+K</span>
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
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border transition group border-slate-200 bg-slate-50 hover:border-red-300 hover:bg-red-50"
              title="Wyloguj się"
            >
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold text-slate-700 group-hover:text-red-600">{currentUser.name}</p>
                <p className="text-[10px] uppercase text-slate-400">SUPERADMIN</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold border transition group-hover:bg-red-500 group-hover:text-white bg-blue-100 text-blue-700 border-blue-200">
                {currentUser.name.charAt(0)}
              </div>
            </button>
          </div>
        </header>

        {/* MAIN */}
        <main className="flex-1 overflow-y-auto scroll-smooth p-4 md:p-6">
          <DashboardAdminNew
            currentView={currentView}
            onViewChange={setCurrentView}
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

export function AdminDashboardClient() {
  return (
    <DashboardBootstrap>
      <AdminLayout />
    </DashboardBootstrap>
  );
}

