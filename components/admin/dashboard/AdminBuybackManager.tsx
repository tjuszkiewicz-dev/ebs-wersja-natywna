
import React, { useState, useMemo } from 'react';
import { Eye, CheckSquare, Square, Building2, Calendar, Folder, ChevronRight, ChevronDown, RefreshCw, FolderOpen, FileText, CreditCard, CheckCircle } from 'lucide-react';
import { BuybackAgreement, User, Company } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { Badge } from '../../ui/Badge';
import { UserInspectionModal } from '../modals/UserInspectionModal';
import { PaymentConfirmationModal } from '../modals/PaymentConfirmationModal'; 
import { BankExportModal } from '../modals/BankExportModal'; 
import { BuybackStatsFilter } from './BuybackStatsFilter';
import { Tabs } from '../../ui/Tabs';

interface AdminBuybackManagerProps {
  buybacks: BuybackAgreement[];
  users: User[];
  companies?: Company[];
  onSimulateExpiration: () => void;
  onApproveBuyback: (id: string) => void;
  onMarkPaid?: (id: string, details?: any) => void; 
  onViewDocument: (type: 'BUYBACK_AGREEMENT', data: any) => void;
}

// Archive Types
type ArchiveLevel = 'ROOT' | 'COMPANY' | 'YEAR' | 'MONTH';
interface ArchiveNode {
    id: string;
    label: string;
    level: ArchiveLevel;
    children?: ArchiveNode[];
    items?: BuybackAgreement[];
    count?: number;
}

