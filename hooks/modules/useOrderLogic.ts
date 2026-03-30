
import React, { useCallback } from 'react';
import { Order, OrderStatus, Company, User, Voucher, VoucherStatus, Role, Commission, CommissionType, PayrollEntry, PayrollSnapshot, DistributionBatch, SystemConfig } from '../../types';
import { INITIAL_ORDERS, INITIAL_COMPANIES, INITIAL_COMMISSIONS } from '../../services/mockData';
import { createSnapshot, generateUUID } from '../../services/payrollService';
import { calculateOrderTotals, FINANCIAL_CONSTANTS } from '../../utils/financialMath';
import { usePersistedState } from '../usePersistedState';
import { LogEventFn, NotifyUserFn, AddToastFn } from '../../types/callbacks';
import { COMMISSION_RATES } from '../../utils/config';

const getQuarter = (date: Date): string => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
};

// --- MOCK CRM DATA SOURCE ---
const MOCK_CRM_PAYLOAD = [
    { 
        crm_id: 'CRM-1001', 
        name: 'Omega Logistics Sp. z o.o.', 
        nip: '7770001122', 
        status: 'SIGNED', 
        address_street: 'Magazynowa 4', 
        address_city: 'Poznań', 
        address_zip: '60-001',
        manager_email: 'adam.d@eliton-benefits.com' 
    },
    { 
        crm_id: 'CRM-1002', 
        name: 'Pixel Art Studio', 
        nip: '8880003344', 
        status: 'NEGOTIATION', 
        address_street: 'Designerska 8', 
        address_city: 'Wrocław', 
        address_zip: '50-001'
    },
    { 
        crm_id: 'CRM-1003', 
        name: 'Green Energy S.A.', 
        nip: '9990005566', 
        status: 'SIGNED', 
        address_street: 'Słoneczna 15', 
        address_city: 'Gdańsk', 
        address_zip: '80-001',
        manager_email: 'marek.m@eliton-benefits.com' 
    }
];

