
import React from 'react';
import { Role, User } from '../types';
import { LayoutDashboard, Users, FileText, Wallet, ShieldCheck, DollarSign, X, ChevronRight, LogOut, BarChart3, Settings2, FolderOpen, HelpCircle, Grid } from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  currentView: string;
  onChangeView: (view: string) => void;
  isOpen: boolean; // Mobile state
  onClose: () => void; // Mobile close handler
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
  isDesktopOpen,
  onSwitchUser,
  isLogout = false
}) => {
  
  const getRoleLabel = (role: Role) => {
    switch(role) {
      case Role.SUPERADMIN: return 'Administrator';
      case Role.HR: return 'Księgowość / HR';
      case Role.EMPLOYEE: return 'Pracownik';
      default: return 'Partner / Sprzedaż';
    }
  };

  const getMenuItems = () => {
    switch (currentUser.role) {
      case Role.SUPERADMIN:
        return [
          { id: 'admin-dashboard', label: 'Centrum Dowodzenia', icon: <ShieldCheck size={20} /> },
          { id: 'admin-orders', label: 'Weryfikacja Zamówień', icon: <FileText size={20} /> },
          { id: 'admin-buybacks', label: 'Umowy Odkupu', icon: <Wallet size={20} /> },
        ];
      case Role.HR:
        return [
          { id: 'hr-dashboard', label: 'Pulpit Główny', icon: <LayoutDashboard size={20} /> },
          { id: 'hr-employees', label: 'Kartoteki Pracownicze', icon: <Users size={20} /> },
          { id: 'hr-orders', label: 'Rozliczenia i Faktury', icon: <FileText size={20} /> },
          { id: 'hr-reports', label: 'Raporty i JPK', icon: <BarChart3 size={20} /> },
          { id: 'hr-documents', label: 'Dokumenty (Teczka)', icon: <FolderOpen size={20} /> },
          { id: 'hr-integrations', label: 'Integracje (Księgowe)', icon: <Settings2 size={20} /> },
        ];
      case Role.EMPLOYEE:
        return [
          { id: 'emp-dashboard', label: 'Pulpit', icon: <Wallet size={20} /> },
          { id: 'emp-catalog', label: 'Zamknięty Katalog Usług', icon: <Grid size={20} /> },
          { id: 'emp-history', label: 'Historia', icon: <FileText size={20} /> },
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
  };

  const menuItems = getMenuItems();

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
        fixed inset-y-0 left-0 z-50 bg-slate-900 text-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col flex-shrink-0 overflow-hidden
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'} 
        md:translate-x-0 md:static md:shadow-none
        ${isDesktopOpen ? 'md:w-72' : 'md:w-0'}
      `}>
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/30 whitespace-nowrap min-w-[18rem]">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-emerald-400">ELITON BENEFITS</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">System (EBS)</p>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white transition p-1">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar whitespace-nowrap min-w-[18rem]">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu Systemowe</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onChangeView(item.id);
                onClose(); 
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                currentView === item.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {currentView === item.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        {/* User Profile / Logout (Bottom Sticky) */}
        <div className="p-4 bg-slate-950/30 border-t border-slate-800 whitespace-nowrap min-w-[18rem]">
          <button 
            onClick={onSwitchUser}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors group text-left relative overflow-hidden ${
                isLogout ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg flex-shrink-0 ${
                 isLogout ? 'bg-red-500/20 text-red-400' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
             }`}>
                {isLogout ? <LogOut size={18}/> : currentUser.name.charAt(0)}
             </div>
             
             <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isLogout ? 'text-red-400' : 'text-white'}`}>
                    {isLogout ? 'Wyloguj się' : currentUser.name}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLogout ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
                  <span className="truncate">{getRoleLabel(currentUser.role)}</span>
                </div>
             </div>
          </button>
          
          <div className="mt-3 text-center">
            <p className="text-[10px] text-slate-600">Wersja EBS 1.0.9 (Accounting UI)</p>
          </div>
        </div>
      </aside>
    </>
  );
};
