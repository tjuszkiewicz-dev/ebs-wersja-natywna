
import React, { useState, useEffect, useMemo } from 'react';
import { Company, Order, User, Voucher, ImportRow, ImportHistoryEntry, OrderStatus, PayrollEntry, VoucherStatus } from '../types';
import { LayoutDashboard, Users, FileText, FolderOpen, HelpCircle, AlertTriangle, CheckCircle2, Clock, Calendar, Download, BarChart3, Settings2, UserPlus, UserCheck, CreditCard, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmployeeImportModal } from '../components/hr/EmployeeImportModal';
import { EmployeeEditModal } from '../components/hr/modals/EmployeeEditModal'; 
import { DistributionEvidenceModal } from '../components/hr/modals/DistributionEvidenceModal'; 
import { DistributionModal } from '../components/hr/modals/DistributionModal'; 
import { BulkTransferModal } from '../components/hr/modals/BulkTransferModal'; 
import { DistributionChoiceModal } from '../components/hr/modals/DistributionChoiceModal'; 
import { PayrollModal } from '../components/hr/PayrollModal'; // Ensure PayrollModal is imported

// Komponenty procesowe
import { HRCommandCenter } from '../components/hr/dashboard/HRCommandCenter';
import { HRSettlementWizard } from '../components/hr/dashboard/HRSettlementWizard';
import { HRDocumentBinder } from '../components/hr/dashboard/HRDocumentBinder';
import { HREmployeeTable } from '../components/hr/dashboard/HREmployeeTable';
import { EmployeeHistoryModal } from '../components/hr/modals/EmployeeHistoryModal';
import { HRProcessTimeline, ProcessStep } from '../components/hr/dashboard/HRProcessTimeline';
import { HREmployeeGuide } from '../components/hr/dashboard/HREmployeeGuide'; 

// Moduły Enterprise
import { HRReportCenter } from '../components/hr/reports/HRReportCenter';
import { HRIntegrationsManager } from '../components/hr/integrations/HRIntegrationsManager';

import { useStrattonSystem } from '../context/StrattonContext'; 
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { usePersistedState } from '../hooks/usePersistedState';

// Declare global XLSX object
declare const XLSX: any;

interface Props {
  currentView: string; 
  onViewChange: (view: string) => void; // New prop for syncing
  company: Company;
  employees: User[];
  orders: Order[];
  vouchers: Voucher[];
  importHistory?: ImportHistoryEntry[];
  onPlaceOrder: (amount: number, distributionPlan?: PayrollEntry[]) => void;
  onDistribute: (employeeId: string, amount: number) => void;
  onPayOrder: (orderId: string) => void;
  onDeactivateEmployee: (employeeId: string) => void;
  onViewProforma: (type: 'DEBIT_NOTE' | 'VAT_INVOICE', order: Order) => void;
  onBulkImport?: (validRows: ImportRow[]) => Promise<any>;
  onParsePayroll: (file: File) => Promise<PayrollEntry[]>;
  onExportPayrollTemplate: (users: User[]) => void;
}

// URZĘDOWA STRUKTURA MENU
type HRTab = 'START' | 'EMPLOYEES' | 'SETTLEMENTS' | 'REPORTS' | 'INTEGRATIONS' | 'DOCUMENTS' | 'HELP';

