
import React, { useState, useCallback, useEffect } from 'react';
import {
  Voucher, VoucherStatus, BuybackAgreement, Transaction, User, Company,
  ServiceItem, DistributionBatch, NotificationConfig, SystemConfig,
} from '../../types';
import { LogEventFn, NotifyUserFn, AddToastFn } from '../../types/callbacks';

// ── Mapowanie DB → typy frontendowe ─────────────────────────────────────────

function dbStatusToEnum(s: string): VoucherStatus {
  const map: Record<string, VoucherStatus> = {
    created:          VoucherStatus.CREATED,
    reserved:         VoucherStatus.RESERVED,
    active:           VoucherStatus.ACTIVE,
    distributed:      VoucherStatus.DISTRIBUTED,
    consumed:         VoucherStatus.CONSUMED,
    expired:          VoucherStatus.EXPIRED,
    buyback_pending:  VoucherStatus.BUYBACK_PENDING,
    buyback_complete: VoucherStatus.BUYBACK_COMPLETE,
  };
  return map[s] ?? VoucherStatus.CREATED;
}

function dbVoucherToFrontend(v: any): Voucher {
  return {
    id:         v.id,
    value:      1,
    status:     dbStatusToEnum(v.status),
    companyId:  v.company_id,
    emissionId: v.emission_id ?? '',
    ownerId:    v.current_owner_id ?? undefined,
    expiryDate: v.valid_until ?? v.expires_at ?? undefined,
    issueDate:  v.issued_at       ?? new Date().toISOString(),
  };
}

function dbBuybackToFrontend(b: any): BuybackAgreement {
  return {
    id:            b.id,
    userId:        b.user_id,
    voucherCount:  b.voucher_count,
    totalValue:    b.total_value,
    dateGenerated: b.created_at,
    status:        b.status?.toUpperCase() ?? 'PENDING_APPROVAL',
    snapshot:      b.snapshot ?? { user: {}, vouchers: [], termsVersion: '1.0' },
  };
}

function dbTransactionToFrontend(t: any): Transaction {
  return {
    id:          t.id,
    userId:      t.to_user_id ?? t.from_user_id,
    type:        t.transaction_type === 'redemption' ? 'DEBIT' : 'CREDIT',
    serviceId:   t.service_id   ?? undefined,
    serviceName: t.service_name ?? undefined,
    amount:      t.amount,
    date:        t.created_at,
  };
}

function dbBatchToFrontend(b: any): DistributionBatch {
  return {
    id:          b.id,
    companyId:   b.company_id,
    date:        b.created_at,
    hrName:      b.hr_name,
    totalAmount: b.total_amount,
    items:       (b.items ?? []).map((i: any) => ({
      userId:   i.user_id,
      userName: i.user_name,
      amount:   i.amount,
    })),
    status: 'COMPLETED',
  };
}