export const useOrderLogic = (
    users: User[],
    setUsers: React.Dispatch<React.SetStateAction<User[]>>,
    vouchers: Voucher[],
    setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>,
    setDistributionBatches: React.Dispatch<React.SetStateAction<DistributionBatch[]>>,
    systemConfig: SystemConfig,
    logEvent: LogEventFn,
    notifyUser: NotifyUserFn,
    addToast: AddToastFn,
    currentUser: User
) => {
  // Persistent State
  const [orders, setOrders] = usePersistedState<Order[]>('ebs_orders_v1', INITIAL_ORDERS);
  const [companies, setCompanies] = usePersistedState<Company[]>('ebs_companies_v1', INITIAL_COMPANIES);

  // Clear old commission keys to force fresh state with new rates
  if (typeof window !== 'undefined') {
    ['ebs_commissions_v1', 'ebs_commissions_v2'].forEach(k => window.localStorage.removeItem(k));
  }
  const [commissions, setCommissions] = usePersistedState<Commission[]>('ebs_commissions_v3', INITIAL_COMMISSIONS);

  // --- CRM SYNC LOGIC ---
  const handleCrmSync = useCallback(async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));

      let importedCount = 0;
      let skippedCount = 0;
      const newCompanies: Company[] = [];

      MOCK_CRM_PAYLOAD.forEach(crmCompany => {
          if (crmCompany.status !== 'SIGNED') {
              skippedCount++;
              return;
          }
          if (companies.some(c => c.nip === crmCompany.nip)) {
              return;
          }

          const matchedAgent = users.find(u => u.email === crmCompany.manager_email);
          let advisorId = undefined;
          let managerId = undefined;

          if (matchedAgent) {
              if (matchedAgent.role === Role.ADVISOR) advisorId = matchedAgent.id;
              if (matchedAgent.role === Role.MANAGER) managerId = matchedAgent.id;
          }

          const newCompany: Company = {
              id: `FIRMA-${generateUUID().slice(0,8).toUpperCase()}`,
              externalCrmId: crmCompany.crm_id,
              origin: 'CRM_SYNC',
              isSyncManaged: true,
              name: crmCompany.name,
              nip: crmCompany.nip,
              balanceActive: 0,
              balancePending: 0,
              advisorId,
              managerId,
              address: {
                  street: crmCompany.address_street,
                  city: crmCompany.address_city,
                  zipCode: crmCompany.address_zip
              }
          };

          newCompanies.push(newCompany);
          importedCount++;
      });

      if (importedCount > 0) {
          setCompanies(prev => [...prev, ...newCompanies]);
          logEvent('CRM_SYNC_SUCCESS', `Pobrano ${importedCount} nowych firm ze statusu SIGNED. Pominięto: ${skippedCount}.`, 'CRM', 'SYSTEM');
          addToast("Synchronizacja CRM", `Pomyślnie zaimportowano ${importedCount} firm. Dane handlowe zaktualizowane.`, "SUCCESS");
      } else {
          addToast("Synchronizacja CRM", "Brak nowych firm o statusie SIGNED w systemie źródłowym.", "INFO");
      }

  }, [companies, users, setCompanies, logEvent, addToast]);

  const handleAddCompany = useCallback((newCompanyData: Partial<Company>) => {
      const newId = `FIRMA-${generateUUID().slice(0,8).toUpperCase()}`;
      const newCompany: Company = {
          id: newId,
          name: newCompanyData.name || 'Nowa Firma',
          nip: newCompanyData.nip || '',
          balanceActive: 0,
          balancePending: 0,
          advisorId: newCompanyData.advisorId,
          managerId: newCompanyData.managerId,
          directorId: newCompanyData.directorId,
          address: newCompanyData.address,
          customPaymentTermsDays: newCompanyData.customPaymentTermsDays,
          customVoucherValidityDays: newCompanyData.customVoucherValidityDays,
          origin: 'NATIVE'
      };

      setCompanies(prev => [...prev, newCompany]);
      logEvent('COMPANY_CREATED', `Utworzono nową firmę: ${newCompany.name} (${newCompany.id})`, newCompany.id, 'COMPANY');
      addToast("Firma Dodana", `Firma ${newCompany.name} została dodana do bazy.`, "SUCCESS");
  }, [setCompanies, logEvent, addToast]);

  const handlePlaceOrder = useCallback((amount: number, distributionPlan?: PayrollEntry[]) => {
    if (!currentUser.companyId) return;
    
    const hasPaidOrders = orders.some(o => o.companyId === currentUser.companyId && o.status === OrderStatus.PAID);
    const isFirstInvoice = !hasPaidOrders;

    // USE CENTRAL MATH UTILITY
    const totals = calculateOrderTotals(amount, FINANCIAL_CONSTANTS.DEFAULT_SUCCESS_FEE);
    
    const year = new Date().getFullYear();
    const uniqueSuffix = generateUUID().slice(0,6).toUpperCase();

    let snapshots: PayrollSnapshot[] | undefined = undefined;
    if (distributionPlan && distributionPlan.length > 0) {
        snapshots = distributionPlan.map(entry => createSnapshot(entry));
    }

    const newOrder: Order = {
      id: `ZAM-${year}-${uniqueSuffix}`,
      companyId: currentUser.companyId,
      amount: totals.voucherValue,
      voucherValue: totals.voucherValue,
      feeValue: totals.feeGross, // Order Model stores Gross Fee typically or handle separation in model
      totalValue: totals.totalPayable,
      docVoucherId: `NK/${year}/${uniqueSuffix}/B`,
      docFeeId: `FV/${year}/${uniqueSuffix}/S`,
      date: new Date().toISOString(),
      status: OrderStatus.PENDING,
      isFirstInvoice,
      distributionPlan: distributionPlan,
      snapshots: snapshots
    };

    setOrders(prev => [...prev, newOrder]);
    
    const methodMsg = snapshots ? ` (z planem auto-dystrybucji: ${snapshots.length} os. - SNAPSHOT ZAPISANY)` : '';
    logEvent('ORDER_CREATED', `Złożono zamówienie ${newOrder.id}${methodMsg}. Wygenerowano dok: ${newOrder.docVoucherId} i ${newOrder.docFeeId}.`, newOrder.id, 'ORDER');
    
    notifyUser('ALL_ADMINS', `Nowe zamówienie ${newOrder.id} (${totals.totalPayable.toFixed(2)} PLN) czeka na akceptację.`, 'WARNING', {
        type: 'APPROVE_ORDER',
        targetId: newOrder.id,
        label: 'Zatwierdź Zamówienie',
        variant: 'primary'
    }, newOrder.id, 'ORDER');
    
    addToast(
        "Zamówienie Przyjęte", 
        `Utworzono zamówienie nr ${newOrder.id}. ${snapshots ? 'System zamroził stawkę i podział (Snapshot).' : 'Pobierz dokumenty z tabeli historii.'}`, 
        "SUCCESS"
    );
  }, [currentUser, orders, logEvent, notifyUser, addToast, setOrders]);

  const handleApproveOrder = useCallback((orderId: string) => {
    // ... existing approve logic ...
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (order.status !== OrderStatus.PENDING) {
        addToast("Info", "To zamówienie zostało już przetworzone.", "INFO");
        return;
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.APPROVED } : o));

    const emissionId = `EMISJA-${order.id}-${generateUUID().slice(0,4).toUpperCase()}`;
    let newVouchers: Voucher[] = Array.from({ length: order.amount }).map((_, i) => ({
      id: `SP/${order.companyId}/${order.id}/${emissionId}/V-${String(i + 1).padStart(6, '0')}`,
      value: 1, 
      status: VoucherStatus.RESERVED,
      companyId: order.companyId,
      orderId: order.id,
      emissionId: emissionId,
      issueDate: new Date().toISOString()
    }));

    const planSource = order.snapshots || order.distributionPlan;
    let distributedCount = 0;
    let updatedUsers = [...users];
    
    // NEW: Batch Protocol for Auto-Distribution
    const batchItems: { userId: string; userName: string; amount: number }[] = [];

    if (planSource && planSource.length > 0) {
        logEvent('AUTO_DISTRIBUTION_TRUST', `Wykryto plan płacowy dla zamówienia ${orderId}. Uruchamianie natychmiastowej dystrybucji (Trust Model)...`, orderId, 'ORDER');
        
        const expiryDate = new Date(Date.now() + systemConfig.defaultVoucherValidityDays * 24 * 60 * 60 * 1000).toISOString();
        let currentVoucherIndex = 0;

        planSource.forEach(entry => {
             const userId = (entry as any).matched_user_id || (entry as any).matchedUserId;
             const amount = Math.floor((entry as any).final_netto_voucher || (entry as any).voucherPartNet);

             if (userId && amount > 0) {
                 if (currentVoucherIndex + amount <= newVouchers.length) {
                     const userIndex = updatedUsers.findIndex(u => u.id === userId);
                     if (userIndex > -1) {
                         const user = updatedUsers[userIndex];
                         updatedUsers[userIndex] = {
                             ...user,
                             voucherBalance: user.voucherBalance + amount
                         };
                         
                         for(let i = 0; i < amount; i++) {
                             newVouchers[currentVoucherIndex + i].status = VoucherStatus.DISTRIBUTED;
                             newVouchers[currentVoucherIndex + i].ownerId = userId;
                             newVouchers[currentVoucherIndex + i].expiryDate = expiryDate;
                         }
                         
                         // Add to Protocol
                         batchItems.push({ userId: user.id, userName: user.name, amount });

                         currentVoucherIndex += amount;
                         distributedCount += amount;
                         notifyUser(userId, `Otrzymałeś ${amount} nowych voucherów (Dystrybucja automatyczna).`, 'SUCCESS');
                     }
                 }
             }
        });
        
        setUsers(updatedUsers);
        
        // CRITICAL FIX: Create DistributionBatch record for Trust/Auto Orders
        if (batchItems.length > 0) {
            const batchId = `PROTOCOL-AUTO-${new Date().toISOString().slice(0,10)}-${order.id.split('-').pop()}`;
            const newBatch: DistributionBatch = {
                id: batchId,
                companyId: order.companyId,
                date: new Date().toISOString(),
                hrName: 'System (Auto-Trust)',
                totalAmount: distributedCount,
                items: batchItems,
                status: 'COMPLETED'
            };
            setDistributionBatches(prev => [newBatch, ...prev]);
        }

        logEvent('AUTO_DISTRIBUTION_COMPLETE', `Rozdano ${distributedCount} voucherów w modelu zaufania (przed płatnością).`, orderId, 'ORDER');
    }

    setVouchers(prev => [...prev, ...newVouchers]);

    const hrUser = users.find(u => u.companyId === order.companyId && u.role === Role.HR);
    if (hrUser) {
      const msg = planSource 
        ? `Zamówienie ${orderId} zatwierdzone. Vouchery zostały automatycznie rozdane pracownikom (Trust Model). Faktura do opłacenia w ciągu 7 dni.`
        : `Zamówienie ${orderId} zatwierdzone. Vouchery dostępne do rozdania w puli "Rezerwacja".`;
      notifyUser(hrUser.id, msg, 'SUCCESS', undefined, orderId, 'ORDER');
    }
    
    logEvent('ORDER_APPROVED', `Zatwierdzono zamówienie ${orderId}. Vouchery wyemitowane (Rozdano: ${distributedCount}).`, orderId, 'ORDER');
    
    addToast("Zamówienie Zatwierdzone", "Faktury wygenerowane. System oczekuje na płatność.", "SUCCESS");
  }, [orders, users, systemConfig, setVouchers, setUsers, notifyUser, logEvent, addToast, setOrders, setDistributionBatches]);

  // --- BANK PAYMENT (CRITICAL FIX FOR TRUST MODEL) ---
  const handleBankPayment = useCallback((orderId: string, success: boolean) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const company = companies.find(c => c.id === order.companyId);
    if (!company) return;

    if (!success) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.REJECTED } : o));
      logEvent('ORDER_REJECTED', `Brak płatności dla zamówienia ${orderId}.`, orderId, 'ORDER');
      notifyUser('ALL_ADMINS', `Zamówienie ${orderId} odrzucone.`, 'WARNING', undefined, orderId, 'ORDER');
      addToast("Płatność Odrzucona", "Zamówienie anulowano.", "ERROR");
      return;
    }

    // Payment Success
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.PAID } : o));
    
    // 1. Identify vouchers linked to this order
    const orderVouchers = vouchers.filter(v => v.orderId === orderId);
    
    // 2. Count how many are already DISTRIBUTED (Trust Model usage)
    const alreadyDistributedCount = orderVouchers.filter(v => v.status === VoucherStatus.DISTRIBUTED || v.status === VoucherStatus.CONSUMED).length;
    
    // 3. Count how many are RESERVED (Not yet distributed)
    const reservedCount = orderVouchers.filter(v => v.status === VoucherStatus.RESERVED).length;

    // 4. Update RESERVED vouchers to ACTIVE
    setVouchers(prev => prev.map(v => 
        v.orderId === orderId && v.status === VoucherStatus.RESERVED 
        ? { ...v, status: VoucherStatus.ACTIVE } 
        : v
    ));
    
    // 5. CRITICAL FIX: Only add the RESERVED count to the Active Balance.
    if (reservedCount > 0) {
        setCompanies(prev => prev.map(c => 
          c.id === order.companyId 
          ? { ...c, balanceActive: c.balanceActive + reservedCount } 
          : c
        ));
    }

    // Commissions Logic
    const commissionBase = order.feeValue;
    const newCommissions: Commission[] = [];
    const dateCalculated = new Date().toISOString();
    const currentQuarter = getQuarter(new Date());

    if (order.isFirstInvoice) {
        if (company.advisorId) {
            const advisor = users.find(u => u.id === company.advisorId);
            if (advisor) {
                newCommissions.push({
                    id: `COM-${generateUUID()}`,
                    agentId: advisor.id,
                    agentName: advisor.name,
                    role: Role.ADVISOR,
                    type: CommissionType.ACQUISITION,
                    orderId: order.id,
                    amount: commissionBase * COMMISSION_RATES.ADVISOR_FIRST_INVOICE,
                    rate: `${COMMISSION_RATES.ADVISOR_FIRST_INVOICE * 100}%`,
                    dateCalculated,
                    quarter: currentQuarter,
                    isPaid: true
                });
            }
        }
    } else {
        // Prowizja odnawialna 5% - wypłacana co miesiąc za utrzymanie firmy składającej zamówienia
        if (company.advisorId) {
            const advisor = users.find(u => u.id === company.advisorId);
            if (advisor) {
                newCommissions.push({
                    id: `COM-${generateUUID()}-REC`,
                    agentId: advisor.id,
                    agentName: advisor.name,
                    role: Role.ADVISOR,
                    type: CommissionType.RECURRING,
                    orderId: order.id,
                    amount: commissionBase * COMMISSION_RATES.ADVISOR_RECURRING,
                    rate: `${COMMISSION_RATES.ADVISOR_RECURRING * 100}%`,
                    dateCalculated,
                    quarter: currentQuarter,
                    isPaid: true
                });
            }
        }
    }

    setCommissions(prev => [...prev, ...newCommissions]);

    if (newCommissions.length > 0) {
        logEvent('COMMISSION_CALC', `Naliczono ${newCommissions.length} nowych prowizji.`, orderId, 'ORDER');
    }

    logEvent('ORDER_PAID', `Płatność przyjęta. Vouchery Aktywowane. Saldo skorygowane o ${reservedCount} pkt (Trust Model: ${alreadyDistributedCount} już rozdano).`, orderId, 'ORDER');
    notifyUser('ALL_ADMINS', `Faktury za zamówienie ${orderId} opłacone.`, 'SUCCESS', undefined, orderId, 'ORDER');
    
    addToast("Płatność Zatwierdzona", "Zamówienie opłacone. Saldo zaktualizowane.", "SUCCESS");
  }, [orders, companies, users, vouchers, setVouchers, logEvent, notifyUser, addToast, setOrders, setCompanies, setCommissions]);

  return {
      orders,
      setOrders,
      companies,
      setCompanies,
      commissions,
      setCommissions,
      handlePlaceOrder,
      handleApproveOrder,
      handleBankPayment,
      handleAddCompany,
      handleCrmSync
  };
};
