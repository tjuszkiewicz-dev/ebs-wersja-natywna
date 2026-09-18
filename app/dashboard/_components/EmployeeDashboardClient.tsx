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
import { useHistoryView } from '@/lib/useHistoryView';
import { Search, Settings, Wallet, Clock, X, Menu } from 'lucide-react';
import { EmployeeSettingsModal } from '@/components/employee/EmployeeSettingsModal';
import { Role } from '@/types/enums';
import { STORE_IS_HOME } from '@/lib/benefits/storeLayout';
import { EmployeeNav } from '@/components/employee/EmployeeNav';
import { StoreNavContext } from '@/components/employee/store/StoreNavContext';
import type { CategoryFilter } from '@/lib/benefits/catalog';

function EmployeeLayout() {
  const { state, actions } = useStrattonSystem();
  const { vouchers, buybacks, services, transactions, notifications, toasts } = state;
  const currentUser = state.currentUser;

  // Sklep jako ekran startowy: od pierwszego renderu menu boczne podświetla „Sklep benefitów"
  // i wpis historii SPA wskazuje na sklep (useHistoryView zapisuje pierwszy widok replaceState).
  const [currentView,          setCurrentView]        = useState(STORE_IS_HOME ? 'emp-catalog' : 'WALLET');
  useHistoryView(currentView, setCurrentView);
  const [isMobileSidebarOpen,  setMobileSidebarOpen]  = useState(false);
  const [isDesktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isSearchOpen,         setSearchOpen]         = useState(false);
  const [isHistoryModalOpen,   setHistoryModalOpen]   = useState(false);
  const [showOrangePopup,      setShowOrangePopup]    = useState(true);
  const [isSettingsOpen,       setSettingsOpen]       = useState(false);
  // Sklep jako ekran startowy: kategoria i szukajka żyją w powłoce, bo lewa kolumna (EmployeeNav)
  // i siatka sklepu (DashboardEmployee → BenefitStore) muszą je współdzielić.
  const [storeCategory,        setStoreCategory]      = useState<CategoryFilter>('ALL');
  const [storeQuery,           setStoreQuery]         = useState('');
  const storeNav = STORE_IS_HOME ? { category: storeCategory, setCategory: setStoreCategory, query: storeQuery, setQuery: setStoreQuery } : null;
  const goHome = () => setCurrentView('emp-catalog');

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

      {/* LEWA KOLUMNA. Sklep jako ekran startowy (STORE_IS_HOME): kolumna kategorii + saldo sklepu
          zastępuje ciemne zwijane menu (decyzja właściciela 17.09.2026, spec §12) — kategorie
          przełączają siatkę i wracają do sklepu z innych ekranów. W trybie 'wallet': dawny Sidebar;
          superadmin/owner ogląda portal w trybie podglądu (menu pracownika, nie administratora). */}
      {STORE_IS_HOME ? (
        <EmployeeNav
          services={services}
          balance={currentUser.voucherBalance ?? 0}
          category={storeCategory}
          query={storeQuery}
          onCategory={(c) => {
            setStoreCategory(c);
            setCurrentView('emp-catalog');
            document.getElementById('main-scroll-container')?.scrollTo({ top: 0 });
          }}
          currentView={currentView}
          onChangeView={setCurrentView}
        />
      ) : (
        <Sidebar
          currentUser={currentUser.role === Role.EMPLOYEE ? currentUser : { ...currentUser, role: Role.EMPLOYEE }}
          currentView={currentView}
          onChangeView={setCurrentView}
          isOpen={isMobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          onToggleDesktop={() => setDesktopSidebarOpen(prev => !prev)}
          isDesktopOpen={isDesktopSidebarOpen}
          onSwitchUser={handleLogout}
          isLogout={true}
        />
      )}

      {/* PRAWA KOLUMNA */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 transition-all duration-300">

        {/* HEADER */}
        <header className="h-16 md:h-20 flex items-center px-4 md:px-8 flex-shrink-0 z-40 relative border-b bg-black border-black">

          {/* LEFT */}
          <div className="flex-1 flex items-center gap-4">
            {/* Hamburger — mobile, tylko z dawnym menu bocznym; przy sklepie jako starcie kategorie są
                chipsami, a resztę obsługuje dolny pasek, więc szuflady nie ma. */}
            {!STORE_IS_HOME && (
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg transition flex items-center justify-center hover:bg-white/10 text-white"
                aria-label="Menu"
              >
                <Menu size={24} />
              </button>
            )}
            {/* EBS logo — desktop (przy sklepie jako starcie także mobile, w miejscu hamburgera):
                z dawnym menu zwija pasek, ze sklepem wraca na ekran startowy. */}
            <button
              onClick={() => (STORE_IS_HOME ? goHome() : setDesktopSidebarOpen(prev => !prev))}
              aria-label={STORE_IS_HOME ? 'Sklep benefitów' : 'Zwiń lub rozwiń menu boczne'}
              className={`${STORE_IS_HOME ? 'flex' : 'hidden md:flex'} self-stretch -ml-1 px-2 rounded-lg transition items-center justify-center overflow-visible hover:bg-white/10`}
            >
              <img src="/ebs-black.svg" alt="EBS" className="h-9 md:h-[62px]" style={{ width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }}
              />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold leading-tight text-white">
                Cześć,{' '}
                <span className="text-emerald-400">{currentUser.name.split(' ')[0]}</span>
              </h2>
            </div>
          </div>

          {/* CENTER: wyszukiwarka. Sklep jako ekran startowy: JEDNO pole — szukajka nagłówka filtruje
              katalog na żywo (to samo `storeQuery`, które czyta BenefitStore przez StoreNavContext), a pasek
              sklepu na desktopie nie ma już własnego pola (decyzja właściciela 18.09.2026: „były dwa").
              Paleta Ctrl+K zostaje pod skrótem, bez widocznej drugiej szukajki. */}
          {STORE_IS_HOME ? (
            <label className="hidden md:flex items-center gap-2 px-4 h-10 rounded-xl text-sm w-96 bg-white/20 border border-white/30 text-white transition focus-within:bg-white/25 focus-within:border-white/50">
              <Search size={14} className="shrink-0 text-white/70" aria-hidden />
              <input
                type="search"
                value={storeQuery}
                onChange={(e) => {
                  setStoreQuery(e.target.value);
                  if (currentView !== 'emp-catalog') setCurrentView('emp-catalog');
                }}
                placeholder="Szukaj benefitu…"
                aria-label="Szukaj benefitu"
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none"
              />
            </label>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition w-96 bg-white/20 border border-white/30 text-white/70 hover:bg-white/25"
              title="Szukaj (Ctrl+K)"
            >
              <Search size={14} />
              <span className="flex-1 text-left">Szukaj...</span>
              <span className="px-1.5 rounded text-[10px] border bg-white/15 border-white/30 text-white/60">Ctrl+K</span>
            </button>
          )}

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

            <button
              title="Ustawienia"
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full transition text-white/40 hover:bg-white/10 hover:text-white"
            >
              <Settings size={20} />
            </button>

            {/* Wylogowanie: przy sklepie jako starcie widoczne też na mobile (bez szuflady menu nie
                byłoby go nigdzie — w dawnym menu zresztą też go nie było). */}
            <button
              onClick={handleLogout}
              className={`${STORE_IS_HOME ? 'flex' : 'hidden md:flex'} items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border transition group border-white/10 bg-white/5 hover:border-red-500/40 hover:bg-red-500/10`}
              title="Wyloguj się"
              aria-label="Wyloguj się"
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
        <main id="main-scroll-container" className="flex-1 overflow-y-auto relative scroll-smooth p-4 md:p-6 main-zoom">
          <StoreNavContext.Provider value={storeNav}>
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
          </StoreNavContext.Provider>
        </main>
      </div>

      <NotificationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        notifications={myNotifications}
        onClearAll={actions.handleClearNotifications}
        onNotificationClick={(n) => { if (!n.read) actions.handleMarkSingleNotificationRead(n.id); }}
      />

      <EmployeeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        userId={currentUser.id}
        userName={currentUser.name}
      />

      {/* ORANGE POPUP AD */}
      {showOrangePopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closeOrangePopup}
        >
          <div
            className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeOrangePopup}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
              aria-label="Zamknij"
            >
              <X size={18} className="text-white" />
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
