
import { useState, useCallback, useEffect } from 'react';
import { Order, OrderStatus, Company, User, Commission, CommissionType, Role, PayrollEntry, PayrollSnapshot, DistributionBatch, SystemConfig } from '../../types';
import { LogEventFn, NotifyUserFn, AddToastFn } from '../../types/callbacks';
import { calculateOrderTotals, FINANCIAL_CONSTANTS } from '../../utils/financialMath';

// Mapowanie statusu DB → OrderStatus enum
function dbStatusToOrderStatus(s: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    pending:   OrderStatus.PENDING,
    approved:  OrderStatus.APPROVED,
    paid:      OrderStatus.PAID,
    rejected:  OrderStatus.REJECTED,
    cancelled: OrderStatus.REJECTED,
  };
  return map[s] ?? OrderStatus.PENDING;
}

// Mapowanie rekordu z DB → frontend Order
function dbOrderToOrder(o: any): Order {
  return {
    id:              o.id,
    companyId:       o.company_id,
    amount:          o.amount_vouchers,
    voucherValue:    Number(o.amount_pln),
    feeValue:        Number(o.fee_pln),
    totalValue:      Number(o.total_pln),
    docVoucherId:    o.doc_voucher_id ?? '',
    docFeeId:        o.doc_fee_id ?? '',
    date:            o.created_at,
    status:          dbStatusToOrderStatus(o.status),
    isFirstInvoice:  o.is_first_invoice ?? false,
    distributionPlan: o.distribution_plan ?? undefined,
    snapshots:        o.payroll_snapshots ?? undefined,
  };
}

// Mapowanie rekordu z DB → frontend Company
export function dbCompanyToCompany(c: any): Company {
  return {
    id:                       c.id,
    name:                     c.name,
    nip:                      c.nip,
    balanceActive:            c.balance_active ?? 0,
    balancePending:           c.balance_pending ?? 0,
    advisorId:                c.advisor_id   ?? undefined,
    managerId:                c.manager_id   ?? undefined,
    directorId:               c.director_id  ?? undefined,
    address: (c.address_street || c.address_city) ? {
      street:  c.address_street ?? undefined,
      city:    c.address_city   ?? undefined,
      zipCode: c.address_zip    ?? undefined,
    } : undefined,
    customPaymentTermsDays:   c.custom_payment_terms_days   ?? undefined,
    customVoucherValidityDays: c.custom_voucher_validity_days ?? undefined,
    voucherExpiryDay:         c.voucher_expiry_day    ?? undefined,
    voucherExpiryHour:        c.voucher_expiry_hour   ?? undefined,
    voucherExpiryMinute:      c.voucher_expiry_minute ?? undefined,
    origin:          c.origin           ?? 'NATIVE',
    externalCrmId:   c.external_crm_id  ?? undefined,
    isSyncManaged:   c.is_sync_managed  ?? false,
  };
}

