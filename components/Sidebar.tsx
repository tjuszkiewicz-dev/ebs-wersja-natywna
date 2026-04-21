
import React, { useMemo } from 'react';
import { Role, User } from '../types';
import { LayoutDashboard, Users, FileText, Wallet, ShieldCheck, DollarSign, X, ChevronRight, LogOut, BarChart3, Settings2, FolderOpen, HelpCircle, Grid, CreditCard, Plus, ChevronLeft, Smartphone, HeartPulse, Shield, TrendingUp, Brain, BookOpen, History, Ticket, RefreshCw } from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  currentView: string;
  onChangeView: (view: string) => void;
  isOpen: boolean; // Mobile state
  onClose: () => void; // Mobile close handler
  onToggleDesktop?: () => void; // Desktop toggle handler
  isDesktopOpen: boolean; // Desktop collapse state
  onSwitchUser: () => void; // NOW USED FOR LOGOUT
  isLogout?: boolean; // Prop to style the button as Logout
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentUser, 
  currentView, 
  onChangeView, 
  isOpen, 
  onClose,
  onToggleDesktop,
  isDesktopOpen,
  onSwitchUser,
  isLogout = false
}) => {
  
  const roleLabel = useMemo(() => {
    switch(currentUser.role) {
      case Role.SUPERADMIN: return 'Administrator';
      case Role.HR: return 'Księgowość / HR';
      case Role.EMPLOYEE: return 'Pracownik';
      default: return 'Partner / Sprzedaż';
    }
  }, [currentUser.role]);

  const menuItems = useMemo(() => {
    switch (currentUser.role) {
      case Role.SUPERADMIN:
        return [
          { id: 'admin-pulpit',    label: 'Pulpit',              icon: <LayoutDashboard size={20} /> },
          { id: 'admin-klienci',   label: 'Baza klientów',       icon: <Users size={20} /> },
          { id: 'admin-platnosci', label: 'Płatności i faktury', icon: <CreditCard size={20} /> },
          { id: 'admin-archiwum',  label: 'Archiwum',            icon: <FolderOpen size={20} /> },
          { id: 'admin-vouchery',  label: 'Vouchery',                icon: <Ticket size={20} /> },
          { id: 'admin-buyback',   label: 'Anulowanie subskrypcji', icon: <RefreshCw size={20} /> },
        ];
      case Role.HR:
        return [
          { id: 'hr-order',     label: 'Nowe zamówienie',       icon: <Plus size={20} /> },
          { id: 'hr-history',   label: 'Historia zamówień',     icon: <FileText size={20} /> },
          { id: 'hr-employees', label: 'Kartoteka pracowników', icon: <Users size={20} /> },
          { id: 'hr-payments',  label: 'Płatności i faktury',   icon: <CreditCard size={20} /> },
        ];
      case Role.EMPLOYEE:
        return [
          { id: 'emp-twoje-aplikacje', label: 'Twoje Aplikacje', icon: <Smartphone size={20} /> },
          { id: 'emp-profitowi', label: 'Profitowi', icon: <HeartPulse size={20} /> },
          { id: 'emp-multipolisa', label: 'Multipolisa.pl', icon: <Shield size={20} /> },
          { id: 'emp-goldman', label: 'Goldman Sachs', icon: <TrendingUp size={20} /> },
          { id: 'emp-wellbeing', label: 'Wellbeing', icon: <Brain size={20} /> },
          { id: 'emp-poradniki', label: 'Poradniki', icon: <BookOpen size={20} /> },
          { id: 'emp-ebooki', label: 'E-booki', icon: <FileText size={20} /> },
          { id: 'emp-history', label: 'Historia', icon: <History size={20} /> },
          { id: 'emp-support', label: 'Centrum Pomocy', icon: <HelpCircle size={20} /> },
          { id: 'emp-active-services', label: 'Aktywne usługi', icon: <ShieldCheck size={20} /> },
        ];
      case Role.DIRECTOR:
      case Role.MANAGER:
      case Role.ADVISOR:
        return [
          { id: 'sales-dashboard', label: 'Panel Sprzedaży', icon: <DollarSign size={20} /> },
          { id: 'sales-commissions', label: 'Moje Prowizje', icon: <FileText size={20} /> },
        ];
      default:
        return [];
    }
  }, [currentUser.role]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 text-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col flex-shrink-0 overflow-hidden
        ${currentUser.role === Role.EMPLOYEE ? 'bg-black' : 'bg-white border-r border-slate-200'}
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'} 
        md:translate-x-0 md:sticky md:top-0 md:h-screen md:shadow-none
        ${isDesktopOpen ? 'md:w-72' : 'md:w-16'}
      `}>
        {/* Navigation */}
        <nav className={`flex-1 py-6 space-y-1 overflow-y-auto no-scrollbar overflow-x-hidden ${currentUser.role === Role.EMPLOYEE ? 'bg-black' : 'bg-white'}`}
          style={{ padding: isDesktopOpen ? undefined : '24px 0' }}
        >
          {isDesktopOpen && (
            <p className={`px-4 text-xs font-semibold uppercase tracking-wider mb-2 whitespace-nowrap ${currentUser.role === Role.EMPLOYEE ? 'text-slate-500' : 'text-slate-400'}`}>Menu Systemowe</p>
          )}
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onChangeView(item.id);
                onClose(); 
              }}
              title={!isDesktopOpen ? item.label : undefined}
              className={`w-full flex items-center py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                isDesktopOpen ? 'gap-3 px-4' : 'justify-center px-0'
              } ${
                currentUser.role === Role.EMPLOYEE
                  ? currentView === item.id ? 'text-white bg-slate-800 shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  : currentView === item.id ? 'text-slate-900 bg-slate-100 shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={`flex-shrink-0 ${
                currentUser.role === Role.EMPLOYEE
                  ? currentView === item.id ? 'text-emerald-400' : 'text-slate-500 group-hover:text-white'
                  : currentView === item.id ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-900'
              }`}>
                {item.icon}
              </span>
              {isDesktopOpen && <span className="whitespace-nowrap">{item.label}</span>}
              {isDesktopOpen && currentView === item.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        {/* Bottom / Collapse */}
        <div className={`border-t ${currentUser.role === Role.EMPLOYEE ? 'bg-black border-white/10' : 'bg-white border-slate-200'} ${isDesktopOpen ? 'p-4' : 'p-2'}`}>
          <button 
            onClick={() => {
              if (window.innerWidth >= 768) {
                if (onToggleDesktop) onToggleDesktop();
              } else {
                onClose();
              }
            }}
            className={`w-full flex items-center justify-center p-3 rounded-xl transition-colors group ${currentUser.role === Role.EMPLOYEE ? 'bg-slate-800/50 hover:bg-slate-700/60' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            {isDesktopOpen ? (
              <div className="flex items-center gap-3 w-full">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg flex-shrink-0 transition-colors ${currentUser.role === Role.EMPLOYEE ? 'bg-slate-700 text-slate-300 group-hover:text-white' : 'bg-slate-200 text-slate-500 group-hover:text-slate-900'}`}>
                  <ChevronLeft size={20}/>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-medium transition-colors whitespace-nowrap ${currentUser.role === Role.EMPLOYEE ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>Schowaj pasek</p>
                  <p className={`text-xs whitespace-nowrap ${currentUser.role === Role.EMPLOYEE ? 'text-slate-500' : 'text-slate-400'}`}>Zwiń menu boczne</p>
                </div>
              </div>
            ) : (
              <ChevronRight size={20} className={`transition-colors ${currentUser.role === Role.EMPLOYEE ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
            )}
          </button>
          {isDesktopOpen && (
            <div className="mt-3 text-center">
            <p className={`text-[10px] whitespace-nowrap ${currentUser.role === Role.EMPLOYEE ? 'text-slate-600' : 'text-slate-400'}`}>Wersja EBS 1.0.9 (Accounting UI)</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