export const AdminBuybackManager: React.FC<AdminBuybackManagerProps> = ({
  buybacks,
  users,
  companies = [],
  onSimulateExpiration,
  onApproveBuyback,
  onMarkPaid,
  onViewDocument
}) => {
  // --- TABS ---
  const [activeView, setActiveView] = useState<'PROCESS' | 'ARCHIVE'>('PROCESS');

  // --- PROCESS STATE ---
  const [inspectingUserId, setInspectingUserId] = useState<string | null>(null);
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<BuybackAgreement | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PAID'>('PENDING'); 
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- ARCHIVE STATE ---
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // --- DERIVED STATE ---
  const inspectingUser = useMemo(() => users.find(u => u.id === inspectingUserId) || null, [users, inspectingUserId]);

  // --- FILTER LOGIC (PROCESS) ---
  const filteredBuybacks = useMemo(() => {
      return buybacks.filter(b => {
          if (statusFilter === 'PENDING' && b.status !== 'PENDING_APPROVAL') return false;
          if (statusFilter === 'APPROVED' && b.status !== 'APPROVED') return false;
          if (statusFilter === 'PAID' && b.status !== 'PAID') return false;

          if (companyFilter !== 'ALL') {
              const user = users.find(u => u.id === b.userId);
              if (user?.companyId !== companyFilter) return false;
          }
          return true;
      });
  }, [buybacks, statusFilter, companyFilter, users]);

  const preparedData = useMemo(() => {
      return filteredBuybacks.map(b => {
          const user = users.find(u => u.id === b.userId);
          const snapshotIban = b.snapshot?.user.iban;
          const currentIban = user?.finance?.payoutAccount?.iban;
          const hasIbanConflict = snapshotIban && currentIban && snapshotIban !== currentIban;

          return {
              ...b,
              searchableName: user ? user.name : (b.snapshot?.user.name || 'Unknown'),
              searchableEmail: user ? user.email : (b.snapshot?.user.email || ''),
              searchableIban: b.snapshot?.user.iban || user?.finance?.payoutAccount?.iban || '',
              hasIbanConflict,
              currentLiveIban: currentIban
          };
      });
  }, [filteredBuybacks, users]);

  // --- ARCHIVE TREE BUILDER ---
  const archiveTree = useMemo(() => {
      const paidBuybacks = buybacks.filter(b => b.status === 'PAID');
      const tree: ArchiveNode[] = [];

      // Group by Company
      const companyMap: Record<string, BuybackAgreement[]> = {};
      paidBuybacks.forEach(b => {
          const user = users.find(u => u.id === b.userId);
          const companyId = user?.companyId || 'UNKNOWN';
          if (!companyMap[companyId]) companyMap[companyId] = [];
          companyMap[companyId].push(b);
      });

      Object.entries(companyMap).forEach(([compId, items]) => {
          const company = companies.find(c => c.id === compId);
          const compNode: ArchiveNode = {
              id: compId,
              label: company ? company.name : 'Nieznana Firma',
              level: 'COMPANY',
              children: [],
              count: items.length
          };

          // Group by Year
          const yearMap: Record<string, BuybackAgreement[]> = {};
          items.forEach(b => {
              const year = new Date(b.dateGenerated).getFullYear().toString();
              if (!yearMap[year]) yearMap[year] = [];
              yearMap[year].push(b);
          });

          Object.entries(yearMap).forEach(([year, yearItems]) => {
              const yearNode: ArchiveNode = {
                  id: `${compId}-${year}`,
                  label: year,
                  level: 'YEAR',
                  children: [],
                  count: yearItems.length
              };

              // Group by Month
              const monthMap: Record<string, BuybackAgreement[]> = {};
              yearItems.forEach(b => {
                  const month = new Date(b.dateGenerated).toLocaleString('pl-PL', { month: 'long' });
                  if (!monthMap[month]) monthMap[month] = [];
                  monthMap[month].push(b);
              });

              Object.entries(monthMap).forEach(([month, monthItems]) => {
                  yearNode.children?.push({
                      id: `${compId}-${year}-${month}`,
                      label: month,
                      level: 'MONTH',
                      items: monthItems,
                      count: monthItems.length
                  });
              });

              compNode.children?.push(yearNode);
          });

          tree.push(compNode);
      });

      return tree;
  }, [buybacks, users, companies]);

  // --- ACTIONS ---
  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredBuybacks.length && filteredBuybacks.length > 0) {
          setSelectedIds(new Set());
      } else {
          const allIds = new Set(filteredBuybacks.map(b => b.id));
          setSelectedIds(allIds);
      }
  };

  const handleBulkAction = async () => {
      if (selectedIds.size === 0) return;
      setIsProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      if (statusFilter === 'PENDING') {
          selectedIds.forEach(id => onApproveBuyback(id));
          setSelectedIds(new Set());
      } else if (statusFilter === 'APPROVED' && onMarkPaid) {
          selectedIds.forEach(id => onMarkPaid(id));
          setSelectedIds(new Set());
      }
      setIsProcessing(false);
  };

  const toggleNode = (nodeId: string) => {
      const newSet = new Set(expandedNodes);
      if (newSet.has(nodeId)) newSet.delete(nodeId);
      else newSet.add(nodeId);
      setExpandedNodes(newSet);
  };

  const handleAutoApproveSafe = () => {
      // Logic: Approve all pending requests < 500 PLN
      const safeToApprove = buybacks.filter(b => b.status === 'PENDING_APPROVAL' && b.totalValue < 500);
      if (confirm(`Automatycznie zatwierdź ${safeToApprove.length} wniosków poniżej 500 PLN?`)) {
          safeToApprove.forEach(b => onApproveBuyback(b.id));
      }
  };

  // --- PROCESS VIEW COLUMNS ---
  const columns: Column<typeof preparedData[0]>[] = [
    {
        header: '', 
        className: 'w-[50px] text-center align-middle',
        cell: (bb) => {
            const isSelected = selectedIds.has(bb.id);
            const isDisabled = statusFilter === 'PAID';
            if (statusFilter === 'PAID') return null;
            return (
                <div className="flex justify-center">
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleSelection(bb.id); }}
                        disabled={isDisabled}
                        className={`p-1 rounded transition ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer'}`}
                    >
                        {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-slate-300" />}
                    </button>
                </div>
            );
        }
    },
    {
        header: 'Ref / Data',
        accessorKey: 'dateGenerated',
        sortable: true,
        className: 'w-[120px]',
        cell: (bb) => (
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 tabular-nums">{new Date(bb.dateGenerated).toLocaleDateString()}</span>
                <span className="font-mono text-[9px] text-slate-500 font-bold">{bb.id.split('-').pop()}</span>
            </div>
        )
    },
    {
        header: 'Beneficjent',
        accessorKey: 'userId',
        sortable: true,
        cell: (bb) => {
            const company = companies.find(c => c.id === users.find(u => u.id === bb.userId)?.companyId);
            return (
                <div className="group cursor-pointer flex items-center gap-3 py-1" onClick={() => { setInspectingUserId(bb.userId); setSelectedAgreementId(bb.id); }}>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex flex-shrink-0 items-center justify-center text-slate-500 font-bold text-xs border border-slate-200 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                        {bb.searchableName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-sm block truncate group-hover:text-indigo-700 transition-colors">
                            {bb.searchableName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            {company && <Building2 size={10} className="text-slate-400"/>}
                            <span className="truncate">{company ? company.name : 'Brak Firmy'}</span>
                        </div>
                    </div>
                </div>
            );
        }
    },
    {
        header: 'Status IBAN',
        className: 'w-[160px]',
        cell: (bb) => {
            if (bb.hasIbanConflict) return <Badge variant="warning">Zmiana Konta</Badge>;
            if (bb.searchableIban) return <Badge variant="success">OK</Badge>;
            return <Badge variant="error">Brak Danych</Badge>;
        }
    },
    {
        header: 'Kwota',
        accessorKey: 'totalValue',
        sortable: true,
        className: 'w-[120px] text-right',
        cell: (bb) => <span className="font-bold text-slate-800">{bb.totalValue.toFixed(2)} PLN</span>
    },
    {
        header: 'Akcja',
        className: 'w-[100px] text-right',
        cell: (bb) => (
            <div className="flex justify-end gap-1">
                {statusFilter === 'APPROVED' && onMarkPaid && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setPaymentModalData(bb); }}
                        className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm transition"
                        title="Potwierdź Przelew"
                    >
                        <CreditCard size={16}/>
                    </button>
                )}
                <button onClick={() => onViewDocument('BUYBACK_AGREEMENT', bb)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition"><Eye size={16}/></button>
            </div>
        )
    }
  ];

  // --- RENDERERS ---

  const renderMobileCard = (bb: typeof preparedData[0]) => {
      const isSelected = selectedIds.has(bb.id);
      return (
          <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                      {statusFilter !== 'PAID' && (
                          <button 
                              onClick={(e) => { e.stopPropagation(); toggleSelection(bb.id); }}
                              className="p-1 -ml-2"
                          >
                              {isSelected ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} className="text-slate-300" />}
                          </button>
                      )}
                      <div>
                          <span className="font-bold text-slate-800 text-sm block">{bb.searchableName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{bb.id.split('-').pop()}</span>
                      </div>
                  </div>
                  <span className="font-bold text-slate-900">{bb.totalValue.toFixed(2)} PLN</span>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{new Date(bb.dateGenerated).toLocaleDateString()}</span>
                  {bb.hasIbanConflict ? <Badge variant="warning">Zmiana IBAN</Badge> : bb.searchableIban ? <Badge variant="success">IBAN OK</Badge> : <Badge variant="error">Brak IBAN</Badge>}
              </div>

              <div className="flex gap-2 mt-1">
                  <button 
                      onClick={() => { setInspectingUserId(bb.userId); setSelectedAgreementId(bb.id); }}
                      className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                  >
                      Szczegóły
                  </button>
                  <button 
                      onClick={() => onViewDocument('BUYBACK_AGREEMENT', bb)}
                      className="py-2 px-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg"
                  >
                      <Eye size={16}/>
                  </button>
              </div>
          </div>
      );
  };

  const renderArchiveNode = (node: ArchiveNode) => {
      const isExpanded = expandedNodes.has(node.id);
      
      return (
          <div key={node.id} className="ml-4">
              <div 
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-slate-50 transition ${isExpanded ? 'text-indigo-700' : 'text-slate-700'}`}
                  onClick={() => toggleNode(node.id)}
              >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {node.level === 'COMPANY' && <Building2 size={16} className="text-slate-400"/>}
                  {node.level === 'YEAR' && <Calendar size={16} className="text-slate-400"/>}
                  {node.level === 'MONTH' && <Folder size={16} className="text-amber-400 fill-amber-100"/>}
                  
                  <span className="text-sm font-medium">{node.label}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded-full ml-auto">{node.count}</span>
              </div>

              {isExpanded && (
                  <div className="border-l border-slate-200 ml-3">
                      {node.children?.map(renderArchiveNode)}
                      {node.items && (
                          <div className="ml-6 space-y-1 mt-1">
                              {node.items.map(item => {
                                  const user = users.find(u => u.id === item.userId);
                                  return (
                                      <div key={item.id} className="flex justify-between items-center p-2 bg-white border border-slate-100 rounded hover:border-indigo-200 text-sm group">
                                          <div className="flex items-center gap-2">
                                              <FileText size={14} className="text-slate-400"/>
                                              <span className="text-slate-700">{user?.name || 'Nieznany'}</span>
                                              <span className="text-[10px] text-slate-400 font-mono">{item.id}</span>
                                          </div>
                                          <div className="flex items-center gap-4">
                                              <span className="font-bold text-slate-800 text-xs">{item.totalValue} PLN</span>
                                              <button 
                                                  onClick={() => onViewDocument('BUYBACK_AGREEMENT', item)}
                                                  className="text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                              >
                                                  <Eye size={14}/>
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="relative pb-24">
        
        {/* TOP TABS */}
        <div className="mb-6">
            <Tabs 
                activeTab={activeView}
                onChange={(id) => setActiveView(id as 'PROCESS' | 'ARCHIVE')}
                items={[
                    { id: 'PROCESS', label: 'Procesowanie (Active)', icon: <RefreshCw size={16}/> },
                    { id: 'ARCHIVE', label: 'Archiwum (Teczki)', icon: <FolderOpen size={16}/> }
                ]}
            />
        </div>

        {activeView === 'PROCESS' ? (
            <>
                <BuybackStatsFilter 
                    currentFilter={statusFilter}
                    onFilterChange={(s) => { setStatusFilter(s); setSelectedIds(new Set()); }}
                    selectedCompanyId={companyFilter}
                    onCompanyChange={setCompanyFilter}
                    companies={companies}
                    filteredData={filteredBuybacks}
                    allBuybacks={buybacks}
                />

                <DataTable 
                    data={preparedData}
                    columns={columns}
                    mobileRenderer={renderMobileCard}
                    title={statusFilter === 'PENDING' ? "Akceptacja" : statusFilter === 'APPROVED' ? "Wypłaty" : "Archiwum"}
                    subtitle="Zarządzanie procesem odkupu"
                    searchPlaceholder="Szukaj..."
                    searchableFields={['searchableName', 'searchableEmail', 'id']}
                    headerActions={
                        <div className="flex gap-2">
                            {statusFilter === 'PENDING' && (
                                <button onClick={handleAutoApproveSafe} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1">
                                    <CheckCircle size={14} className="hidden sm:block"/> Auto-Zatwierdź {"<"}500 PLN
                                </button>
                            )}
                            {statusFilter !== 'PAID' && <button onClick={toggleSelectAll} className="px-3 py-2 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600">Zaznacz Wszystkie</button>}
                            <button onClick={onSimulateExpiration} className="px-3 py-2 bg-amber-100 text-amber-800 rounded text-xs font-bold hover:bg-amber-200 transition">Symulacja</button>
                        </div>
                    }
                />

                {selectedIds.size > 0 && statusFilter !== 'PAID' && (
                    <div className="fixed bottom-20 md:bottom-6 left-1/2 transform -translate-x-1/2 w-[92%] md:w-[90%] max-w-2xl bg-slate-900 text-white p-3 md:p-4 rounded-xl shadow-2xl flex flex-col md:flex-row justify-between items-center z-[100] gap-3 md:gap-0 animate-in slide-in-from-bottom-4">
                        <div className="flex flex-col md:flex-row items-center gap-1 md:gap-4 text-center md:text-left">
                            <span className="font-bold text-sm">{selectedIds.size} zaznaczonych</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            {statusFilter === 'APPROVED' && (
                                <button 
                                    onClick={() => setIsExportModalOpen(true)}
                                    className="flex-1 md:flex-none px-4 py-2.5 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center justify-center gap-2 transition"
                                >
                                    <FileText size={14}/> Przelewy
                                </button>
                            )}
                            <button 
                                onClick={handleBulkAction} 
                                className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20"
                            >
                                {statusFilter === 'PENDING' ? 'Zatwierdź Wybrane' : 'Zaksięguj Wybrane'}
                            </button>
                        </div>
                    </div>
                )}
            </>
        ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[500px]">
                <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                    <FolderOpen size={20} className="text-amber-500"/> Struktura Teczek
                </h3>
                {archiveTree.length === 0 ? (
                    <p className="text-slate-400 text-sm">Brak zarchiwizowanych odkupów.</p>
                ) : (
                    <div className="space-y-1">
                        {archiveTree.map(renderArchiveNode)}
                    </div>
                )}
            </div>
        )}

        {/* MODALS */}
        {inspectingUser && (
            <UserInspectionModal 
                isOpen={!!inspectingUser}
                onClose={() => { setInspectingUserId(null); setSelectedAgreementId(undefined); }}
                user={inspectingUser}
                company={companies.find(c => c.id === inspectingUser.companyId)}
                userBuybackHistory={buybacks.filter(b => b.userId === inspectingUser.id)}
                currentAgreementId={selectedAgreementId}
                onApproveCurrent={onApproveBuyback}
            />
        )}

        {paymentModalData && (
            <PaymentConfirmationModal 
                isOpen={!!paymentModalData}
                onClose={() => setPaymentModalData(null)}
                buyback={paymentModalData}
                user={users.find(u => u.id === paymentModalData.userId)}
                onConfirm={(id, det) => { if(onMarkPaid) onMarkPaid(id, det); }}
            />
        )}

        <BankExportModal 
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            selectedBuybacks={buybacks.filter(b => selectedIds.has(b.id))}
            users={users}
        />
    </div>
  );
};