export const useVoucherLogic = (
    users: User[],
    setUsers: React.Dispatch<React.SetStateAction<User[]>>,
    companies: Company[],
    setCompanies: React.Dispatch<React.SetStateAction<Company[]>>,
    _notificationConfigs: NotificationConfig[],
    _systemConfig: SystemConfig,
    logEvent: LogEventFn,
    notifyUser: NotifyUserFn,
    addToast: AddToastFn,
    currentUser: User
) => {
  const [vouchers,           setVouchers]           = useState<Voucher[]>([]);
  const [buybacks,           setBuybacks]           = useState<BuybackAgreement[]>([]);
  const [transactions,       setTransactions]       = useState<Transaction[]>([]);
  const [distributionBatches, setDistributionBatches] = useState<DistributionBatch[]>([]);

  // ── Wczytaj dane przy starcie ─────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser?.id) return;

    const companyId = currentUser.companyId;

    // Vouchery: HR widzi wszystkie firmy, pracownik — swoje
    if (companyId) {
      fetch(`/api/vouchers?companyId=${companyId}`)
        .then(r => r.ok ? r.json() : [])
        .then((rows: any[]) => setVouchers(rows.map(dbVoucherToFrontend)))
        .catch(() => {});
    } else if (!companyId && currentUser.role === 'SUPERADMIN') {
      // Superadmin może pobierać vouchery per firma — na razie puste
    }

    // Buybacki
    fetch('/api/vouchers/buybacks')
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => setBuybacks(rows.map(dbBuybackToFrontend)))
      .catch(() => {});

    // Transakcje
    fetch(`/api/vouchers/transactions?userId=${currentUser.id}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => setTransactions(rows.map(dbTransactionToFrontend)))
      .catch(() => {});
  }, [currentUser?.id, currentUser?.companyId, currentUser?.role]);

  // ── Ręczna emisja (superadmin) ────────────────────────────────────────────

  const handleManualEmission = useCallback(async (amount: number, description: string) => {
    if (amount <= 0) {
      addToast('Błąd Emisji', 'Kwota musi być większa od zera.', 'ERROR');
      return;
    }

    const res = await fetch('/api/vouchers/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, description }),
    });

    if (!res.ok) {
      addToast('Błąd', 'Nie udało się wyemitować voucherów.', 'ERROR');
      return;
    }

    const { emissionId } = await res.json();
    logEvent('MANUAL_EMISSION', `Wyemitowano ręcznie ${amount} voucherów. Emisja: ${emissionId}. Powód: ${description}`);
    notifyUser('ALL_ADMINS', `Nowa emisja manualna: ${amount} pkt. ID: ${emissionId}`, 'INFO');
    addToast('Emisja Zakończona', `Wyemitowano ${amount} voucherów do puli platformy.`, 'SUCCESS');
  }, [logEvent, notifyUser, addToast]);

  // ── Dystrybucja pojedyncza ────────────────────────────────────────────────

  const handleDistribute = useCallback(async (employeeId: string, amount: number) => {
    const companyId = currentUser.companyId;
    if (!companyId) return;

    const targetUser = users.find(u => u.id === employeeId);
    if (!targetUser || targetUser.status === 'INACTIVE') {
      addToast('Błąd Dystrybucji', 'Pracownik nieaktywny lub nie znaleziony.', 'ERROR');
      return;
    }

    // Optimistic: zaktualizuj salda w UI
    setUsers(prev => prev.map(u =>
      u.id === employeeId ? { ...u, voucherBalance: u.voucherBalance + amount } : u
    ));
    setCompanies(prev => prev.map(c =>
      c.id === companyId ? { ...c, balanceActive: Math.max(0, c.balanceActive - amount) } : c
    ));

    const res = await fetch('/api/vouchers/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, amount }),
    });

    if (!res.ok) {
      // Rollback
      setUsers(prev => prev.map(u =>
        u.id === employeeId ? { ...u, voucherBalance: u.voucherBalance - amount } : u
      ));
      setCompanies(prev => prev.map(c =>
        c.id === companyId ? { ...c, balanceActive: c.balanceActive + amount } : c
      ));
      const err = await res.json().catch(() => ({}));
      addToast('Błąd Dystrybucji', err.error ?? 'Nie udało się przekazać voucherów.', 'ERROR');
      return;
    }

    const { batchId } = await res.json();

    // Dodaj batch do historii (bez pełnych danych items — odświeżymy jeśli potrzeba)
    const newBatch: DistributionBatch = {
      id:          batchId,
      companyId:   companyId,
      date:        new Date().toISOString(),
      hrName:      currentUser.name,
      totalAmount: amount,
      items:       [{ userId: targetUser.id, userName: targetUser.name, amount }],
      status:      'COMPLETED',
    };
    setDistributionBatches(prev => [newBatch, ...prev]);

    logEvent('VOUCHER_DISTRIBUTED', `Przekazano ${amount} voucherów dla pracownika ${employeeId}. Protokół: ${batchId}`, employeeId, 'USER');
    notifyUser(employeeId, `Otrzymałeś ${amount} nowych voucherów!`, 'SUCCESS');
    addToast('Vouchery Przekazane', `Przekazano ${amount} pkt. Protokół zapisany w Teczce.`, 'SUCCESS');
  }, [currentUser, users, logEvent, notifyUser, addToast]);

  // ── Dystrybucja masowa ────────────────────────────────────────────────────

  const handleBulkDistribute = useCallback(async (items: { employeeId: string; amount: number }[]) => {
    const companyId = currentUser.companyId;
    if (!companyId) {
      addToast('Błąd', 'Nie zidentyfikowano firmy użytkownika.', 'ERROR');
      return;
    }

    const totalNeeded = items.reduce((acc, i) => acc + i.amount, 0);

    // Optimistic
    setUsers(prev => {
      const copy = [...prev];
      for (const item of items) {
        const idx = copy.findIndex(u => u.id === item.employeeId);
        if (idx > -1) copy[idx] = { ...copy[idx], voucherBalance: copy[idx].voucherBalance + item.amount };
      }
      return copy;
    });
    setCompanies(prev => prev.map(c =>
      c.id === companyId ? { ...c, balanceActive: Math.max(0, c.balanceActive - totalNeeded) } : c
    ));

    const res = await fetch('/api/vouchers/bulk-distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(i => ({ employeeId: i.employeeId, amount: i.amount })) }),
    });

    if (!res.ok) {
      // Rollback
      setUsers(prev => {
        const copy = [...prev];
        for (const item of items) {
          const idx = copy.findIndex(u => u.id === item.employeeId);
          if (idx > -1) copy[idx] = { ...copy[idx], voucherBalance: copy[idx].voucherBalance - item.amount };
        }
        return copy;
      });
      setCompanies(prev => prev.map(c =>
        c.id === companyId ? { ...c, balanceActive: c.balanceActive + totalNeeded } : c
      ));
      addToast('Błąd Masowy', 'Nie udało się przeprowadzić masowej dystrybucji.', 'ERROR');
      return;
    }

    const { distributed, batchId } = await res.json();

    if (batchId) {
      const batchItems = items.map(item => {
        const u = users.find(u => u.id === item.employeeId);
        return { userId: item.employeeId, userName: u?.name ?? item.employeeId, amount: item.amount };
      });

      const newBatch: DistributionBatch = {
        id:          batchId,
        companyId:   companyId,
        date:        new Date().toISOString(),
        hrName:      currentUser.name,
        totalAmount: distributed,
        items:       batchItems,
        status:      'COMPLETED',
      };
      setDistributionBatches(prev => [newBatch, ...prev]);
    }

    logEvent('BULK_DISTRIBUTION', `Rozdano masowo ${distributed} pkt dla ${items.length} pracowników. Protokół: ${batchId}`, currentUser.id, 'BULK');
    addToast(
      'Masowa Dystrybucja Zakończona',
      `Pomyślnie rozdano ${distributed} pkt. Protokół wygenerowany w Teczce Dokumentów.`,
      'SUCCESS'
    );
  }, [currentUser, users, logEvent, notifyUser, addToast]);

  // ── Zakup usługi (pracownik) ──────────────────────────────────────────────

  const handleServicePurchase = useCallback(async (service: ServiceItem) => {
    if ((currentUser.voucherBalance ?? 0) < service.price) {
      addToast('Transakcja Odrzucona', 'Niewystarczające środki.', 'ERROR');
      return;
    }

    // Optimistic
    setUsers(prev => prev.map(u =>
      u.id === currentUser.id ? { ...u, voucherBalance: u.voucherBalance - service.price } : u
    ));

    const res = await fetch('/api/vouchers/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: service.id, serviceName: service.name, amount: service.price }),
    });

    if (!res.ok) {
      setUsers(prev => prev.map(u =>
        u.id === currentUser.id ? { ...u, voucherBalance: u.voucherBalance + service.price } : u
      ));
      addToast('Transakcja Odrzucona', 'Nie udało się zrealizować zakupu.', 'ERROR');
      return;
    }

    const newTx: Transaction = {
      id:          `TRX-${Date.now()}`,
      userId:      currentUser.id,
      type:        'DEBIT',
      serviceId:   service.id,
      serviceName: service.name,
      amount:      service.price,
      date:        new Date().toISOString(),
    };
    setTransactions(prev => [newTx, ...prev]);

    logEvent('SERVICE_CONSUMPTION', `Zakup usługi: ${service.name}.`, currentUser.id, 'USER');
    notifyUser(currentUser.id, `Zakupiono: ${service.name}.`, 'SUCCESS');
    addToast('Usługa Aktywowana', `Pobrano ${service.price} pkt.`, 'SUCCESS');
  }, [currentUser, logEvent, notifyUser, addToast]);

  // ── Symulacja wygaśnięcia (superadmin) ────────────────────────────────────

  const simulateExpiration = useCallback(async () => {
    const res = await fetch('/api/vouchers/simulate-expiration', { method: 'POST' });

    if (!res.ok) {
      addToast('Błąd', 'Symulacja nie powiodła się.', 'ERROR');
      return;
    }

    const { agreements, message } = await res.json();

    if (message) {
      addToast('Symulacja Zatrzymana', message, 'INFO');
      return;
    }

    // Wczytaj nowe buybacki
    fetch('/api/vouchers/buybacks')
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => setBuybacks(rows.map(dbBuybackToFrontend)))
      .catch(() => {});

    // Powiadom zainteresowanych użytkowników
    for (const a of (agreements ?? [])) {
      notifyUser(a.userId, `Twoje vouchery (${a.count} szt.) wygasły. Wygenerowano umowę odkupu.`, 'WARNING', undefined, a.agreementId, 'BUYBACK');
    }

    addToast('Symulacja Zakończona', `Wygaszono vouchery dla ${agreements?.length ?? 0} osób.`, 'SUCCESS');
  }, [notifyUser, addToast]);

  // ── Zatwierdzenie odkupu ──────────────────────────────────────────────────

  const handleApproveBuyback = useCallback(async (buybackId: string) => {
    setBuybacks(prev => prev.map(b => b.id === buybackId ? { ...b, status: 'APPROVED' } : b));

    const res = await fetch(`/api/vouchers/buybacks/${buybackId}/approve`, { method: 'PATCH' });

    if (!res.ok) {
      setBuybacks(prev => prev.map(b => b.id === buybackId ? { ...b, status: 'PENDING_APPROVAL' } : b));
      addToast('Błąd', 'Nie udało się zatwierdzić odkupu.', 'ERROR');
      return;
    }

    logEvent('BUYBACK_APPROVED', `Zatwierdzono odkup ${buybackId}.`, buybackId, 'BUYBACK');
    addToast('Odkup Zatwierdzony', 'Umowa zatwierdzona.', 'SUCCESS');
  }, [logEvent, addToast]);

  // ── Wypłata odkupu ────────────────────────────────────────────────────────

  const handleProcessBuybackPayment = useCallback(async (buybackId: string, _details?: { date: string; reference?: string }) => {
    setBuybacks(prev => prev.map(b => b.id === buybackId ? { ...b, status: 'PAID' } : b));

    const res = await fetch(`/api/vouchers/buybacks/${buybackId}/pay`, { method: 'PATCH' });

    if (!res.ok) {
      setBuybacks(prev => prev.map(b => b.id === buybackId ? { ...b, status: 'APPROVED' } : b));
      addToast('Błąd', 'Nie udało się zaksięgować wypłaty.', 'ERROR');
      return;
    }

    logEvent('BUYBACK_PAID', `Zaksięgowano płatność za odkup ${buybackId}.`, buybackId, 'BUYBACK');
    addToast('Wypłata Zaksięgowana', 'Środki wysłane.', 'SUCCESS');
  }, [logEvent, addToast]);

  return {
    vouchers,
    setVouchers,
    buybacks,
    setBuybacks,
    transactions,
    setTransactions,
    distributionBatches,
    setDistributionBatches,
    handleManualEmission,
    handleDistribute,
    handleBulkDistribute,
    handleServicePurchase,
    simulateExpiration,
    handleApproveBuyback,
    handleProcessBuybackPayment,
  };
};
