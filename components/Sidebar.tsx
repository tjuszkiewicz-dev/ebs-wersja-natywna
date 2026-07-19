
import React, { useMemo, useState, useEffect } from 'react';
import { Role, User } from '../types';
import { PERMISSION_MENU } from '../lib/permissions/registry';
import { LayoutDashboard, Users, FileText, ShieldCheck, DollarSign, ChevronRight, HelpCircle, Grid, CreditCard, Plus, ChevronLeft, Smartphone, HeartPulse, Shield, TrendingUp, Brain, BookOpen, History, Ticket, RefreshCw, UserCog, Calculator, KanbanSquare, UserRound, Trophy, Network, Mail, CalendarDays, Languages, Car, MapPin, FolderOpen } from 'lucide-react';

// Ikony dla dynamicznego menu budowanego z uprawnień (PERMISSION_MENU w registry) — 1:1 z BBS
const MENU_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={20} />, usercog: <UserCog size={20} />, book: <BookOpen size={20} />,
  users: <Users size={20} />, card: <CreditCard size={20} />, folder: <FolderOpen size={20} />,
  ticket: <Ticket size={20} />, refresh: <RefreshCw size={20} />, kanban: <KanbanSquare size={20} />,
  mail: <Mail size={20} />, calculator: <Calculator size={20} />, user: <UserRound size={20} />,
  trophy: <Trophy size={20} />, network: <Network size={20} />,
  file: <FileText size={20} />, history: <History size={20} />, calendar: <CalendarDays size={20} />,
  languages: <Languages size={20} />, car: <Car size={20} />, mappin: <MapPin size={20} />,
};

// Role z własnym, statycznym menu — reszta (koordynator, płatnik, role własne) dostaje menu z uprawnień
const STATIC_MENU_ROLES = new Set([Role.SUPERADMIN, Role.HR, Role.HR_PANEL, Role.EMPLOYEE, Role.ADVISOR, Role.MANAGER, Role.DIRECTOR]);

