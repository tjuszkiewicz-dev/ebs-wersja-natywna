
import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, ChevronLeft, User as UserIcon, Wallet, History, Edit, Ban, Phone, Mail, MoreHorizontal, X, Shield, Filter } from 'lucide-react';
import { User, UserStatus } from '../../../types';
import { MaskedData } from '../../ui/MaskedData';

interface HREmployeeTableProps {
  employees: User[];
  onOpenHistory: (user: User) => void;
  onTopUp: (userId: string) => void;
  onDeactivate: (user: User) => void;
  onEdit: (user: User) => void; 
  onExportTemplate: (users: User[]) => void;
}

export const HREmployeeTable: React.FC<HREmployeeTableProps> = ({ 
  employees, 
  onOpenHistory, 
  onTopUp, 
  onDeactivate,
  onEdit, 
  onExportTemplate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15; 

  // Mobile Action Sheet State
  const [mobileSelectedUser, setMobileSelectedUser] = useState<User | null>(null);

  // --- DERIVED DATA ---
  
  const filteredEmployees = useMemo(() => {
      return employees.filter(emp => {
          const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (emp.organization?.costCenter && emp.organization.costCenter.toLowerCase().includes(searchTerm.toLowerCase())); // Search by MPK
          
          let matchesStatus = true;
          if (filterStatus !== 'ALL') {
              matchesStatus = emp.status === filterStatus || (filterStatus === 'ACTIVE' && emp.status === undefined); 
          }
          
          return matchesSearch && matchesStatus;
      });
  }, [employees, searchTerm, filterStatus]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  React.useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  // --- RENDERERS ---

  const renderPagination = () => {
      if (totalPages <= 1) return null;
      return (
          <div className="flex justify-between items-center pt-6 border-t border-slate-200 mt-auto px-4 md:px-0 pb-20 md:pb-0">
              <span className="text-sm text-slate-600 font-medium">
                  Strona {currentPage} z {totalPages}
              </span>
              <div className="flex gap-2">
                  <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-slate-700 font-medium bg-white"
                  >
                      <ChevronLeft size={18} /> <span className="hidden md:inline">Poprzednia</span>
                  </button>
                  <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-slate-700 font-medium bg-white"
                  >
                      <span className="hidden md:inline">Następna</span> <ChevronRight size={18} />
                  </button>
              </div>
          </div>
      );
  };

  // --- DESKTOP ROW RENDERER ---
  const renderDesktopRow = (user: User) => {
      const isActive = user.status === 'ACTIVE';
      const isNotice = (user.status as any) === 'NOTICE_PERIOD';
      const isInactive = user.status === 'INACTIVE' || user.status === 'ANONYMIZED';
      const mpk = user.organization?.costCenter;

      return (
          <div key={user.id} className={`group flex items-center p-4 border-b border-slate-100 hover:bg-slate-50 transition text-sm ${isInactive ? 'opacity-60 bg-slate-50' : ''}`}>
              <div className="flex items-center w-[30%] gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${isActive ? 'bg-indigo-500' : isNotice ? 'bg-amber-500' : 'bg-slate-300'}`}>
                      {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                      <span className="font-bold text-slate-800 block text-base truncate">{user.name}</span>
                      <span className="text-xs text-slate-500 truncate block">{user.email}</span>
                  </div>
              </div>
              <div className="w-[25%] flex flex-col justify-center">
                  <span className="text-slate-700 font-medium truncate text-sm">
                      {user.organization?.department || user.department || '-'}
                  </span>
                  <div className="flex gap-2 mt-1">
                      {mpk && (
                          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono" title="MPK / Cost Center">
                              MPK: {mpk}
                          </span>
                      )}
                  </div>
              </div>
              <div className="w-[15%] flex items-center gap-2">
                  <div className="font-mono font-bold text-slate-700 text-base">
                      <MaskedData value={user.voucherBalance} type="MONEY" visible={false} />
                  </div>
                  {isNotice && <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">WYPOW.</span>}
              </div>
              <div className="w-[30%] flex justify-end gap-2">
                  {isActive && (
                      <button onClick={() => onTopUp(user.id)} className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition font-bold text-xs border border-emerald-200">
                          Zasil
                      </button>
                  )}
                  <button onClick={() => onEdit(user)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-bold text-xs">
                      Edytuj
                  </button>
                  <button onClick={() => onOpenHistory(user)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-bold text-xs">
                      Historia
                  </button>
              </div>
          </div>
      );
  };

  // --- MOBILE ROW RENDERER (CONTACT LIST STYLE) ---
  const renderMobileRow = (user: User) => {
      const isActive = user.status === 'ACTIVE';
      const isNotice = (user.status as any) === 'NOTICE_PERIOD';
      const isInactive = user.status === 'INACTIVE' || user.status === 'ANONYMIZED';

      return (
          <div 
            key={user.id} 
            onClick={() => setMobileSelectedUser(user)}
            className={`flex items-center justify-between p-4 border-b border-slate-100 active:bg-slate-50 transition-colors cursor-pointer select-none ${isInactive ? 'opacity-60 bg-slate-50/50' : 'bg-white'}`}
          >
              <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0 shadow-sm ${isActive ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' : isNotice ? 'bg-amber-500' : 'bg-slate-300'}`}>
                      {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex flex-col justify-center gap-0.5">
                      <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-base truncate">{user.name}</span>
                          {isNotice && <div className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"></div>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                          {user.organization?.position || user.position || 'Pracownik'} 
                      </p>
                      {/* Department Chip */}
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 w-fit truncate max-w-[150px]">
                          {user.organization?.department || user.department}
                      </span>
                  </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0 pl-2">
                  <div className="text-right">
                      <span className="block font-mono font-bold text-slate-900 text-base">{user.voucherBalance}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">PLN</span>
                  </div>
                  <ChevronRight size={20} className="text-slate-300"/>
              </div>
          </div>
      );
  };

  return (
    <>
        {/* 1. CONTROLS HEADER (Sticky on Mobile) */}
        <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-16 md:static z-20 -mx-4 md:mx-0 px-4 py-3 md:p-5 md:rounded-2xl md:shadow-sm md:border md:mb-6 transition-all">
            <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                {/* Search Box */}
                <div className="w-full md:flex-1 relative group">
                    <Search size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Szukaj (Nazwisko, Email, MPK)..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 md:bg-slate-50 border border-transparent md:border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>

                {/* Mobile Filter Toggle (Simple Tabs) */}
                <div className="flex w-full md:w-auto bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button 
                        onClick={() => setFilterStatus('ACTIVE')}
                        className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterStatus === 'ACTIVE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                    >
                        Aktywni
                    </button>
                    <button 
                        onClick={() => setFilterStatus('ALL')}
                        className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterStatus === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                    >
                        Wszyscy
                    </button>
                </div>
            </div>
        </div>

        {/* 2. TABLE CONTENT */}
        <div className="bg-white md:rounded-xl md:shadow-sm md:border border-slate-200 overflow-hidden min-h-[400px]">
            {/* Desktop Headers */}
            <div className="hidden md:flex bg-slate-50 border-b border-slate-200 p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="w-[30%]">Pracownik</div>
                <div className="w-[25%]">Dział / MPK</div>
                <div className="w-[15%]">Saldo</div>
                <div className="w-[30%] text-right">Akcje</div>
            </div>

            {/* Content Body */}
            <div>
                {filteredEmployees.length > 0 ? (
                    <>
                        {/* Desktop View */}
                        <div className="hidden md:block">
                            {paginatedEmployees.map(renderDesktopRow)}
                        </div>
                        {/* Mobile View */}
                        <div className="md:hidden">
                            {paginatedEmployees.map(renderMobileRow)}
                        </div>
                    </>
                ) : (
                    <div className="p-12 text-center text-slate-400">
                        <UserIcon size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">Brak pracowników spełniających kryteria.</p>
                        <button onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); }} className="text-indigo-600 text-xs font-bold mt-2 hover:underline">
                            Wyczyść filtry
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Pagination */}
        {renderPagination()}

        {/* 3. MOBILE ACTION SHEET (Bottom Sheet) */}
        {mobileSelectedUser && (
            <div className="fixed inset-0 z-[100] md:hidden flex flex-col justify-end">
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in"
                    onClick={() => setMobileSelectedUser(null)}
                ></div>
                
                {/* Sheet */}
                <div className="bg-white w-full rounded-t-2xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-full duration-300 pb-safe">
                    {/* Drag Handle */}
                    <div className="flex justify-center pt-3 pb-1" onClick={() => setMobileSelectedUser(null)}>
                        <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
                    </div>

                    {/* User Summary Header */}
                    <div className="p-6 text-center border-b border-slate-100">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg text-indigo-600 text-2xl font-bold">
                            {mobileSelectedUser.name.charAt(0)}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{mobileSelectedUser.name}</h3>
                        <p className="text-sm text-slate-500 mb-4">{mobileSelectedUser.organization?.position || 'Pracownik'}</p>
                        
                        <div className="inline-flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                            <span className="text-xs text-slate-500 font-bold uppercase">Saldo</span>
                            <span className="text-lg font-mono font-bold text-emerald-600">{mobileSelectedUser.voucherBalance} PLN</span>
                        </div>
                    </div>

                    {/* Actions Grid */}
                    <div className="p-5 space-y-3">
                        {/* Primary Action */}
                        <button 
                            onClick={() => { onTopUp(mobileSelectedUser.id); setMobileSelectedUser(null); }}
                            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 text-base active:scale-95 transition-transform"
                        >
                            <Wallet size={20} /> Zasil Konto
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => { onEdit(mobileSelectedUser); setMobileSelectedUser(null); }}
                                className="py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-transform"
                            >
                                <Edit size={18} /> Edytuj
                            </button>
                            <button 
                                onClick={() => { onOpenHistory(mobileSelectedUser); setMobileSelectedUser(null); }}
                                className="py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-transform"
                            >
                                <History size={18} /> Historia
                            </button>
                        </div>

                        {/* Additional Info / Actions */}
                        <div className="pt-2">
                            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-2 border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-slate-400"/> {mobileSelectedUser.email}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Shield size={14} className="text-slate-400"/> {mobileSelectedUser.pesel ? `PESEL: ${mobileSelectedUser.pesel}` : 'Brak PESEL'}
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <button 
                            onClick={() => { onDeactivate(mobileSelectedUser); setMobileSelectedUser(null); }}
                            className="w-full py-3 text-red-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            <Ban size={16} /> {mobileSelectedUser.status === 'ACTIVE' ? 'Dezaktywuj konto' : 'Aktywuj konto'}
                        </button>
                    </div>

                    {/* Close Button */}
                    <div className="p-4 pt-0">
                        <button 
                            onClick={() => setMobileSelectedUser(null)}
                            className="w-full py-3 text-slate-400 font-bold text-sm"
                        >
                            Anuluj
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};
