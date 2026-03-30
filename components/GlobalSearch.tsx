
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, User, FileText, Layout, ArrowRight, Command, X, CreditCard, LogOut, Shield, Building2, Briefcase, Calendar, ChevronRight, Wallet, BarChart3, Settings2 } from 'lucide-react';
import { useStrattonSystem } from '../context/StrattonContext';
import { User as UserType, Role, OrderStatus, VoucherStatus } from '../types';
import { canSeeSearchItem } from '../utils/permissions';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onInspectUser: (user: UserType) => void;
  onLogout: () => void;
}

type SearchCategory = 'MENU' | 'EMPLOYEES' | 'ORDERS' | 'COMPANIES' | 'ACTIONS';

interface SearchResult {
  id: string;
  category: SearchCategory;
  label: string;
  subLabel?: string;
  metaRight?: React.ReactNode; // Content on the right (e.g. Amount, Status Badge)
  icon: React.ReactNode;
  action: () => void;
  tags?: string[];
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onNavigate, onInspectUser, onLogout }) => {
  const { state } = useStrattonSystem();
  const { users, orders, companies, currentUser, vouchers } = state;

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --- SEARCH LOGIC (DETAILED & GROUPED) ---
  // Moved useMemo here so `results` is defined before any `useEffect` uses it.
  const results = useMemo<SearchResult[]>(() => {
    if (!currentUser || !isOpen) return [];
    
    const q = query.toLowerCase().trim();
    const list: SearchResult[] = [];

    // --- 1. NAVIGATION (MENU) ---
    const navItems = [
       // Admin
       { role: Role.SUPERADMIN, id: 'admin-dashboard', label: 'Centrum Dowodzenia', desc: 'Statystyki i przegląd', icon: <Shield size={18}/> },
       { role: Role.SUPERADMIN, id: 'admin-orders', label: 'Rejestr Zamówień', desc: 'Zatwierdzanie i płatności', icon: <FileText size={18}/> },
       { role: Role.SUPERADMIN, id: 'admin-buybacks', label: 'Odkupy Voucherów', desc: 'Proces zwrotu środków', icon: <Wallet size={18}/> },
       // HR
       { role: Role.HR, id: 'hr-dashboard', label: 'Pulpit HR', desc: 'Podsumowanie kadrowe', icon: <Layout size={18}/> },
       { role: Role.HR, id: 'hr-employees', label: 'Baza Pracowników', desc: 'Zarządzanie personelem', icon: <User size={18}/> },
       { role: Role.HR, id: 'hr-orders', label: 'Finanse', desc: 'Faktury i doładowania', icon: <CreditCard size={18}/> },
       { role: Role.HR, id: 'hr-reports', label: 'Raporty i Analizy', desc: 'Centrum danych', icon: <BarChart3 size={18}/> },
       { role: Role.HR, id: 'hr-integrations', label: 'Integracje', desc: 'Konfiguracja API', icon: <Settings2 size={18}/> },
       // Employee
       { role: Role.EMPLOYEE, id: 'emp-dashboard', label: 'Mój Portfel', desc: 'Saldo i usługi', icon: <Wallet size={18}/> },
       { role: Role.EMPLOYEE, id: 'emp-history', label: 'Historia', desc: 'Transakcje i umowy', icon: <Calendar size={18}/> },
       // Sales
       { role: Role.ADVISOR, id: 'sales-dashboard', label: 'Panel Sprzedaży', desc: 'Twoi klienci', icon: <Briefcase size={18}/> },
    ];

    navItems.forEach(item => {
        if (canSeeSearchItem(currentUser.role, item.role) && (q === '' || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))) {
            list.push({
                id: `NAV-${item.id}`,
                category: 'MENU',
                label: item.label,
                subLabel: item.desc,
                icon: item.icon,
                action: () => onNavigate(item.id)
            });
        }
    });

    // --- 2. EMPLOYEES (Detailed) ---
    if (q.length > 1) { // Only search users if typing
        const canSearchUsers = currentUser.role === Role.SUPERADMIN || currentUser.role === Role.HR;
        
        if (canSearchUsers) {
            users
                .filter(u => {
                    // RBAC Filter
                    if (currentUser.role === Role.HR && u.companyId !== currentUser.companyId) return false;
                    if (currentUser.role === Role.HR && u.role !== Role.EMPLOYEE) return false;
                    
                    // Search Match
                    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.pesel && u.pesel.includes(q));
                })
                .slice(0, 5) // Limit
                .forEach(u => {
                    const isActive = u.status === 'ACTIVE';
                    list.push({
                        id: `USER-${u.id}`,
                        category: 'EMPLOYEES',
                        label: u.name,
                        subLabel: `${u.email} • ${u.organization?.position || 'Pracownik'}`,
                        icon: <User size={18} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />,
                        metaRight: (
                            <div className="text-right">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {isActive ? 'Aktywny' : 'Zwolniony'}
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                    {u.voucherBalance} pkt
                                </div>
                            </div>
                        ),
                        action: () => {
                            if (currentUser.role === Role.SUPERADMIN) onInspectUser(u);
                            else onNavigate('hr-employees'); // HR just goes to table
                        }
                    });
                });
        }
    }

    // --- 3. ORDERS (Detailed) ---
    if (q.length > 1) {
        const canSeeOrders = currentUser.role === Role.SUPERADMIN || currentUser.role === Role.HR;
        
        if (canSeeOrders) {
            orders
                .filter(o => {
                    if (currentUser.role === Role.HR && o.companyId !== currentUser.companyId) return false;
                    return o.id.toLowerCase().includes(q) || o.companyId.toLowerCase().includes(q);
                })
                .slice(0, 3)
                .forEach(o => {
                    const statusColor = 
                        o.status === OrderStatus.PAID ? 'bg-emerald-100 text-emerald-700' :
                        o.status === OrderStatus.APPROVED ? 'bg-blue-100 text-blue-700' :
                        o.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                    
                    const statusLabel = 
                        o.status === OrderStatus.PAID ? 'Opłacone' :
                        o.status === OrderStatus.APPROVED ? 'Zatwierdzone' :
                        o.status === OrderStatus.REJECTED ? 'Odrzucone' : 'Oczekuje';

                    list.push({
                        id: `ORD-${o.id}`,
                        category: 'ORDERS',
                        label: `Zamówienie ${o.id}`,
                        subLabel: `${new Date(o.date).toLocaleDateString()} • ${companies.find(c => c.id === o.companyId)?.name || o.companyId}`,
                        icon: <FileText size={18} className="text-indigo-500"/>,
                        metaRight: (
                            <div className="text-right">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusColor}`}>
                                    {statusLabel}
                                </span>
                                <div className="text-xs font-bold text-slate-700 mt-0.5">
                                    {o.totalValue.toLocaleString('pl-PL')} PLN
                                </div>
                            </div>
                        ),
                        action: () => {
                            if(currentUser.role === Role.SUPERADMIN) onNavigate('admin-orders');
                            else onNavigate('hr-orders');
                        }
                    });
                });
        }
    }

    // --- 4. COMPANIES (Sales & Admin) ---
    if (q.length > 1 && (currentUser.role === Role.SUPERADMIN || [Role.ADVISOR, Role.MANAGER, Role.DIRECTOR].includes(currentUser.role))) {
        companies
            .filter(c => {
                if (currentUser.role !== Role.SUPERADMIN) {
                    return c.advisorId === currentUser.id || c.managerId === currentUser.id;
                }
                return true;
            })
            .filter(c => c.name.toLowerCase().includes(q) || c.nip.includes(q))
            .slice(0, 3)
            .forEach(c => {
                list.push({
                    id: `COMP-${c.id}`,
                    category: 'COMPANIES',
                    label: c.name,
                    subLabel: `NIP: ${c.nip}`,
                    icon: <Building2 size={18} className="text-slate-600"/>,
                    metaRight: (
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Saldo</span>
                            <div className="text-xs font-bold text-emerald-600">
                                {c.balanceActive} pkt
                            </div>
                        </div>
                    ),
                    action: () => {
                        // In a real app, navigate to company details
                        if (currentUser.role === Role.SUPERADMIN) onNavigate('admin-dashboard'); 
                    }
                });
            });
    }

    // --- 5. GLOBAL ACTIONS (Always available if query empty or matches) ---
    if (q === '' || 'wyloguj'.includes(q) || 'logout'.includes(q)) {
        list.push({
            id: 'ACT-LOGOUT',
            category: 'ACTIONS',
            label: 'Wyloguj się',
            subLabel: 'Zakończ bezpiecznie sesję',
            icon: <LogOut size={18} className="text-red-500"/>,
            action: onLogout
        });
    }

    return list;
  }, [query, isOpen, currentUser, users, orders, companies, onNavigate, onInspectUser, onLogout, vouchers]); // Added vouchers to dependency array

  // Auto-focus logic
  useEffect(() => {
    if (isOpen) {
      // Small delay ensures DOM is ready
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Key Listener for Navigation & ESC
  useEffect(() => {
      if (!isOpen) return;
      
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
          }
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex(prev => (prev + 1) % results.length); 
          } 
          if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(prev => (prev - 1 + results.length) % results.length); 
          } 
          if (e.key === 'Enter') {
              e.preventDefault();
              if (results[selectedIndex]) { 
                  results[selectedIndex].action();
                  onClose();
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, results]); // Added results to dependency array

  // Scroll into view logic
  useEffect(() => {
      if (listRef.current && results.length > 0) {
          const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
          if (selectedEl) {
              selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
      }
  }, [selectedIndex, results]);

  if (!isOpen) return null;

  // --- RENDERING HELPERS ---
  const renderGroupHeader = (title: string) => (
      <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80 sticky top-0 backdrop-blur-sm border-y border-slate-100">
          {title}
      </div>
  );

  let lastCategory: SearchCategory | null = null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 font-sans">
        {/* Backdrop */}
        <div 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
            onClick={onClose}
        />

        {/* Modal Window */}
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[70vh]">
            
            {/* Search Input Area */}
            <div className="flex items-center px-4 py-4 border-b border-slate-100 gap-3 bg-white">
                <Search size={22} className="text-slate-400" />
                <input 
                    ref={inputRef}
                    type="text" 
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                    placeholder="Szukaj w systemie (Pracownik, Zamówienie, Menu)..."
                    className="flex-1 bg-transparent text-lg text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    autoComplete="off"
                />
                <button 
                    onClick={onClose}
                    className="hidden md:flex items-center justify-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-500 transition"
                >
                    <span className="text-[10px]">ESC</span>
                </button>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" ref={listRef}>
                {results.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="bg-slate-50 p-4 rounded-full inline-block mb-3">
                            <Search size={32} className="text-slate-300"/>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Brak wyników dla "{query}"</p>
                        <p className="text-slate-400 text-xs mt-1">Spróbuj wpisać ID zamówienia, nazwisko lub nazwę widoku.</p>
                    </div>
                ) : (
                    <div className="pb-2">
                        {results.map((item, idx) => {
                            const showHeader = item.category !== lastCategory;
                            lastCategory = item.category;
                            const isSelected = idx === selectedIndex;

                            return (
                                <React.Fragment key={item.id}>
                                    {showHeader && renderGroupHeader(
                                        item.category === 'MENU' ? 'Nawigacja' : 
                                        item.category === 'EMPLOYEES' ? 'Pracownicy' :
                                        item.category === 'ORDERS' ? 'Dokumenty i Zamówienia' :
                                        item.category === 'COMPANIES' ? 'Baza Firm' : 'Akcje'
                                    )}
                                    
                                    <button
                                        data-index={idx}
                                        onClick={() => { item.action(); onClose(); }}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors relative border-l-4 ${
                                            isSelected 
                                            ? 'bg-indigo-50/50 border-indigo-500' 
                                            : 'bg-white border-transparent hover:bg-slate-50'
                                        }`}
                                    >
                                        {/* Icon Box */}
                                        <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                                            isSelected ? 'bg-white shadow-sm text-indigo-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {item.icon}
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                    {item.label}
                                                </span>
                                                {item.id.startsWith('NAV') && isSelected && (
                                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Idź</span>
                                                )}
                                            </div>
                                            {item.subLabel && (
                                                <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-indigo-600/70' : 'text-slate-400'}`}>
                                                    {item.subLabel}
                                                </p>
                                            )}
                                        </div>

                                        {/* Right Meta (Badges/Values) */}
                                        {item.metaRight && (
                                            <div className="flex-shrink-0 pl-2">
                                                {item.metaRight}
                                            </div>
                                        )}

                                        {/* Selection Arrow */}
                                        {isSelected && !item.metaRight && (
                                            <ArrowRight size={18} className="text-indigo-400 animate-in slide-in-from-left-2 fade-in duration-200" />
                                        )}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Hints */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center font-medium">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1"><span className="bg-white border border-slate-300 rounded px-1">↑↓</span> nawigacja</span>
                    <span className="flex items-center gap-1"><span className="bg-white border border-slate-300 rounded px-1">↵</span> wybierz</span>
                </div>
                <div className="flex items-center gap-1 opacity-70">
                    <Command size={10} /> <span>+ K</span>
                </div>
            </div>
        </div>
    </div>
  );
};
