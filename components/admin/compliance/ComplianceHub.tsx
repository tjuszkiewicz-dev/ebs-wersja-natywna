
import React, { useState, useMemo } from 'react';
import { Shield, Search, Lock, UserX, AlertTriangle, FileText, CheckCircle, Clock } from 'lucide-react';
import { User, AuditLogEntry, UserStatus } from '../../../types';
import { DataTable, Column } from '../../ui/DataTable';
import { Badge } from '../../ui/Badge';

interface ComplianceHubProps {
  users: User[];
  logs: AuditLogEntry[];
  onAnonymizeUser: (userId: string) => void;
}

type ComplianceTab = 'SEARCH' | 'LOGS' | 'ANONYMIZATION' | 'CONSENTS';

export const ComplianceHub: React.FC<ComplianceHubProps> = ({ users, logs, onAnonymizeUser }) => {
  const [activeTab, setActiveTab] = useState<ComplianceTab>('SEARCH');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- TAB 1: SENSITIVE DATA SEARCH ---
  const foundUsers = useMemo(() => {
      if (!searchTerm || searchTerm.length < 3) return [];
      const lower = searchTerm.toLowerCase();
      return users.filter(u => 
          (u.pesel && u.pesel.includes(lower)) ||
          (u.email && u.email.toLowerCase().includes(lower)) ||
          (u.finance?.payoutAccount?.iban && u.finance.payoutAccount.iban.includes(lower))
      );
  }, [users, searchTerm]);

  // --- TAB 2: ACCESS LOGS ---
  const accessLogs = useMemo(() => {
      // Filter logs related to sensitive data access or modifications
      return logs.filter(l => 
          l.action.includes('USER') || 
          l.action.includes('IBAN') || 
          l.action.includes('IMPORT') ||
          l.action.includes('ANONYMIZED')
      );
  }, [logs]);

  // --- HANDLERS ---
  const handleConfirmAnonymize = (u: User) => {
      const confirmMsg = `CZY NA PEWNO chcesz trwale usunąć dane osobowe użytkownika ${u.name}? 
      
TEJ OPERACJI NIE MOŻNA COFNĄĆ!
Historia finansowa zostanie zachowana jako anonimowa.`;
      
      if (window.confirm(confirmMsg)) {
          // Second safety check
          if (window.prompt(`Wpisz "RODO" aby potwierdzić anonimizację użytkownika: ${u.email}`) === 'RODO') {
              onAnonymizeUser(u.id);
          }
      }
  };

  // --- RENDERERS ---

  const renderSearch = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Search size={20} className="text-indigo-600"/> Wyszukiwarka Danych Wrażliwych
              </h3>
              <div className="relative">
                  <input 
                      type="text" 
                      placeholder="Wpisz PESEL, Email lub fragment IBAN..." 
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
                  <Search size={18} className="absolute left-3 top-3.5 text-slate-400"/>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                  Narzędzie dla Inspektora Danych (DPO) do lokalizacji rekordów w bazie.
              </p>
          </div>

          {searchTerm.length >= 3 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm">
                      Wyniki wyszukiwania ({foundUsers.length})
                  </div>
                  {foundUsers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">Brak wyników.</div>
                  ) : (
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-100 text-slate-500">
                              <tr>
                                  <th className="p-3">Użytkownik</th>
                                  <th className="p-3">PESEL</th>
                                  <th className="p-3">IBAN (Końcówka)</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3 text-right">Akcja</th>
                              </tr>
                          </thead>
                          <tbody>
                              {foundUsers.map(u => (
                                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                                      <td className="p-3">
                                          <div className="font-bold text-slate-800">{u.name}</div>
                                          <div className="text-xs text-slate-500">{u.email}</div>
                                      </td>
                                      <td className="p-3 font-mono">{u.pesel || '-'}</td>
                                      <td className="p-3 font-mono">
                                          {u.finance?.payoutAccount?.iban ? `...${u.finance.payoutAccount.iban.slice(-4)}` : '-'}
                                      </td>
                                      <td className="p-3">
                                          {u.status === 'ACTIVE' ? <Badge variant="success">Aktywny</Badge> : 
                                           u.status === 'ANONYMIZED' ? <Badge variant="neutral">Zanonimizowany</Badge> : <Badge variant="warning">Nieaktywny</Badge>}
                                      </td>
                                      <td className="p-3 text-right">
                                          {u.status !== 'ANONYMIZED' && (
                                              <button 
                                                  onClick={() => handleConfirmAnonymize(u)}
                                                  className="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold border border-red-200"
                                              >
                                                  Anonimizuj
                                              </button>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          )}
      </div>
  );

  const renderLogs = () => {
      const columns: Column<AuditLogEntry>[] = [
          { header: 'Czas', accessorKey: 'timestamp', cell: (l) => <span className="text-xs text-slate-500">{new Date(l.timestamp).toLocaleString()}</span> },
          { header: 'Aktor', accessorKey: 'actorName', cell: (l) => <span className="font-bold text-slate-700">{l.actorName}</span> },
          { header: 'Operacja', accessorKey: 'action', cell: (l) => <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{l.action}</span> },
          { header: 'Szczegóły', accessorKey: 'details', cell: (l) => <span className="text-xs text-slate-600">{l.details}</span> }
      ];

      return (
          <div className="animate-in fade-in">
              <DataTable 
                  data={accessLogs} 
                  columns={columns} 
                  mobileRenderer={(l) => <div>{l.action}</div>}
                  title="Rejestr Dostępu do Danych"
                  subtitle="Logi operacji na danych osobowych (RODO Art. 30)"
                  searchableFields={['actorName', 'action', 'details']}
              />
          </div>
      );
  };

  const renderAnonymization = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="bg-red-50 border border-red-100 p-6 rounded-xl flex items-start gap-4">
              <AlertTriangle size={32} className="text-red-600 flex-shrink-0" />
              <div>
                  <h3 className="font-bold text-red-800 text-lg">Strefa Niebezpieczna: Prawo do bycia zapomnianym</h3>
                  <p className="text-sm text-red-700 mt-2 leading-relaxed">
                      Zgodnie z RODO (Art. 17), użytkownik ma prawo żądać usunięcia swoich danych osobowych. 
                      W systemie finansowym oznacza to <strong>anonimizację</strong> - dane identyfikacyjne zostaną bezpowrotnie nadpisane, 
                      ale historia transakcji pozostanie w systemie dla celów księgowych i podatkowych.
                  </p>
              </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  Ostatnio zanonimizowani użytkownicy
              </div>
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-500">
                      <tr>
                          <th className="p-3">ID Systemowe</th>
                          <th className="p-3">Data Anonimizacji</th>
                          <th className="p-3">Status</th>
                      </tr>
                  </thead>
                  <tbody>
                      {users.filter(u => u.status === 'ANONYMIZED').map(u => (
                          <tr key={u.id} className="border-b border-slate-100">
                              <td className="p-3 font-mono text-slate-500">{u.id}</td>
                              <td className="p-3 text-slate-700">
                                  {u.anonymizedAt ? new Date(u.anonymizedAt).toLocaleString() : 'Nieznana'}
                              </td>
                              <td className="p-3"><Badge variant="neutral">Skasowany</Badge></td>
                          </tr>
                      ))}
                      {users.filter(u => u.status === 'ANONYMIZED').length === 0 && (
                          <tr><td colSpan={3} className="p-6 text-center text-slate-400">Brak zanonimizowanych kont.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl overflow-hidden shadow-sm border border-slate-200">
        
        {/* Navigation */}
        <div className="bg-white border-b border-slate-200 flex overflow-x-auto">
            {[
                { id: 'SEARCH', label: 'Wyszukiwarka', icon: <Search size={16}/> },
                { id: 'LOGS', label: 'Rejestr Dostępów', icon: <FileText size={16}/> },
                { id: 'ANONYMIZATION', label: 'Anonimizacja', icon: <UserX size={16}/> },
                { id: 'CONSENTS', label: 'Zgody i Regulaminy', icon: <CheckCircle size={16}/> },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ComplianceTab)}
                    className={`px-6 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
                        activeTab === tab.id 
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    {tab.icon} {tab.label}
                </button>
            ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'SEARCH' && renderSearch()}
            {activeTab === 'LOGS' && renderLogs()}
            {activeTab === 'ANONYMIZATION' && renderAnonymization()}
            {activeTab === 'CONSENTS' && (
                <div className="text-center py-12">
                    <Shield size={48} className="text-slate-300 mx-auto mb-4"/>
                    <h3 className="text-xl font-bold text-slate-700">Rejestr Zgód</h3>
                    <p className="text-slate-500 mt-2">
                        Statystyki akceptacji regulaminów. Funkcja dostępna wkrótce.
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};
