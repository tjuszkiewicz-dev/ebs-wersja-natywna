
import { useCallback } from 'react';
import { User, Role, ContractType, ImportRow, ImportHistoryEntry, UserFinance, Company } from '../../types';
import { INITIAL_USERS } from '../../services/mockData';
import { generateSecurePassword } from '../../services/payrollService';
import { usePersistedState } from '../usePersistedState';
import { LogEventFn, NotifyUserFn, AddToastFn } from '../../types/callbacks';

export const useUserLogic = (
    companies: Company[],
    logEvent: LogEventFn,
    notifyUser: NotifyUserFn,
    addToast: AddToastFn,
    currentUser: User
) => {
  // Persistent State
  const [users, setUsers] = usePersistedState<User[]>('ebs_users_v1', INITIAL_USERS);
  const [importHistory, setImportHistory] = usePersistedState<ImportHistoryEntry[]>('ebs_import_history_v1', []);

  const handleUpdateEmployee = useCallback((userId: string, data: Partial<User>) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
      logEvent('USER_UPDATE', `Zaktualizowano dane pracownika ${userId}.`, userId, 'USER');
      addToast("Zapisano", "Dane pracownika zostały zaktualizowane.", "SUCCESS");
  }, [logEvent, addToast, setUsers]);

  const handleDeactivateEmployee = useCallback((employeeId: string) => {
    setUsers(prev => {
        const userToDeactivate = prev.find(u => u.id === employeeId);
        if (!userToDeactivate) return prev;
        
        return prev.map(u => u.id === employeeId ? { ...u, status: 'INACTIVE' } : u);
    });
    
    // We log vaguely or need to find user from current `users` dependency
    const user = users.find(u => u.id === employeeId);
    if(user) {
        logEvent('USER_DEACTIVATED', `Dezaktywowano pracownika ${user.name} (${user.id}). Blokada dystrybucji.`, employeeId, 'USER');
        addToast(
            "Pracownik Dezaktywowany",
            `Konto ${user.name} zostało oznaczone jako nieaktywne. Dystrybucja środków zablokowana. Historia zachowana.`,
            "INFO"
        );
    }
  }, [users, logEvent, addToast, setUsers]);

  const handleAnonymizeUser = useCallback((userId: string) => {
      setUsers(prev => prev.map(u => {
          if (u.id !== userId) return u;
          
          return {
              ...u,
              status: 'ANONYMIZED',
              name: 'Użytkownik Zanonimizowany',
              email: `deleted_${u.id.slice(-6)}@anon.ebs`,
              pesel: '***********',
              department: '---',
              position: '---',
              identity: { firstName: 'Anonim', lastName: 'Anonim', pesel: '***********', email: `deleted_${u.id.slice(-6)}@anon.ebs` },
              finance: undefined, // Clear banking data
              anonymizedAt: new Date().toISOString()
          };
      }));

      logEvent('USER_ANONYMIZED', `Trwale usunięto dane osobowe użytkownika ${userId} (RODO: Prawo do zapomnienia).`, userId, 'USER');
      addToast("Użytkownik Zanonimizowany", "Dane osobowe zostały nadpisane. Historia transakcji pozostała (retencja księgowa).", "WARNING");
  }, [logEvent, addToast, setUsers]);

  const handleBulkImport = useCallback(async (validRows: ImportRow[]) => {
     // FIX: Retrieve the FULL user object from state to ensure companyId is present
     // The 'currentUser' argument passed to this hook might only contain the ID during initialization.
     const actualUser = users.find(u => u.id === currentUser.id);

     if (!actualUser || !actualUser.companyId) {
         console.error("Context Error: User not found or missing companyId", actualUser);
         addToast("Błąd Importu", "Brak kontekstu firmy. Zaloguj się ponownie jako HR.", "ERROR");
         return null;
     }
     
     const companyId = actualUser.companyId;
     const hrName = actualUser.name;
     const dateNow = new Date().toISOString();
     
     const newUsers: User[] = [];
     const reportUsers: any[] = []; 

     validRows.forEach((row, idx) => {
         const tempPassword = generateSecurePassword();
         const userId = `EMP-B-${Date.now()}-${idx}`;

         // Extract Extended Data
         const phoneNumber = row.phoneNumber || '';
         const iban = row.iban ? row.iban.replace(/\s+/g, '').toUpperCase() : '';
         
         // Normalize Contract Type
         let cType = ContractType.UOP;
         if (row.contractType) {
             const rawType = String(row.contractType).toUpperCase();
             if (rawType.includes('UZ') || rawType.includes('ZLECENIE')) {
                 cType = ContractType.UZ;
             }
         }

         newUsers.push({
             id: userId,
             role: Role.EMPLOYEE,
             companyId: companyId,
             name: `${row.name} ${row.surname}`,
             email: row.email,
             pesel: row.pesel,
             department: row.department,
             position: row.position,
             voucherBalance: 0,
             status: 'ACTIVE',
             termsAccepted: true, // Auto-accept for manual entry
             termsAcceptedAt: dateNow,
             termsAcceptedMethod: 'BULK_IMPORT',
             
             // Populate EPS Layers
             identity: {
                firstName: row.name,
                lastName: row.surname,
                email: row.email,
                pesel: row.pesel,
                phoneNumber: phoneNumber
             },
             organization: {
                department: row.department,
                position: row.position,
                hireDate: dateNow
             },
             contract: {
                type: cType,
                hasSicknessInsurance: cType === ContractType.UOP // Default assumption
             },
             finance: {
                 payoutAccount: {
                     iban: iban,
                     country: 'PL',
                     isVerified: !!iban, // Auto-verify if entered by HR
                     verificationMethod: 'MANUAL',
                     lastVerifiedAt: iban ? dateNow : undefined
                 }
             }
         });

         reportUsers.push({
             id: userId,
             name: `${row.name} ${row.surname}`,
             email: row.email,
             tempPassword: tempPassword,
             department: row.department
         });
     });

     // UPDATE STATE
     setUsers(prev => [...prev, ...newUsers]);

     const reportId = `REP-${Date.now()}`;
     const reportData = {
        reportId: reportId,
        date: dateNow,
        hrName: hrName,
        importedCount: newUsers.length,
        users: reportUsers
     };

     const historyEntry: ImportHistoryEntry = {
         id: reportId,
         companyId: companyId,
         date: dateNow,
         hrName: hrName,
         totalProcessed: newUsers.length,
         status: 'SUCCESS',
         reportData: reportData
     };

     setImportHistory(prev => [historyEntry, ...prev]);

     const logMsg = `Zaimportowano ${newUsers.length} pracowników. Dane (Telefon, IBAN) zaktualizowane.`;
     logEvent('BULK_IMPORT', logMsg, reportId, 'IMPORT');

     addToast(
         "Sukces", 
         `Dodano ${newUsers.length} pracowników do listy. Możesz ich teraz zobaczyć w tabeli.`, 
         "SUCCESS"
     );

     return {
         reportData,
         company: companies.find(c => c.id === companyId),
         user: actualUser
     };
  }, [companies, currentUser, users, logEvent, addToast, setUsers, setImportHistory]); // Added 'users' dependency

  const handleUpdateUserFinance = useCallback((userId: string, financeData: UserFinance) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, finance: { ...u.finance, ...financeData } } : u));
      addToast("Dane Finansowe", "Konto bankowe zostało zaktualizowane (Tryb Admina).", "SUCCESS");
  }, [addToast, setUsers]);

  const handleRequestIbanChange = useCallback((userId: string, newIban: string, reason: string) => {
      const user = users.find(u => u.id === userId);
      if(!user) return;

      const requestEntry = {
          newIban,
          reason,
          requestedAt: new Date().toISOString(),
          status: 'PENDING'
      };

      setUsers(prev => prev.map(u => 
          u.id === userId 
          ? { 
              ...u, 
              finance: { 
                  ...u.finance, 
                  payoutAccount: u.finance?.payoutAccount || { iban: '', country: 'PL', isVerified: false },
                  pendingChange: requestEntry as any 
                } 
            } 
          : u
      ));

      logEvent('IBAN_CHANGE_REQUEST', `Użytkownik ${user.name} wnioskuje o zmianę IBAN. Powód: ${reason}`, userId, 'USER');
      
      notifyUser('ALL_ADMINS', `Wniosek o zmianę konta bankowego: ${user.name}. Powód: "${reason}"`, 'WARNING', {
          type: 'REVIEW_IBAN',
          targetId: userId,
          label: 'Weryfikuj Wniosek',
          variant: 'primary'
      }, userId, 'USER');

      addToast("Wniosek Wysłany", "Zmiana numeru konta wymaga weryfikacji Administratora. Otrzymasz powiadomienie po zatwierdzeniu.", "INFO");
  }, [users, logEvent, notifyUser, addToast, setUsers]);

  const handleResolveIbanChange = useCallback((userId: string, approved: boolean, rejectionReason?: string) => {
      setUsers(prev => prev.map(u => {
          if (u.id !== userId || !u.finance?.pendingChange) return u;

          const changeRequest = u.finance.pendingChange;
          
          if (approved) {
              return {
                  ...u,
                  finance: {
                      ...u.finance,
                      payoutAccount: {
                          ...u.finance.payoutAccount,
                          iban: changeRequest.newIban,
                          isVerified: true,
                          lastVerifiedAt: new Date().toISOString(),
                          verificationMethod: 'MANUAL'
                      },
                      pendingChange: undefined 
                  }
              };
          } else {
              return {
                  ...u,
                  finance: {
                      ...u.finance,
                      pendingChange: {
                          ...changeRequest,
                          status: 'REJECTED',
                          rejectionReason: rejectionReason || 'Odrzucono przez Administratora'
                      }
                  }
              };
          }
      }));

      const user = users.find(u => u.id === userId);
      const action = approved ? 'IBAN_CHANGE_APPROVED' : 'IBAN_CHANGE_REJECTED';
      logEvent(action, `Decyzja admina dla ${user?.name}. ${approved ? 'Zatwierdzono nowy IBAN' : 'Odrzucono zmianę'}.`, userId, 'USER');

      const message = approved 
        ? "Twój nowy numer konta został zatwierdzony przez Administratora."
        : `Odrzucono zmianę konta. Powód: ${rejectionReason || 'Brak uzasadnienia'}.`;
      
      notifyUser(userId, message, approved ? 'SUCCESS' : 'ERROR');
      
      addToast(
          approved ? "Zatwierdzono" : "Odrzucono",
          approved ? "Dane pracownika zostały zaktualizowane." : "Wniosek został odrzucony.",
          approved ? "SUCCESS" : "ERROR"
      );
  }, [users, logEvent, notifyUser, addToast, setUsers]);

  return {
      users,
      setUsers,
      importHistory,
      setImportHistory,
      handleUpdateEmployee,
      handleDeactivateEmployee,
      handleBulkImport,
      handleUpdateUserFinance,
      handleRequestIbanChange,
      handleResolveIbanChange,
      handleAnonymizeUser // EXPORT NEW FUNCTION
  };
};