function buildPermissionMenu(perms: string[]): any[] {
  const set = new Set(perms);
  const items: any[] = [];
  let lastSection = '';
  for (const m of PERMISSION_MENU) {
    if (!m.anyOf.some(p => set.has(p))) continue;
    if (m.section !== lastSection) {
      items.push({ id: `div-${m.section}`, label: `── ${m.section} ──`, icon: null, divider: true, section: m.section });
      lastSection = m.section;
    }
    items.push({ id: m.view, label: m.label, icon: MENU_ICONS[m.icon] ?? <Grid size={20} /> });
  }
  return items;
}

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
  hiddenViews?: string[]; // moduły ukryte danej roli (admin_view_config — pozycje sidebara)
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
  isLogout = false,
  hiddenViews = [],
}) => {

  // Etykieta roli z definicji w app_roles (role własne, np. „Szef koordynatorów")
  const [dbRoleLabel, setDbRoleLabel] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    if (dbRoleLabel) return dbRoleLabel;
    switch(currentUser.role) {
      case Role.SUPERADMIN:  return 'Administrator';
      case Role.HR:          return 'Księgowość / HR';
      case Role.HR_PANEL:    return 'Panel HR';
      case Role.EMPLOYEE:    return 'Pracownik';
      case Role.COORDINATOR: return 'Koordynator';
      case Role.PAYROLL:     return 'Płatnik';
      case Role.TEMP_WORKER: return 'Pracownik Tymczasowy';
      case Role.DIRECTOR:
      case Role.MANAGER:
      case Role.ADVISOR:     return 'Partner / Sprzedaż';
      default:               return 'Panel';
    }
  }, [currentUser.role, dbRoleLabel]);

  // Dynamiczne menu z uprawnień (koordynator, płatnik + role własne z panelu Uprawnienia)
  const [permKeys, setPermKeys] = useState<string[]>([]);
  const needsDynamic = !STATIC_MENU_ROLES.has(currentUser.role as Role);
  useEffect(() => {
    if (!needsDynamic) return;
    fetch('/api/me/permissions', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { permissions: [] }))
      .then(d => { setPermKeys(d.permissions || []); if (d.role_label) setDbRoleLabel(d.role_label); })
      .catch(() => {});
  }, [needsDynamic]);

  const menuItems = useMemo(() => {
    switch (currentUser.role) {
      case Role.HR_PANEL:
      case Role.HR:
        return [
          { id: 'hr-order',     label: 'Nowe zamówienie',       icon: <Plus size={20} /> },
          { id: 'hr-history',   label: 'Historia zamówień',     icon: <FileText size={20} /> },
          { id: 'hr-employees', label: 'Kartoteka pracowników', icon: <Users size={20} /> },
          { id: 'hr-payments',  label: 'Płatności i faktury',   icon: <CreditCard size={20} /> },
        ];
      case Role.SUPERADMIN: {
        // Układ 1:1 z BBS; treść = widoki EBS (CRM wykluczony — osobny CRM Stratton Prime)
        const superMenu: any[] = [
          { id: 'admin-pulpit',      label: 'Pulpit',              icon: <LayoutDashboard size={20} /> },
          { id: 'admin-ksiegowosc',  label: 'Księgowość',          icon: <BookOpen size={20} /> },
          { id: 'admin-uprawnienia', label: 'Uprawnienia',         icon: <ShieldCheck size={20} /> },
          { id: 'admin-szablony',    label: 'Szablony dokumentów', icon: <FileText size={20} /> },
          { id: 'admin-logi',        label: 'Rejestr zdarzeń',     icon: <History size={20} /> },
          { id: 'benefity-divider',  label: '── Benefity ──', icon: null, divider: true, section: 'Benefity' },
          { id: 'admin-klienci',   label: 'Baza klientów',       icon: <Users size={20} /> },
          { id: 'admin-platnosci', label: 'Płatności i faktury', icon: <CreditCard size={20} /> },
          { id: 'admin-archiwum',  label: 'Archiwum',            icon: <FolderOpen size={20} /> },
          { id: 'admin-vouchery',  label: 'Vouchery',                icon: <Ticket size={20} /> },
          { id: 'admin-buyback',   label: 'Anulowanie subskrypcji', icon: <RefreshCw size={20} /> },
          { id: 'hr-divider',     label: '── Agencja Pracy ──', icon: null, divider: true, section: 'Agencja Pracy' },
          { id: 'hr-pracownicy',  label: 'Pracownicy',      icon: <Users size={20} /> },
          { id: 'hr-mapa',        label: 'Mapa Pracowników', icon: <MapPin size={20} /> },
          { id: 'hr-flota',       label: 'Flota',           icon: <Car size={20} /> },
          { id: 'hr-generator',   label: 'Generator dokumentów', icon: <FileText size={20} /> },
          { id: 'hr-tlumacz',     label: 'Tłumacz',              icon: <Languages size={20} /> },
        ];
        // filtr „Widoku" (hiddenViews) stosowany jednolicie niżej dla wszystkich ról
        return superMenu;
      }
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
        // Bez sekcji CRM (wykluczony w EBS) — panel sprzedaży + prowizje
        return [
          { id: 'sales-dashboard',   label: 'Panel Sprzedaży', icon: <DollarSign size={20} /> },
          { id: 'sales-commissions', label: 'Moje Prowizje',   icon: <FileText size={20} /> },
        ];
      default:
        // koordynator, płatnik + role własne — menu budowane z uprawnień (panel Uprawnienia)
        return buildPermissionMenu(permKeys);
    }
  }, [currentUser.role, permKeys, hiddenViews]);

  // „Widok" roli: ukrywanie modułów per rola (admin_view_config). Puste dywidery odpadają.
  const visibleMenu = useMemo(() => {
    if (!hiddenViews.length) return menuItems;
    const kept = menuItems.filter((it: any) => it.divider || !hiddenViews.includes(it.id));
    return kept.filter((it: any, i: number) => !it.divider || kept.slice(i + 1).some((n: any) => !n.divider));
  }, [menuItems, hiddenViews]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container — układ/styl 1:1 z BBS, brand EBS (czerń + zieleń jak launcher) */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 text-white transition-all duration-300 ease-in-out flex flex-col flex-shrink-0 overflow-hidden
        border-r border-white/5
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:sticky md:top-0 md:h-screen
        ${isDesktopOpen ? 'w-72' : 'w-16 md:w-16'}
      `}
        style={{
          background:
            'radial-gradient(700px 320px at 10% -5%, rgba(48,223,106,.13), transparent 60%),' +
            'linear-gradient(185deg, #050807 0%, #0a1410 55%, #0d1f16 100%)',
        }}
      >
        {/* Brand */}
        <div className={`flex items-center gap-3 border-b border-white/8 ${isDesktopOpen ? 'px-5 h-16' : 'justify-center h-16 px-0'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ebs-black.svg" alt="" className="h-8 w-auto flex-shrink-0" style={{ filter: 'brightness(0) invert(1)' }} />
          {isDesktopOpen && (
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-tight text-white truncate">Eliton Benefits</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-300">{roleLabel}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          className={`flex-1 overflow-y-auto no-scrollbar overflow-x-hidden ${isDesktopOpen ? 'px-3 py-3 space-y-0.5' : 'px-2 py-3 space-y-0.5'}`}
        >
          {isDesktopOpen && !(visibleMenu[0] as { divider?: boolean } | undefined)?.divider && (
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 whitespace-nowrap">Menu systemowe</p>
          )}
          {visibleMenu.map((item) => {
            // Divider rendering
            if ((item as { divider?: boolean }).divider) {
              const sectionLabel = (item as { section?: string }).section ?? '';
              return isDesktopOpen ? (
                <div key={item.id} className="px-3 pt-3 pb-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{sectionLabel}</p>
                </div>
              ) : (
                <div key={item.id} className="my-2 mx-2 h-px bg-white/10" />
              );
            }
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeView(item.id);
                  onClose();
                }}
                title={!isDesktopOpen ? item.label : undefined}
                className={`relative w-full flex items-center py-2 text-sm font-medium rounded-xl transition-all duration-200 group ${
                  isDesktopOpen ? 'gap-3 px-3' : 'justify-center px-0'
                } ${
                  active
                    ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06)]'
                    : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {/* lewy wskaźnik aktywności (zieleń EBS) */}
                {active && isDesktopOpen && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary-300" />
                )}
                <span className={`flex-shrink-0 transition-colors ${active ? 'text-primary-300' : 'text-white/45 group-hover:text-primary-300'}`}>
                  {item.icon}
                </span>
                {isDesktopOpen && <span className="whitespace-nowrap">{item.label}</span>}
                {isDesktopOpen && active && <ChevronRight size={15} className="ml-auto text-white/40" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom / Collapse */}
        <div className={`border-t border-white/8 ${isDesktopOpen ? 'p-3' : 'p-2'}`}>
          <button
            onClick={() => {
              if (window.innerWidth >= 768) {
                if (onToggleDesktop) onToggleDesktop();
              } else {
                onClose();
              }
            }}
            className="w-full flex items-center justify-center p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] transition-colors group"
          >
            {isDesktopOpen ? (
              <div className="flex items-center gap-3 w-full">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/10 text-white/70 group-hover:text-white transition-colors">
                  <ChevronLeft size={18}/>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors whitespace-nowrap">Schowaj pasek</p>
                  <p className="text-[11px] text-white/40 whitespace-nowrap">Zwiń menu boczne</p>
                </div>
              </div>
            ) : (
              <ChevronRight size={18} className="text-white/50 group-hover:text-white transition-colors" />
            )}
          </button>
          {isDesktopOpen && (
            <p className="mt-3 text-center text-[10px] text-white/30 whitespace-nowrap">Wersja EBS 1.1.0</p>
          )}
        </div>
      </aside>
    </>
  );
};