export const DashboardHR: React.FC<Props> = ({ 
  currentView,
  onViewChange,
  company, 
  employees, 
  orders, 
  vouchers,
  importHistory = [],
  onPlaceOrder,
  onDeactivateEmployee,
  onViewProforma,
  onBulkImport,
  onParsePayroll,
  onExportPayrollTemplate
}) => {
  const { actions, state } = useStrattonSystem(); 
  const { distributionBatches, systemConfig } = state; // Get systemConfig

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<HRTab>('START');
  
  // Kontekst Czasowy
  const [currentPeriod, setCurrentPeriod] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // QUALITY GATE
  const [isListVerified, setIsListVerified] = useState(false);

  // Reset verification on period change
  useEffect(() => {
      setIsListVerified(false);
  }, [currentPeriod]);

  // Modale
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  
  // Distribution Modals & Choice
  const [isDistributionChoiceOpen, setIsDistributionChoiceOpen] = useState(false);
  const [singleDistModalOpen, setSingleDistModalOpen] = useState(false);
  const [bulkDistModalOpen, setBulkDistModalOpen] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Guide State - Persisted
  const [showEmployeeGuide, setShowEmployeeGuide] = usePersistedState<boolean>('ebs_guide_hr_employees_v1', true);

  // --- LOGIKA: Obliczanie Puli Rezerwacyjnej (Trust) i Aktywnej ---
  const reservedPool = useMemo(() => {
      return vouchers.filter(v => v.companyId === company.id && v.status === VoucherStatus.RESERVED).length;
  }, [vouchers, company.id]);

  const activePool = useMemo(() => {
      return vouchers.filter(v => v.companyId === company.id && v.status === VoucherStatus.ACTIVE).length;
  }, [vouchers, company.id]);

  // --- INTELLIGENT WORKFLOW LOGIC (FIXED) ---
  const workflowStep = useMemo<ProcessStep>(() => {
      const monthlyOrders = orders.filter(o => o.date.startsWith(currentPeriod) && o.status !== OrderStatus.REJECTED);
      
      // 1. Brak zamówień w tym miesiącu -> Idź do Kadr
      if (monthlyOrders.length === 0) {
          if (employees.length === 0) return 'EMPLOYEES';
          if (!isListVerified) return 'EMPLOYEES';
          return 'ORDER';
      }

      const activeOrder = monthlyOrders[monthlyOrders.length - 1]; // Bierzemy najnowsze
      
      // 2. Zamówienie w toku (PENDING -> PENDING_APPROVAL step)
      if (activeOrder.status === OrderStatus.PENDING) return 'PENDING_APPROVAL';
      
      // 3. Zatwierdzone (Trust Model / Oczekuje na płatność)
      if (activeOrder.status === OrderStatus.APPROVED) {
          // Jeśli są środki w rezerwacji, sugeruj dystrybucję, ale też przypominaj o płatności
          if (reservedPool > 0) return 'DISTRIBUTION';
          return 'PAYMENT';
      }
      
      // 4. Opłacone (PAID) - Sprawdzamy czy rozdano vouchery
      if (activeOrder.status === OrderStatus.PAID) {
          // Jeśli firma ma nierozdane środki (Active Pool > 0), to sugerujemy dystrybucję
          // FIX: Priorytet dla NOWEGO cyklu (Top-Up) jeśli HR zweryfikował listę
          if (isListVerified) {
              return 'ORDER';
          }

          if (activePool > 0) {
              return 'DISTRIBUTION';
          }
          
          // Jeśli wszystko rozdane i lista nieweryfikowana -> Cykl Zamknięty
          return 'COMPLETE';
      }
      
      return 'COMPLETE';
  }, [orders, employees, currentPeriod, company.balanceActive, reservedPool, activePool, isListVerified]);

  // --- LOGIKA BIZNESOWA: STATUS MIESIĄCA (Priority Fixed) ---
  const monthlyOrders = orders.filter(o => o.date.startsWith(currentPeriod));
  const hasUnpaidInvoice = monthlyOrders.some(o => o.status === OrderStatus.APPROVED);
  const isPending = monthlyOrders.some(o => o.status === OrderStatus.PENDING);
  const hasPaidInvoice = monthlyOrders.some(o => o.status === OrderStatus.PAID);
  
  const systemStatus = useMemo(() => {
      // Priority 1: Unpaid Invoice (Most Urgent)
      if (hasUnpaidInvoice) return { label: 'DO OPŁACENIA', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: <CreditCard size={16}/> };
      
      // Priority 2: Pending Approval (Active Process)
      if (isPending) return { label: 'WERYFIKACJA', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock size={16}/> };
      
      // Priority 3: Creating New Order (Drafting)
      if (workflowStep === 'ORDER') return { label: 'TWORZENIE', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <FileText size={16}/> };

      // Priority 4: All Paid (Settled)
      if (hasPaidInvoice) return { label: 'ROZLICZONY', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 size={16}/> };
      
      // Default
      return { label: 'OCZEKUJE', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <AlertTriangle size={16}/> };
  }, [hasUnpaidInvoice, isPending, hasPaidInvoice, workflowStep, monthlyOrders.length]);

  // --- SYNC SIDEBAR (INCOMING) ---
  useEffect(() => {
      if (currentView === 'hr-employees') setActiveTab('EMPLOYEES');
      else if (currentView === 'hr-orders') setActiveTab('SETTLEMENTS');
      else if (currentView === 'hr-reports') setActiveTab('REPORTS');
      else if (currentView === 'hr-integrations') setActiveTab('INTEGRATIONS');
      else if (currentView === 'hr-documents') setActiveTab('DOCUMENTS');
      else setActiveTab('START');
  }, [currentView]);

  // --- HANDLERS FOR NAVIGATION SYNC (OUTGOING) ---
  
  const handleTabChange = (tabId: HRTab) => {
      setActiveTab(tabId);
      
      // Reverse Mapping: Tab -> View ID
      switch(tabId) {
          case 'START': onViewChange('hr-dashboard'); break;
          case 'EMPLOYEES': onViewChange('hr-employees'); break;
          case 'SETTLEMENTS': onViewChange('hr-orders'); break;
          case 'REPORTS': onViewChange('hr-reports'); break;
          case 'INTEGRATIONS': onViewChange('hr-integrations'); break;
          case 'DOCUMENTS': onViewChange('hr-documents'); break;
          case 'HELP': break; // No sidebar item for help, keep local
      }
  };

  const handleTimelineNavigate = (step: ProcessStep) => {
      switch(step) {
          case 'EMPLOYEES': handleTabChange('EMPLOYEES'); break;
          case 'ORDER': 
          case 'PENDING_APPROVAL':
          case 'PAYMENT': handleTabChange('SETTLEMENTS'); break;
          case 'DISTRIBUTION': handleTabChange('START'); break; 
          default: handleTabChange('START');
      }
  };

  const handleOpenEmployee = (user: User) => {
      setSelectedEmployee(user);
      setEditModalOpen(true);
  };

  const handleVerifyList = () => {
      setIsListVerified(true);
      // Jeśli już byliśmy w COMPLETE, to teraz workflowStep zmieni się na ORDER
      // Przekierujmy użytkownika od razu do Rozliczeń, aby mógł złożyć nowe zamówienie
      handleTabChange('SETTLEMENTS'); 
  };

  // Helper for Period Navigation
  const changePeriod = (delta: number) => {
      const d = new Date(currentPeriod);
      d.setMonth(d.getMonth() + delta);
      setCurrentPeriod(d.toISOString().slice(0, 7));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-6 relative">
       
       {/* 1. GŁÓWNY NAGŁÓWEK STRONY (Page Header) */}
       <div className="bg-white border-b border-slate-200 pt-6 px-4 md:px-8 shadow-sm">
           <div className="max-w-7xl mx-auto">
               
               {/* Top Row: Title, Period Selector, Actions */}
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                   
                   {/* Left: Branding & Period */}
                   <div>
                       <div className="flex items-center gap-3 mb-1">
                           <h1 className="text-2xl font-bold text-slate-800">Panel Kadrowy</h1>
                           <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${systemStatus.color}`}>
                               {systemStatus.label}
                           </span>
                       </div>
                       
                       <div className="flex items-center gap-2 group">
                           <button 
                                onClick={() => changePeriod(-1)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                           >
                               <ChevronLeft size={16} />
                           </button>
                           
                           <div className="flex items-center gap-2 text-slate-500 font-medium text-sm border-b border-dashed border-slate-300 pb-0.5 cursor-pointer hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                               <Calendar size={14} />
                               <span className="capitalize">
                                   {new Date(currentPeriod).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                               </span>
                           </div>

                           <button 
                                onClick={() => changePeriod(1)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                           >
                               <ChevronRight size={16} />
                           </button>
                       </div>
                   </div>

                   {/* Right: Primary Actions */}
                   <div className="flex gap-2 w-full md:w-auto">
                       <Button 
                           variant="outline" 
                           size="sm"
                           onClick={() => handleTabChange('REPORTS')}
                           icon={<Download size={16}/>}
                           className="w-full md:w-auto"
                       >
                           Raport
                       </Button>
                       {workflowStep === 'ORDER' && activeTab !== 'SETTLEMENTS' && (
                           <Button 
                               variant="primary"
                               size="sm"
                               onClick={() => handleTabChange('SETTLEMENTS')}
                               icon={<ArrowRight size={16}/>}
                               className="w-full md:w-auto"
                           >
                               Nowe Zamówienie
                           </Button>
                       )}
                   </div>
               </div>

               {/* Bottom Row: Tabs */}
               <div className="flex overflow-x-auto no-scrollbar gap-1 -mb-px">
                   {[
                        { id: 'START', label: 'Pulpit', icon: <LayoutDashboard size={16}/> },
                        { id: 'EMPLOYEES', label: 'Pracownicy', icon: <Users size={16}/> },
                        { id: 'SETTLEMENTS', label: 'Rozliczenia', icon: <FileText size={16}/> },
                        { id: 'REPORTS', label: 'Raporty', icon: <BarChart3 size={16}/> },
                        { id: 'INTEGRATIONS', label: 'Integracje', icon: <Settings2 size={16}/> },
                        { id: 'DOCUMENTS', label: 'Teczka', icon: <FolderOpen size={16}/> },
                        { id: 'HELP', label: 'Pomoc', icon: <HelpCircle size={16}/> },
                   ].map(tab => (
                       <button
                           key={tab.id}
                           onClick={() => handleTabChange(tab.id as HRTab)}
                           className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                               activeTab === tab.id
                               ? 'border-indigo-600 text-indigo-700 bg-indigo-50/10'
                               : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                           }`}
                       >
                           {tab.icon}
                           {tab.label}
                       </button>
                   ))}
               </div>
           </div>
       </div>

       {/* 2. OBSZAR ROBOCZY */}
       <div className="max-w-7xl mx-auto px-3 md:px-8 mt-6">
           
           {/* Global Process Timeline (Visible on important tabs) */}
           {['START', 'SETTLEMENTS'].includes(activeTab) && (
               <HRProcessTimeline currentStep={workflowStep} onNavigate={handleTimelineNavigate} />
           )}

           {activeTab === 'START' && (
               <HRCommandCenter 
                   company={company}
                   employees={employees}
                   orders={orders}
                   vouchers={vouchers}
                   period={currentPeriod}
                   onNavigateToSettlement={() => handleTabChange('SETTLEMENTS')}
                   onNavigateToEmployees={() => handleTabChange('EMPLOYEES')}
                   workflowStep={workflowStep} 
                   onOpenDistributionChoice={() => setIsDistributionChoiceOpen(true)} 
                   onOpenSingleDist={() => {
                       setSelectedEmployee(null); 
                       setSingleDistModalOpen(true);
                   }}
                   onOpenBulkDist={() => setBulkDistModalOpen(true)}
               />
           )}

           {activeTab === 'EMPLOYEES' && (
               <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                   {/* ... verified list logic ... */}
                   {!isListVerified && employees.length > 0 && (
                       <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5 mb-4 md:mb-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                           <div className="flex items-start gap-4">
                               <div className="bg-amber-100 p-2 md:p-3 rounded-full text-amber-600 shrink-0">
                                   <UserCheck size={24} className="md:w-7 md:h-7"/>
                               </div>
                               <div>
                                   <h3 className="text-base md:text-lg font-bold text-amber-900">Weryfikacja Kadr</h3>
                                   <p className="text-xs md:text-sm text-amber-800 mt-1">
                                       Potwierdź aktualność listy pracowników przed kolejnym zamówieniem.
                                   </p>
                               </div>
                           </div>
                           <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="w-full md:w-auto px-4 py-2.5 bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 whitespace-nowrap transition text-sm"
                                >
                                    <UserPlus size={16}/> Brakuje kogoś? Dodaj
                                </button>
                                <button 
                                    onClick={handleVerifyList}
                                    className="w-full md:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 whitespace-nowrap transition text-sm"
                                >
                                    <CheckCircle2 size={16}/> Lista Aktualna
                                </button>
                           </div>
                       </div>
                   )}

                   {(showEmployeeGuide || employees.length === 0) && (
                       <HREmployeeGuide onClose={() => setShowEmployeeGuide(false)} />
                   )}

                   <div className="flex flex-row justify-between items-center mb-4 gap-4">
                       <div>
                           <h2 className="text-lg font-bold text-slate-800">Kartoteka</h2>
                           <p className="text-xs text-slate-500 hidden md:block">Pracownicy w firmie {company.name}.</p>
                       </div>
                       <Button 
                           variant="success" 
                           onClick={() => setIsImportModalOpen(true)}
                           icon={<UserPlus size={16}/>}
                           size="sm"
                           className="whitespace-nowrap"
                       >
                           Dodaj Osobę
                       </Button>
                   </div>
                   
                   <HREmployeeTable 
                       employees={employees}
                       onOpenHistory={(u) => { setSelectedEmployee(u); setHistoryModalOpen(true); }}
                       onTopUp={(id) => {
                           const emp = employees.find(e => e.id === id);
                           if(emp) {
                               setSelectedEmployee(emp);
                               setSingleDistModalOpen(true); 
                           }
                       }}
                       onEdit={handleOpenEmployee}
                       onDeactivate={(user) => onDeactivateEmployee(user.id)}
                       onExportTemplate={onExportPayrollTemplate}
                   />
               </div>
           )}

           {activeTab === 'SETTLEMENTS' && (
               <HRSettlementWizard 
                   orders={orders}
                   employees={employees}
                   vouchers={vouchers} 
                   company={company} // Pass company to Wizard
                   onPlaceOrder={onPlaceOrder}
                   onParsePayroll={onParsePayroll}
                   onViewDocument={onViewProforma}
                   onViewEvidence={(order) => {
                       setSelectedOrder(order);
                       setEvidenceModalOpen(true);
                   }}
                   onExportTemplate={onExportPayrollTemplate}
                   onDistributeSingle={(o) => { setSelectedEmployee(null); setSingleDistModalOpen(true); }}
                   onDistributeBulk={(o) => setBulkDistModalOpen(true)}
               />
           )}

           {activeTab === 'REPORTS' && (
               <HRReportCenter 
                   company={company}
                   employees={employees}
                   orders={orders}
                   vouchers={vouchers}
               />
           )}

           {activeTab === 'INTEGRATIONS' && (
               <HRIntegrationsManager />
           )}

           {activeTab === 'DOCUMENTS' && (
               <HRDocumentBinder 
                   orders={orders}
                   importHistory={importHistory}
                   company={company}
                   hrUser={employees.find(e => e.role === 'HR')}
                   onViewDocument={onViewProforma}
                   onViewEvidence={(order) => { 
                       setSelectedOrder(order);
                       setEvidenceModalOpen(true);
                   }}
                   distributionBatches={distributionBatches}
                   templates={systemConfig.templates}
                   vouchers={vouchers} // NEW PROP
                   employees={employees} // NEW PROP
               />
           )}

           {activeTab === 'HELP' && (
               <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                   <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Wsparcie</h2>
                   <p className="text-sm text-slate-500">Skontaktuj się z opiekunem.</p>
               </div>
           )}

       </div>

       {/* --- MODALE --- */}

       <EmployeeImportModal 
           isOpen={isImportModalOpen}
           onClose={() => setIsImportModalOpen(false)}
           onConfirm={onBulkImport || (async () => {})}
           existingUsers={employees}
           onExportTemplate={onExportPayrollTemplate}
       />

       {editModalOpen && selectedEmployee && (
           <EmployeeEditModal 
               isOpen={editModalOpen}
               onClose={() => setEditModalOpen(false)}
               user={selectedEmployee}
               onSave={(id, data) => actions.handleUpdateEmployee(id, data)}
           />
       )}

       {historyModalOpen && selectedEmployee && (
           <EmployeeHistoryModal 
               isOpen={historyModalOpen}
               onClose={() => setHistoryModalOpen(false)}
               user={selectedEmployee}
               historyMonth={currentPeriod}
               onMonthChange={setCurrentPeriod}
               historyVouchers={vouchers.filter(v => v.ownerId === selectedEmployee.id)}
           />
       )}

       {evidenceModalOpen && selectedOrder && (
           <DistributionEvidenceModal 
               isOpen={evidenceModalOpen}
               onClose={() => setEvidenceModalOpen(false)}
               order={selectedOrder}
               vouchers={vouchers.filter(v => v.orderId === selectedOrder.id)}
               employees={employees}
           />
       )}

       {/* DISTRIBUTION MODALS */}
       
       <DistributionChoiceModal 
           isOpen={isDistributionChoiceOpen}
           onClose={() => setIsDistributionChoiceOpen(false)}
           onChooseSingle={() => {
               setSelectedEmployee(null); 
               setSingleDistModalOpen(true);
           }}
           onChooseBulk={() => setBulkDistModalOpen(true)}
       />

       <DistributionModal 
           isOpen={singleDistModalOpen}
           onClose={() => {
               setSingleDistModalOpen(false);
               setSelectedEmployee(null); 
           }}
           activeEmployees={employees.filter(e => e.status === 'ACTIVE')}
           initialEmployeeId={selectedEmployee?.id} 
           activePool={activePool} // Pass Active Pool
           reservedPool={reservedPool} 
           onConfirm={(id, amt) => actions.handleDistribute(id, amt)}
       />

       <BulkTransferModal 
           isOpen={bulkDistModalOpen}
           onClose={() => setBulkDistModalOpen(false)}
           activeEmployees={employees.filter(e => e.status === 'ACTIVE')}
           onConfirm={actions.handleBulkDistribute}
       />

    </div>
  );
};
