
import { useState, useCallback, useEffect } from 'react';
import { User, Role, ContractType, ImportRow, ImportHistoryEntry, UserFinance, Company } from '../../types';
import { supabaseProfileToUser } from '../../lib/supabaseToUser';
import { LogEventFn, NotifyUserFn, AddToastFn } from '../../types/callbacks';

export const useUserLogic = (
    companies: Company[],
    logEvent: LogEventFn,
    notifyUser: NotifyUserFn,
    addToast: AddToastFn,
    currentUser: User
) => {
  const [users, setUsers] = useState<User[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);

  // --- Pobierz użytkowników z API przy starcie ---
  useEffect(() => {
    if (!currentUser?.id) return;
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then((profiles: any[]) => {
        const mapped: User[] = profiles.map(p =>
          supabaseProfileToUser(p, p.email ?? '', p.company_id ?? '')
        );
        setUsers(mapped);
      })
      .catch(() => {});
  }, [currentUser?.id]);

  // --- Operacje na użytkownikach ---

  const handleUpdateEmployee = useCallback(async (userId: string, data: Partial<User>) => {
    // Optimistic
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));

    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:     data.name,
        department:    data.department,
        position:      data.position,
        phone_number:  data.identity?.phoneNumber,
        contract_type: data.contract?.type,
      }),
    });

    if (!res.ok) {
      addToast('Błąd', 'Nie udało się zaktualizować danych.', 'ERROR');
      return;
    }

    logEvent('USER_UPDATE', `Zaktualizowano dane pracownika ${userId}.`, userId, 'USER');
    addToast('Zapisano', 'Dane pracownika zostały zaktualizowane.', 'SUCCESS');
  }, [logEvent, addToast]);

  const handleDeactivateEmployee = useCallback(async (employeeId: string) => {
    const user = users.find(u => u.id === employeeId);
    // Optimistic
    setUsers(prev => prev.map(u => u.id === employeeId ? { ...u, status: 'INACTIVE' } : u));

    const res = await fetch(`/api/users/${employeeId}/deactivate`, { method: 'PATCH' });

    if (!res.ok) {
      setUsers(prev => prev.map(u => u.id === employeeId ? { ...u, status: 'ACTIVE' } : u));
      addToast('Błąd', 'Nie udało się dezaktywować konta.', 'ERROR');
      return;
    }

    if (user) {
      logEvent('USER_DEACTIVATED', `Dezaktywowano pracownika ${user.name} (${user.id}).`, employeeId, 'USER');
      addToast('Pracownik Dezaktywowany', `Konto ${user.name} oznaczone jako nieaktywne.`, 'INFO');
    }
  }, [users, logEvent, addToast]);

  const handleAnonymizeUser = useCallback(async (userId: string) => {
    const res = await fetch(`/api/users/${userId}/anonymize`, { method: 'POST' });

    if (!res.ok) {
      addToast('Błąd', 'Nie udało się zanonimizować użytkownika.', 'ERROR');
      return;
    }

    setUsers(prev => prev.map(u => u.id !== userId ? u : {
      ...u,
      status: 'ANONYMIZED',
      name: 'Użytkownik Zanonimizowany',
      email: `deleted_${u.id.slice(-6)}@anon.ebs`,
      pesel: '***',
      department: undefined,
      position: undefined,
      finance: undefined,
    }));

    logEvent('USER_ANONYMIZED', `Zanonimizowano dane użytkownika ${userId} (RODO).`, userId, 'USER');
    addToast('Użytkownik Zanonimizowany', 'Dane osobowe nadpisane. Historia transakcji zachowana.', 'WARNING');
  }, [logEvent, addToast]);

  const handleBulkImport = useCallback(async (validRows: ImportRow[]) => {
    const companyId = currentUser?.companyId;
    if (!companyId) {
      addToast('Błąd Importu', 'Brak kontekstu firmy. Zaloguj się ponownie jako HR.', 'ERROR');
      return null;
    }

    const res = await fetch('/api/users/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validRows, companyId }),
    });

    if (!res.ok) {
      addToast('Błąd importu', 'Nie udało się zaimportować pracowników.', 'ERROR');
      return null;
    }

    const result = await res.json();
    const { imported, errors, reportId } = result;

    // Odśwież listę użytkowników
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then((profiles: any[]) => {
        const mapped: User[] = profiles.map(p =>
          supabaseProfileToUser(p, p.email ?? '', p.company_id ?? '')
        );
        setUsers(mapped);
      })
      .catch(() => {});

    const historyEntry: ImportHistoryEntry = {
      id: reportId,
      companyId,
      date: new Date().toISOString(),
      hrName: currentUser.name,
      totalProcessed: imported,
      status: errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
      reportData: { reportId, importedCount: imported, errors },
    };
    setImportHistory(prev => [historyEntry, ...prev]);

    logEvent('BULK_IMPORT', `Zaimportowano ${imported} pracowników.`, reportId, 'IMPORT');
    addToast('Sukces', `Dodano ${imported} pracowników.`, 'SUCCESS');

    return { reportData: historyEntry.reportData, company: companies.find(c => c.id === companyId), user: currentUser };
  }, [companies, currentUser, logEvent, addToast]);

  const handleUpdateUserFinance = useCallback(async (userId: string, financeData: UserFinance) => {
    const iban = (financeData as any)?.payoutAccount?.iban;
    const res = await fetch(`/api/users/${userId}/finance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iban, iban_verified: true }),
    });

    if (!res.ok) { addToast('Błąd', 'Nie udało się zaktualizować danych finansowych.', 'ERROR'); return; }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, finance: { ...u.finance, ...financeData } } : u));
    addToast('Dane Finansowe', 'Konto bankowe zostało zaktualizowane.', 'SUCCESS');
  }, [addToast]);

  const handleRequestIbanChange = useCallback(async (userId: string, newIban: string, reason: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const res = await fetch(`/api/users/${userId}/iban-change-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newIban, reason }),
    });

    if (!res.ok) {
      const err = await res.json();
      addToast('Błąd', err.error ?? 'Nie udało się złożyć wniosku.', 'ERROR');
      return;
    }

    logEvent('IBAN_CHANGE_REQUEST', `Użytkownik ${user.name} wnioskuje o zmianę IBAN.`, userId, 'USER');
    notifyUser('ALL_ADMINS', `Wniosek o zmianę konta bankowego: ${user.name}. Powód: "${reason}"`, 'WARNING', {
      type: 'REVIEW_IBAN', targetId: userId, label: 'Weryfikuj Wniosek', variant: 'primary'
    }, userId, 'USER');
    addToast('Wniosek Wysłany', 'Zmiana konta wymaga weryfikacji Administratora.', 'INFO');
  }, [users, logEvent, notifyUser, addToast]);

  const handleResolveIbanChange = useCallback(async (userId: string, approved: boolean, rejectionReason?: string) => {
    const res = await fetch(`/api/users/${userId}/iban-change-request/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, rejectionReason }),
    });

    if (!res.ok) { addToast('Błąd', 'Nie udało się przetworzyć wniosku.', 'ERROR'); return; }

    const result = await res.json();
    const user = users.find(u => u.id === userId);

    if (approved && result.newIban) {
      setUsers(prev => prev.map(u => u.id !== userId ? u : {
        ...u,
        finance: { ...u.finance, payoutAccount: { iban: result.newIban, country: 'PL', isVerified: true } }
      }));
    }

    logEvent(approved ? 'IBAN_CHANGE_APPROVED' : 'IBAN_CHANGE_REJECTED',
      `Decyzja dla ${user?.name}. ${approved ? 'Zatwierdzono' : 'Odrzucono'}.`, userId, 'USER');

    notifyUser(userId,
      approved ? 'Twój nowy numer konta został zatwierdzony.' : `Odrzucono zmianę. Powód: ${rejectionReason ?? 'Brak'}`,
      approved ? 'SUCCESS' : 'ERROR'
    );

    addToast(approved ? 'Zatwierdzono' : 'Odrzucono',
      approved ? 'Dane pracownika zaktualizowane.' : 'Wniosek odrzucony.',
      approved ? 'SUCCESS' : 'ERROR');
  }, [users, logEvent, notifyUser, addToast]);

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
    handleAnonymizeUser,
  };
};
