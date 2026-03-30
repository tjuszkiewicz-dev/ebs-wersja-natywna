
import React, { useCallback } from 'react';
import { Voucher, VoucherStatus, BuybackAgreement, Transaction, User, Company, ServiceItem, DistributionBatch, NotificationConfig, SystemConfig } from '../../types';
import { INITIAL_VOUCHERS, INITIAL_TRANSACTIONS } from '../../services/mockData';
import { usePersistedState } from '../usePersistedState';
import { generateUUID } from '../../services/payrollService';
import { LogEventFn, NotifyUserFn, AddToastFn } from '../../types/callbacks';

export const useVoucherLogic = (
    users: User[],
    setUsers: React.Dispatch<React.SetStateAction<User[]>>,
    companies: Company[],
    setCompanies: React.Dispatch<React.SetStateAction<Company[]>>,
    notificationConfigs: NotificationConfig[],
    systemConfig: SystemConfig,
    logEvent: LogEventFn,
    notifyUser: NotifyUserFn,
    addToast: AddToastFn,
    currentUser: User
) => {
  // Persistent State
  const [vouchers, setVouchers] = usePersistedState<Voucher[]>('ebs_vouchers_v1', INITIAL_VOUCHERS);
  const [buybacks, setBuybacks] = usePersistedState<BuybackAgreement[]>('ebs_buybacks_v1', []);
  const [transactions, setTransactions] = usePersistedState<Transaction[]>('ebs_transactions_v1', INITIAL_TRANSACTIONS);
  
  // NEW: Protocol History for Bulk AND Single Distribution
  const [distributionBatches, setDistributionBatches] = usePersistedState<DistributionBatch[]>('ebs_dist_batches_v1', []);

  // --- ACTIONS ---

  const handleManualEmission = useCallback((amount: number, description: string) => {
     if (amount <= 0) {
        addToast("Błąd Emisji", "Kwota musi być większa od zera.", "ERROR");
        return;
     }
     
     const emissionId = `EMISJA-MANUAL-${generateUUID().slice(0,6).toUpperCase()}`;
     const newVouchers: Voucher[] = Array.from({ length: amount }).map((_, i) => ({
      id: `SP/PLATFORM/MANUAL/${emissionId}/V-${String(i + 1).padStart(6, '0')}`,
      value: 1, 
      status: VoucherStatus.CREATED,
      companyId: 'PLATFORM', 
      emissionId: emissionId,
      issueDate: new Date().toISOString()
    }));

    setVouchers(prev => [...prev, ...newVouchers]);
    logEvent('MANUAL_EMISSION', `Wyemitowano ręcznie ${amount} voucherów. Emisja: ${emissionId}. Powód: ${description}`);
    notifyUser('ALL_ADMINS', `Nowa emisja manualna: ${amount} pkt. ID: ${emissionId}`, 'INFO');
    
    addToast("Emisja Zakończona", `Wyemitowano ${amount} voucherów do puli platformy.`, "SUCCESS");
  }, [logEvent, notifyUser, addToast, setVouchers]);

  const handleDistribute = useCallback((employeeId: string, amount: number) => {
    const companyId = currentUser.companyId;
    if (!companyId) return;

    const targetUser = users.find(u => u.id === employeeId);
    if (!targetUser || targetUser.status === 'INACTIVE') {
        addToast("Błąd Dystrybucji", "Pracownik nieaktywny lub nie znaleziony.", "ERROR");
        return;
    }

    // 1. Get pools
    const activeVouchers = vouchers.filter(v => v.companyId === companyId && v.status === VoucherStatus.ACTIVE);
    const reservedVouchers = vouchers.filter(v => v.companyId === companyId && v.status === VoucherStatus.RESERVED);
    
    const totalAvailable = activeVouchers.length + reservedVouchers.length;

    // 2. Check total availability
    if (totalAvailable < amount) {
        addToast("Brak Środków", `Niewystarczająca liczba voucherów. Masz ${totalAvailable} pkt (w tym rezerwacje), a próbujesz wysłać ${amount}.`, "ERROR");
        return;
    }

    // 3. Select Vouchers (FIFO Strategy: Active first, then Reserved)
    let selectedVouchers: Voucher[] = [];
    let usedReservedCount = 0;

    if (activeVouchers.length >= amount) {
        // Scenario A: Enough Active vouchers
        selectedVouchers = activeVouchers.slice(0, amount);
    } else {
        // Scenario B: Trust Model (Mix Active + Reserved)
        const neededFromReserve = amount - activeVouchers.length;
        usedReservedCount = neededFromReserve;
        selectedVouchers = [...activeVouchers, ...reservedVouchers.slice(0, neededFromReserve)];
    }

    const idsToUpdate = selectedVouchers.map(v => v.id);
    const expiryDate = new Date(Date.now() + systemConfig.defaultVoucherValidityDays * 24 * 60 * 60 * 1000).toISOString();

    // 4. Update State
    setVouchers(prev => prev.map(v => 
      idsToUpdate.includes(v.id) 
        ? { 
            ...v, 
            status: VoucherStatus.DISTRIBUTED, 
            ownerId: employeeId,
            expiryDate: expiryDate
          } 
        : v
    ));

    setUsers(prev => prev.map(u => 
      u.id === employeeId ? { ...u, voucherBalance: u.voucherBalance + amount } : u
    ));
    
    // Update company balances visually
    setCompanies(prev => prev.map(c => {
        if (c.id !== companyId) return c;
        // Decrement balanceActive only for the active portion used
        const usedActive = amount - usedReservedCount;
        return { ...c, balanceActive: Math.max(0, c.balanceActive - usedActive) };
    }));

    // 5. CREATE PROTOCOL RECORD (DistributionBatch) - SINGLE DISTRIBUTION
    const batchId = `PROTOCOL-S-${new Date().toISOString().slice(0,10)}-${generateUUID().slice(0,4).toUpperCase()}`;
    const newBatch: DistributionBatch = {
        id: batchId,
        companyId: companyId,
        date: new Date().toISOString(),
        hrName: currentUser.name,
        totalAmount: amount,
        items: [{
            userId: targetUser.id,
            userName: targetUser.name,
            amount: amount
        }],
        status: 'COMPLETED'
    };
    setDistributionBatches(prev => [newBatch, ...prev]);

    // 6. Logging & Feedback
    const trustMsg = usedReservedCount > 0 ? ` (Użyto ${usedReservedCount} z puli Rezerwacji - Trust Model)` : '';
    
    logEvent('VOUCHER_DISTRIBUTED', `Przekazano ${amount} voucherów dla pracownika ${employeeId}.${trustMsg}. Wygenerowano protokół: ${batchId}`, employeeId, 'USER');
    notifyUser(employeeId, `Otrzymałeś ${amount} nowych voucherów!`, 'SUCCESS');
    
    if (usedReservedCount > 0) {
        addToast("Przekazano (Trust Model)", `Przekazano ${amount} pkt. Utworzono protokół w Teczce.`, "WARNING");
    } else {
        addToast("Vouchery Przekazane", `Przekazano ${amount} pkt. Protokół zapisany w Teczce.`, "SUCCESS");
    }

  }, [currentUser, users, vouchers, systemConfig, setUsers, setCompanies, logEvent, notifyUser, addToast, setVouchers, setDistributionBatches]);

  // Bulk Distribution Logic
  const handleBulkDistribute = useCallback((items: { employeeId: string; amount: number }[]) => {
      const companyId = currentUser.companyId;
      if (!companyId) {
          addToast("Błąd", "Nie zidentyfikowano firmy użytkownika.", "ERROR");
          return;
      }

      const totalAmountNeeded = items.reduce((acc, item) => acc + item.amount, 0);
      
      const currentVouchers = [...vouchers];
      const activeVouchers = currentVouchers.filter(v => v.companyId === companyId && v.status === VoucherStatus.ACTIVE);
      const reservedVouchers = currentVouchers.filter(v => v.companyId === companyId && v.status === VoucherStatus.RESERVED);
      const totalAvailable = activeVouchers.length + reservedVouchers.length;

      if (totalAvailable < totalAmountNeeded) {
          addToast("Błąd Masowy", `Brakuje ${totalAmountNeeded - totalAvailable} voucherów do realizacji listy. Zamów więcej środków.`, "ERROR");
          return;
      }

      let currentActiveIdx = 0;
      let currentReservedIdx = 0;
      
      let updatedVouchers = [...currentVouchers];
      let updatedUsers = [...users];
      let usedActiveTotal = 0;
      
      const expiryDate = new Date(Date.now() + systemConfig.defaultVoucherValidityDays * 24 * 60 * 60 * 1000).toISOString();
      const batchItems: { userId: string; userName: string; amount: number }[] = [];

      items.forEach(item => {
          let needed = item.amount;
          const assignedIds: string[] = [];

          while (needed > 0 && currentActiveIdx < activeVouchers.length) {
              assignedIds.push(activeVouchers[currentActiveIdx].id);
              currentActiveIdx++;
              needed--;
              usedActiveTotal++;
          }

          while (needed > 0 && currentReservedIdx < reservedVouchers.length) {
              assignedIds.push(reservedVouchers[currentReservedIdx].id);
              currentReservedIdx++;
              needed--;
          }

          if (assignedIds.length > 0) {
              updatedVouchers = updatedVouchers.map(v => 
                  assignedIds.includes(v.id) 
                  ? { ...v, status: VoucherStatus.DISTRIBUTED, ownerId: item.employeeId, expiryDate } 
                  : v
              );
              
              const userIndex = updatedUsers.findIndex(u => u.id === item.employeeId);
              if (userIndex > -1) {
                  const targetUser = updatedUsers[userIndex];
                  updatedUsers[userIndex] = {
                      ...targetUser,
                      voucherBalance: targetUser.voucherBalance + item.amount
                  };

                  batchItems.push({
                      userId: targetUser.id,
                      userName: targetUser.name,
                      amount: item.amount
                  });
                  notifyUser(item.employeeId, `Otrzymałeś ${item.amount} nowych voucherów (Lista zbiorcza)!`, 'SUCCESS');
              }
          }
      });

      setVouchers(updatedVouchers);
      setUsers(updatedUsers);

      setCompanies(prev => prev.map(c => 
          c.id === companyId 
          ? { ...c, balanceActive: Math.max(0, c.balanceActive - usedActiveTotal) } 
          : c
      ));

      // CREATE PROTOCOL RECORD (DistributionBatch) - BULK
      const batchId = `PROTOCOL-${new Date().toISOString().slice(0,10)}-${generateUUID().slice(0,4).toUpperCase()}`;
      const newBatch: DistributionBatch = {
          id: batchId,
          companyId: companyId,
          date: new Date().toISOString(),
          hrName: currentUser.name,
          totalAmount: totalAmountNeeded,
          items: batchItems,
          status: 'COMPLETED'
      };
      
      setDistributionBatches(prev => [newBatch, ...prev]);

      logEvent('BULK_DISTRIBUTION', `Rozdano masowo ${totalAmountNeeded} pkt dla ${items.length} pracowników. Protokół: ${batchId}`, currentUser.id, 'BULK');
      
      addToast(
          "Masowa Dystrybucja Zakończona", 
          `Pomyślnie rozdano ${totalAmountNeeded} pkt. Protokół został wygenerowany i jest dostępny w Teczce Dokumentów.`, 
          "SUCCESS"
      );

  }, [currentUser, users, vouchers, systemConfig, setUsers, setCompanies, logEvent, notifyUser, addToast, setVouchers, setDistributionBatches]);

  const handleServicePurchase = useCallback((service: ServiceItem) => {
    // ... existing purchase logic ...
    if (currentUser.voucherBalance < service.price) {
      addToast("Transakcja Odrzucona", "Niewystarczające środki.", "ERROR");
      return;
    }

    const userVouchers = vouchers.filter(v => v.ownerId === currentUser.id && v.status === VoucherStatus.DISTRIBUTED);
    const vouchersToConsume = userVouchers.slice(0, service.price);
    const idsToConsume = vouchersToConsume.map(v => v.id);

    setVouchers(prev => prev.map(v => 
      idsToConsume.includes(v.id) ? { ...v, status: VoucherStatus.CONSUMED } : v
    ));

    setUsers(prev => prev.map(u => 
      u.id === currentUser.id ? { ...u, voucherBalance: u.voucherBalance - service.price } : u
    ));

    const newTransaction: Transaction = {
      id: `TRX-${generateUUID()}`,
      userId: currentUser.id,
      type: 'DEBIT',
      serviceId: service.id,
      serviceName: service.name,
      amount: service.price,
      date: new Date().toISOString()
    };
    setTransactions(prev => [newTransaction, ...prev]);

    logEvent('SERVICE_CONSUMPTION', `Zakup usługi: ${service.name}.`, currentUser.id, 'USER');
    notifyUser(currentUser.id, `Zakupiono: ${service.name}.`, 'SUCCESS');
    addToast("Usługa Aktywowana", `Pobrano ${service.price} pkt.`, "SUCCESS");
  }, [currentUser, vouchers, setUsers, logEvent, notifyUser, addToast, setVouchers, setTransactions]);

  const simulateExpiration = useCallback(() => {
    // ... existing simulation logic ...
    const activeUserIds = new Set(users.filter(u => u.status === 'ACTIVE').map(u => u.id));
    const eligibleVouchers = vouchers.filter(v => 
        v.status === VoucherStatus.DISTRIBUTED && v.ownerId && activeUserIds.has(v.ownerId)
    );

    if (eligibleVouchers.length === 0) {
      addToast("Symulacja Zatrzymana", "Brak rozdanych voucherów u AKTYWNYCH pracowników.", "INFO");
      return;
    }

    const uniqueOwners = (Array.from(new Set(eligibleVouchers.map(v => v.ownerId as string))) as string[]).slice(0, 5);
    const vouchersToExpire = eligibleVouchers.filter(v => uniqueOwners.includes(v.ownerId as string));
    const idsToExpire = vouchersToExpire.map(v => v.id);

    setVouchers(prev => prev.map(v => 
      idsToExpire.includes(v.id) ? { ...v, status: VoucherStatus.BUYBACK_PENDING } : v
    ));

    const newAgreements: BuybackAgreement[] = [];
    uniqueOwners.forEach(uid => {
      const user = users.find(u => u.id === uid);
      const userVouchers = vouchersToExpire.filter(v => v.ownerId === uid);
      const count = userVouchers.length;
      
      const userSnapshot = user ? {
          name: user.name,
          email: user.email,
          pesel: user.pesel || '',
          address: user.address ? `${user.address.street}, ${user.address.zipCode} ${user.address.city}` : '',
          iban: user.finance?.payoutAccount?.iban || ''
      } : { name: 'Unknown', email: '', pesel: '', iban: '' };

      const agreementId = `UMOWA-ODKUP-${generateUUID().slice(0,8).toUpperCase()}`;

      newAgreements.push({
        id: agreementId,
        userId: uid,
        voucherCount: count,
        totalValue: count * 1,
        dateGenerated: new Date().toISOString(),
        status: 'PENDING_APPROVAL',
        snapshot: {
            user: userSnapshot,
            vouchers: userVouchers.map(v => v.id),
            termsVersion: '1.0'
        }
      });

      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, voucherBalance: u.voucherBalance - count } : u
      ));
      
      notifyUser(uid, `Twoje vouchery (${count} szt.) wygasły. Wygenerowano umowę odkupu.`, 'WARNING', undefined, agreementId, 'BUYBACK');
    });

    setBuybacks(prev => [...prev, ...newAgreements]);
    addToast("Symulacja Zakończona", `Wygaszono vouchery dla ${uniqueOwners.length} osób.`, "SUCCESS");
  }, [vouchers, users, notificationConfigs, setUsers, logEvent, notifyUser, addToast, setVouchers, setBuybacks]);

  const handleApproveBuyback = useCallback((buybackId: string) => {
    setBuybacks(prev => prev.map(b => b.id === buybackId ? { ...b, status: 'APPROVED' } : b));
    setVouchers(prev => prev.map(v => {
        return v.status === VoucherStatus.BUYBACK_PENDING ? { ...v, status: VoucherStatus.BUYBACK_COMPLETE } : v; 
    }));
    logEvent('BUYBACK_APPROVED', `Zatwierdzono odkup ${buybackId}.`, buybackId, 'BUYBACK');
    addToast("Odkup Zatwierdzony", "Umowa zatwierdzona.", "SUCCESS");
  }, [logEvent, addToast, setBuybacks, setVouchers]);

  const handleProcessBuybackPayment = useCallback((buybackId: string, details?: { date: string, reference?: string }) => {
      setBuybacks(prev => prev.map(b => b.id === buybackId ? { ...b, status: 'PAID' } : b));
      logEvent('BUYBACK_PAID', `Zaksięgowano płatność za odkup ${buybackId}.`, buybackId, 'BUYBACK');
      addToast("Wypłata Zaksięgowana", "Środki wysłane.", "SUCCESS");
  }, [logEvent, addToast, setBuybacks]);

  return {
      vouchers,
      setVouchers,
      buybacks,
      setBuybacks,
      transactions,
      setTransactions,
      distributionBatches,
      setDistributionBatches, // NEW: Exported so OrderLogic can use it
      handleManualEmission,
      handleDistribute,
      handleBulkDistribute,
      handleServicePurchase,
      simulateExpiration,
      handleApproveBuyback,
      handleProcessBuybackPayment
  };
};