export const useOrderLogic = (
    users: User[],
    setUsers: React.Dispatch<React.SetStateAction<User[]>>,
    _vouchers: any,
    _setVouchers: any,
    _setDistributionBatches: React.Dispatch<React.SetStateAction<DistributionBatch[]>>,
    _systemConfig: SystemConfig,
    logEvent: LogEventFn,
    notifyUser: NotifyUserFn,
    addToast: AddToastFn,
    currentUser: User,
    externalCompanies?: Company[],
    setExternalCompanies?: React.Dispatch<React.SetStateAction<Company[]>>
) => {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [_internalCompanies,  _setInternalCompanies]  = useState<Company[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);

  // Use external companies state if provided (Vite/mock mode), else internal (API mode)
  const companies = externalCompanies ?? _internalCompanies;
  const setCompanies = setExternalCompanies ?? _setInternalCompanies;

  // ── Pobierz dane przy starcie ────────────────────────────────────────────────

  useEffect(() => {
    // Skip API fetch if external companies are provided (local/mock mode)
    if (externalCompanies) return;
    fetch('/api/companies')
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => setCompanies(rows.map(dbCompanyToCompany)))
      .catch(() => {});
  }, [externalCompanies]);

  useEffect(() => {
    if (!currentUser?.companyId) return;
    fetch(`/api/orders?companyId=${currentUser.companyId}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(({ data }: { data: any[] }) => setOrders((data ?? []).map(dbOrderToOrder)))
      .catch(() => {});
  }, [currentUser?.companyId]);

  // ── Zarządzanie firmami ──────────────────────────────────────────────────────

  const handleAddCompany = useCallback(async (newCompanyData: Partial<Company>) => {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:                     newCompanyData.name,
        nip:                      newCompanyData.nip,
        advisorId:                newCompanyData.advisorId,
        managerId:                newCompanyData.managerId,
        directorId:               newCompanyData.directorId,
        customPaymentTermsDays:   newCompanyData.customPaymentTermsDays,
        customVoucherValidityDays: newCompanyData.customVoucherValidityDays,
        address_street:           newCompanyData.address?.street,
        address_city:             newCompanyData.address?.city,
        address_zip:              newCompanyData.address?.zipCode,
      }),
    });

    if (!res.ok) {
      addToast('Błąd', 'Nie udało się dodać firmy.', 'ERROR');
      return;
    }

    const company = dbCompanyToCompany(await res.json());
    setCompanies(prev => [...prev, company]);
    logEvent('COMPANY_CREATED', `Utworzono nową firmę: ${company.name} (${company.id})`, company.id, 'COMPANY');
    addToast('Firma Dodana', `Firma ${company.name} została dodana do bazy.`, 'SUCCESS');
  }, [logEvent, addToast]);

  const handleCrmSync = useCallback(async () => {
    const res = await fetch('/api/companies/sync-crm', { method: 'POST' });

    if (!res.ok) {
      addToast('Błąd', 'Synchronizacja CRM nie powiodła się.', 'ERROR');
      return;
    }

    const result = await res.json();
    const { imported, skipped } = result;

    if (imported > 0) {
      // Odśwież listę firm
      const refreshRes = await fetch('/api/companies');
      if (refreshRes.ok) {
        const rows: any[] = await refreshRes.json();
        setCompanies(rows.map(dbCompanyToCompany));
      }
      logEvent('CRM_SYNC_SUCCESS', `Pobrano ${imported} nowych firm ze statusu SIGNED. Pominięto: ${skipped}.`, 'CRM', 'SYSTEM');
      addToast('Synchronizacja CRM', `Pomyślnie zaimportowano ${imported} firm. Dane handlowe zaktualizowane.`, 'SUCCESS');
    } else {
      addToast('Synchronizacja CRM', 'Brak nowych firm o statusie SIGNED w systemie źródłowym.', 'INFO');
    }
  }, [logEvent, addToast]);

  // ── Zamówienia ───────────────────────────────────────────────────────────────

  const handlePlaceOrder = useCallback(async (amount: number, distributionPlan?: PayrollEntry[]): Promise<string | undefined> => {
    if (!currentUser.companyId) return undefined;

    let snapshots: PayrollSnapshot[] | undefined;
    if (distributionPlan && distributionPlan.length > 0) {
      const { createSnapshot } = await import('../../services/payrollService');
      snapshots = distributionPlan.map(entry => createSnapshot(entry));
    }

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId:        currentUser.companyId,
        hrUserId:         currentUser.id,
        amount,
        distributionPlan: distributionPlan ?? undefined,
        snapshots:        snapshots ?? undefined,
      }),
    });

    if (!res.ok) {
      // Tryb lokalny — API niedostępne lub błąd (np. mock ID). Dodaj zamówienie do stanu lokalnego.
      const totals = calculateOrderTotals(amount, FINANCIAL_CONSTANTS.DEFAULT_SUCCESS_FEE);
      const now = new Date().toISOString();
      const year = new Date().getFullYear();
      const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
      const localOrder: Order = {
        id: `ORD-LOCAL-${Date.now()}`,
        companyId: currentUser.companyId!,
        amount,
        voucherValue: totals.voucherValue,
        feeValue: totals.feeGross,
        totalValue: totals.totalPayable,
        docVoucherId: `NK/${year}/${suffix}/B`,
        docFeeId: `FV/${year}/${suffix}/S`,
        date: now,
        status: OrderStatus.PENDING,
        isFirstInvoice: orders.length === 0,
        distributionPlan,
        snapshots,
      };
      setOrders(prev => [...prev, localOrder]);
      const methodMsg = snapshots ? ` (z planem auto-dystrybucji: ${snapshots.length} os.)` : '';
      logEvent('ORDER_CREATED', `Złożono zamówienie ${localOrder.id}${methodMsg} (tryb lokalny).`, localOrder.id, 'ORDER');
      notifyUser('ALL_ADMINS', `Nowe zamówienie ${localOrder.id.slice(-8)} (${totals.totalPayable.toFixed(2)} PLN) czeka na akceptację.`, 'WARNING', {
        type: 'APPROVE_ORDER', targetId: localOrder.id, label: 'Zatwierdź Zamówienie', variant: 'primary',
      }, localOrder.id, 'ORDER');
      addToast('Zamówienie Przyjęte', `Zamówienie złożone. ${snapshots ? 'System zamroził stawkę i podział (Snapshot).' : 'Pobierz dokumenty z tabeli historii.'}`, 'SUCCESS');
      return localOrder.id;
    }

    const newOrder = dbOrderToOrder(await res.json());
    setOrders(prev => [...prev, newOrder]);

    const methodMsg = snapshots ? ` (z planem auto-dystrybucji: ${snapshots.length} os. — SNAPSHOT ZAPISANY)` : '';
    logEvent('ORDER_CREATED', `Złożono zamówienie ${newOrder.id}${methodMsg}. Dok: ${newOrder.docVoucherId} i ${newOrder.docFeeId}.`, newOrder.id, 'ORDER');

    notifyUser('ALL_ADMINS', `Nowe zamówienie ${newOrder.id.slice(-8)} (${newOrder.totalValue.toFixed(2)} PLN) czeka na akceptację.`, 'WARNING', {
      type: 'APPROVE_ORDER', targetId: newOrder.id, label: 'Zatwierdź Zamówienie', variant: 'primary',
    }, newOrder.id, 'ORDER');

    addToast(
      'Zamówienie Przyjęte',
      `Utworzono zamówienie. ${snapshots ? 'System zamroził stawkę i podział (Snapshot).' : 'Pobierz dokumenty z tabeli historii.'}`,
      'SUCCESS'
    );
    return newOrder.id;
  }, [currentUser, logEvent, notifyUser, addToast]);

  const handleApproveOrder = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== OrderStatus.PENDING) {
      addToast('Info', 'To zamówienie zostało już przetworzone.', 'INFO');
      return;
    }

    // Optimistic
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.APPROVED } : o));

    const res = await fetch(`/api/orders/${orderId}/approve`, { method: 'PATCH' });

    if (!res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.PENDING } : o));
      addToast('Błąd', 'Nie udało się zatwierdzić zamówienia.', 'ERROR');
      return;
    }

    const { distributed } = await res.json();

    const hrUser = users.find(u => u.companyId === order.companyId && u.role === Role.HR);
    if (hrUser) {
      const msg = distributed > 0
        ? `Zamówienie ${orderId.slice(-8)} zatwierdzone. Vouchery rozdane automatycznie (Trust Model). Faktura do opłacenia w ciągu 7 dni.`
        : `Zamówienie ${orderId.slice(-8)} zatwierdzone. Vouchery dostępne do rozdania.`;
      notifyUser(hrUser.id, msg, 'SUCCESS', undefined, orderId, 'ORDER');
    }

    logEvent('ORDER_APPROVED', `Zatwierdzono zamówienie ${orderId}. Vouchery wyemitowane (Rozdano: ${distributed}).`, orderId, 'ORDER');
    addToast('Zamówienie Zatwierdzone', 'Faktury wygenerowane. System oczekuje na płatność.', 'SUCCESS');
  }, [orders, users, notifyUser, logEvent, addToast]);

  const handleBankPayment = useCallback(async (orderId: string, success: boolean) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (!success) {
      // Optimistic
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.REJECTED } : o));

      const res = await fetch(`/api/orders/${orderId}/reject`, { method: 'PATCH' });
      if (!res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: order.status } : o));
        addToast('Błąd', 'Nie udało się odrzucić zamówienia.', 'ERROR');
        return;
      }

      logEvent('ORDER_REJECTED', `Brak płatności dla zamówienia ${orderId}.`, orderId, 'ORDER');
      notifyUser('ALL_ADMINS', `Zamówienie ${orderId.slice(-8)} odrzucone.`, 'WARNING', undefined, orderId, 'ORDER');
      addToast('Płatność Odrzucona', 'Zamówienie anulowano.', 'ERROR');
      return;
    }

    // Payment success — optimistic
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.PAID } : o));

    const res = await fetch(`/api/orders/${orderId}/pay`, { method: 'PATCH' });
    if (!res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: order.status } : o));
      addToast('Błąd', 'Nie udało się potwierdzić płatności.', 'ERROR');
      return;
    }

    logEvent('ORDER_PAID', `Płatność przyjęta dla zamówienia ${orderId}. Prowizje naliczone.`, orderId, 'ORDER');
    notifyUser('ALL_ADMINS', `Faktury za zamówienie ${orderId.slice(-8)} opłacone.`, 'SUCCESS', undefined, orderId, 'ORDER');
    addToast('Płatność Zatwierdzona', 'Zamówienie opłacone. Saldo zaktualizowane.', 'SUCCESS');
  }, [orders, logEvent, notifyUser, addToast]);

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
    handleCrmSync,
  };
};
