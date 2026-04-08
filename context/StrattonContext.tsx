
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { 
  User, Voucher, Company, Order, BuybackAgreement, AuditLogEntry, 
  Commission, QuarterlyPerformance, Notification, NotificationConfig, ServiceItem, Transaction,
  SystemConfig, ImportHistoryEntry, PayrollEntry, NotificationAction, UserFinance, SupportTicket, TicketMessage, TicketCategory, TicketPriority, Role, TicketStatus, DistributionBatch
} from '../types';
import { 
  INITIAL_AUDIT_LOGS, 
  INITIAL_SERVICES, INITIAL_SYSTEM_CONFIG, INITIAL_TICKETS
} from '../services/mockData';
import { dbCompanyToCompany } from '../hooks/modules/useOrderLogic';
import { ToastMessage, ToastType } from '../components/Toast';
import { generatePayrollTemplate, parseAndMatchPayroll, generateUUID } from '../services/payrollService';

// Import Modular Hooks
import { useNotificationLogic } from '../hooks/modules/useNotificationLogic';
import { useUserLogic } from '../hooks/modules/useUserLogic';
import { useOrderLogic } from '../hooks/modules/useOrderLogic';
import { useVoucherLogic } from '../hooks/modules/useVoucherLogic';
import { usePersistedState } from '../hooks/usePersistedState';

// Placeholder passed to useUserLogic before currentUser is resolved.
// Callbacks that use currentUser (e.g. handleBulkImport) are only invoked
// after login, so at runtime the persisted user is always available.
const UNRESOLVED_USER: User = {
  id: '', name: '', email: '', role: Role.EMPLOYEE,
  status: 'INACTIVE', companyId: '',
  isTwoFactorEnabled: false,
  contract: { type: 'UOP' as any, startDate: '' },
  finance: { voucherBalance: 0, cashBalance: 0, totalEarned: 0 },
  address: {},
  identity: {},
  organization: {},
} as unknown as User;

interface StrattonContextType {
  state: {
    currentUser: User | null; // Nullable for auth check
    users: User[];
    vouchers: Voucher[];
    companies: Company[];
    orders: Order[];
    buybacks: BuybackAgreement[];
    auditLogs: AuditLogEntry[];
    commissions: Commission[];
    quarterlyStats: QuarterlyPerformance[];
    notifications: Notification[];
    notificationConfigs: NotificationConfig[];
    services: ServiceItem[];
    transactions: Transaction[];
    importHistory: ImportHistoryEntry[];
    distributionBatches: DistributionBatch[]; // NEW: Exported to state
    systemConfig: SystemConfig;
    toasts: ToastMessage[];
    tickets: SupportTicket[]; 
  };
  actions: {
    login: (userId: string) => void; 
    loginWithUser: (user: User) => void;
    logout: () => void; 
    switchUser: (userId: string) => void;
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    handleUpdateSystemConfig: (newConfig: SystemConfig) => void;
    handleUpdateNotificationConfig: (updatedConfig: NotificationConfig) => void;
    handleUpdateCompanyConfig: (companyId: string, updates: Partial<Company>) => void;
    handleAddCompany: (newCompanyData: Partial<Company>) => void;
    handleCrmSync: () => Promise<void>; 
    handleManualEmission: (amount: number, description: string) => void;
    handlePlaceOrder: (amount: number, distributionPlan?: PayrollEntry[]) => Promise<string | undefined>;
    handleApproveOrder: (orderId: string) => void;
    handleBankPayment: (orderId: string, success: boolean) => void;
    handleDistribute: (employeeId: string, amount: number) => void;
    handleBulkDistribute: (items: { employeeId: string; amount: number }[]) => void; 
    handleDeactivateEmployee: (employeeId: string) => void;
    handleUpdateEmployee: (userId: string, data: Partial<User>) => void;
    handleBulkImport: (validRows: any[], overrideCompanyId?: string) => Promise<any>;
    handleServicePurchase: (service: ServiceItem) => void;
    simulateExpiration: () => void;
    handleApproveBuyback: (buybackId: string) => void;
    handleProcessBuybackPayment: (buybackId: string) => void;
    handleMarkNotificationsRead: () => void;
    handleMarkSingleNotificationRead: (notificationId: string) => void;
    handleExportPayrollTemplate: (usersToExport: User[]) => void;
    handleParseAndMatchPayroll: (file: File) => Promise<PayrollEntry[]>;
    handleNotificationAction: (notificationId: string, action: NotificationAction) => void;
    handleClearNotifications: () => void;
    handleUpdateUserFinance: (userId: string, financeData: UserFinance) => void;
    handleRequestIbanChange: (userId: string, newIban: string, reason: string) => void;
    handleResolveIbanChange: (userId: string, approved: boolean, rejectionReason?: string) => void;
    handleManageService: (action: 'ADD' | 'UPDATE' | 'DELETE', service: ServiceItem) => void;
    handleCreateTicket: (subject: string, category: TicketCategory, priority: TicketPriority, message: string, relatedEntityId?: string) => void;
    handleReplyTicket: (ticketId: string, message: string) => void;
    handleUpdateTicketStatus: (ticketId: string, status: TicketStatus) => void;
    handleAnonymizeUser: (userId: string) => void;
    handleToggleTwoFactor: (userId: string, enabled: boolean) => void; 
    fetchUsersFromApi: () => Promise<void>;
    addToast: (title: string, message: string, type: ToastType) => void;
    removeToast: (id: string) => void;
  };
}

const StrattonContext = createContext<StrattonContextType | undefined>(undefined);

export const StrattonProvider = ({ children }: { children?: ReactNode }) => {
  // --- AUTH SESSION STATE ---
  const [currentUserId, setCurrentUserId] = usePersistedState<string | null>('ebs_session_user_v1', null);

  const [systemConfig, setSystemConfig] = usePersistedState<SystemConfig>('ebs_sys_config_v1', INITIAL_SYSTEM_CONFIG);
  const [auditLogs, setAuditLogs] = usePersistedState<AuditLogEntry[]>('ebs_audit_logs_v1', INITIAL_AUDIT_LOGS);
  const [services, setServices] = usePersistedState<ServiceItem[]>('ebs_services_v15', INITIAL_SERVICES);
  const [quarterlyStats, setQuarterlyStats] = useState<QuarterlyPerformance[]>([]);
  const [tickets, setTickets] = usePersistedState<SupportTicket[]>('ebs_tickets_v1', INITIAL_TICKETS);

  // FORCE UPDATE SERVICES IF NEEDED
  React.useEffect(() => {
    // Check if services need update (image presence check)
    // We check if the FIRST service (Mental Health) has an image in STATE.
    // If not, but INITIAL_SERVICES has it, we force reload.
    const mentalHealthService = services.find(s => s.id === 'SRV-MENTAL-01');
    const initialMentalHealth = INITIAL_SERVICES.find(s => s.id === 'SRV-MENTAL-01');
    // REMOVED FUEL CARD CHECK

    const needsImageUpdate = (mentalHealthService && !mentalHealthService.image && initialMentalHealth?.image);
    
    // Also check for new categories if they are missing entirely
    const hasAI = services.some(s => s.id.startsWith('SRV-AI'));

    // Check if Fuel Card is STILL present in state (should be removed)
    const hasFuelCard = services.some(s => s.id === 'SRV-05');

    // Check for any service not belonging to current INITIAL_SERVICES (e.g. old Orange/Światłowód services)
    const hasUnknownServices = services.some(s => !INITIAL_SERVICES.some(is => is.id === s.id));

    // Check if any current service is missing its image URL
    const hasMissingImages = services.some(s => INITIAL_SERVICES.some(is => is.id === s.id) && !s.image);

    if (needsImageUpdate || !hasAI || hasFuelCard || hasUnknownServices || hasMissingImages) {
        setServices(INITIAL_SERVICES);
    }
  }, [services, setServices]); 

  // --- Helpers ---
  const logEvent = useCallback((action: string, details: string, targetEntityId?: string, targetEntityType?: any) => {
    const newLog: AuditLogEntry = {
      id: `LOG-${generateUUID()}`,
      timestamp: new Date().toISOString(),
      actorId: currentUserId || 'SYSTEM',
      actorName: 'System/User', 
      action,
      details,
      targetEntityId,
      targetEntityType
    };
    setAuditLogs(prev => [newLog, ...prev]);
  }, [currentUserId]);

  // --- MODULES ---
  const notifLogic = useNotificationLogic('SUPERADMIN', currentUserId || '');
  const userLogic = useUserLogic(
      [],
      logEvent,
      notifLogic.notifyUser,
      notifLogic.addToast,
      // currentUser cannot be derived yet — resolved from userLogic.users below
      UNRESOLVED_USER
  );

  const currentUser = userLogic.users.find(u => u.id === currentUserId) || null;

  // --- Fetch użytkowników z Supabase gdy currentUserId jest znany ---
  const { fetchUsersFromApi } = userLogic;
  React.useEffect(() => {
    if (!currentUserId) return;
    fetchUsersFromApi();
  }, [currentUserId, fetchUsersFromApi]);

  const [companies, setCompanies] = useState<Company[]>([]);

  // Pobierz firmy z API (nie localStorage) gdy użytkownik jest zalogowany
  React.useEffect(() => {
    if (!currentUserId) return;
    // Clear stale cache from old localStorage key
    try { window.localStorage.removeItem('ebs_companies_v3'); } catch {}
    fetch('/api/companies')
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => setCompanies(rows.map(dbCompanyToCompany)))
      .catch(() => {});
  }, [currentUserId]);

  const voucherLogic = useVoucherLogic(
      userLogic.users,
      userLogic.setUsers,
      companies,
      setCompanies,
      notifLogic.notificationConfigs,
      systemConfig,
      logEvent,
      notifLogic.notifyUser,
      notifLogic.addToast,
      currentUser ?? UNRESOLVED_USER
  );

  const orderLogic = useOrderLogic(
      userLogic.users,
      userLogic.setUsers,
      voucherLogic.vouchers,
      voucherLogic.setVouchers,
      voucherLogic.setDistributionBatches,
      systemConfig,
      logEvent,
      notifLogic.notifyUser,
      notifLogic.addToast,
      currentUser ?? UNRESOLVED_USER,
      companies,
      setCompanies
  );

  // --- ACTIONS (Memoized to prevent unnecessary re-renders) ---

  const login = useCallback((userId: string) => {
      setCurrentUserId(userId);
      const user = userLogic.users.find(u => u.id === userId);
      if (user) {
          notifLogic.addToast("Zalogowano pomyślnie", `Witaj, ${user.name}`, "SUCCESS");
      }
  }, [setCurrentUserId, userLogic.users, notifLogic.addToast]);

  const loginWithUser = useCallback((user: User) => {
      userLogic.setUsers(prev => prev.some(u => u.id === user.id) ? prev : [...prev, user]);
      setCurrentUserId(user.id);
      notifLogic.addToast("Zalogowano pomyślnie", `Witaj, ${user.name}`, "SUCCESS");
  }, [setCurrentUserId, userLogic.setUsers, notifLogic.addToast]);

  const logout = useCallback(() => {
      setCurrentUserId(null);
      notifLogic.addToast("Wylogowano", "Sesja została zakończona.", "INFO");
  }, [setCurrentUserId, notifLogic.addToast]);

  const switchUser = useCallback((userId: string) => {
    login(userId);
  }, [login]);

  const handleUpdateSystemConfig = useCallback((newConfig: SystemConfig) => {
    setSystemConfig(newConfig);
    logEvent('SYSTEM_CONFIG_UPDATE', `Zmieniono konfigurację systemu.`);
    notifLogic.addToast("Konfiguracja Zapisana", "Zaktualizowano globalne ustawienia systemu.", "SUCCESS");
  }, [setSystemConfig, logEvent, notifLogic.addToast]);

  const handleUpdateCompanyConfig = useCallback((companyId: string, updates: Partial<Company>) => {
    orderLogic.setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ...updates } : c));
    logEvent('COMPANY_CONFIG_UPDATE', `Zaktualizowano konfigurację firmy ${companyId}.`, companyId, 'COMPANY');
    notifLogic.addToast("Firma Zaktualizowana", "Ustawienia firmy zostały zapisane.", "SUCCESS");
  }, [orderLogic.setCompanies, logEvent, notifLogic.addToast]);

  const handleExportPayrollTemplate = useCallback((usersToExport: User[]) => {
      const success = generatePayrollTemplate(usersToExport);
      if (success) notifLogic.addToast("Eksport Szablonu", "Plik wygenerowany.", "SUCCESS");
      else notifLogic.addToast("Błąd Eksportu", "Wystąpił błąd.", "ERROR");
  }, [notifLogic.addToast]);

  const handleParseAndMatchPayroll = useCallback(async (file: File): Promise<PayrollEntry[]> => {
      try {
        return await parseAndMatchPayroll(file, userLogic.users);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Nieznany błąd parsowania pliku.';
        notifLogic.addToast('Błąd importu', message, 'ERROR');
        return [];
      }
  }, [userLogic.users, notifLogic.addToast]);

  const handleNotificationAction = useCallback((notificationId: string, action: NotificationAction) => {
      if (action.type === 'APPROVE_ORDER') orderLogic.handleApproveOrder(action.targetId);
      else if (action.type === 'APPROVE_BUYBACK') voucherLogic.handleApproveBuyback(action.targetId);
      
      notifLogic.setNotifications(prev => prev.map(n => 
          n.id === notificationId 
          ? { ...n, read: true, action: { ...n.action!, completed: true, completedLabel: 'Zatwierdzono' } } : n
      ));
  }, [orderLogic.handleApproveOrder, voucherLogic.handleApproveBuyback, notifLogic.setNotifications]);

  // --- SERVICE MANAGEMENT ---
  const handleManageService = useCallback((action: 'ADD' | 'UPDATE' | 'DELETE', service: ServiceItem) => {
      if (action === 'ADD') {
          setServices(prev => [...prev, service]);
          logEvent('SERVICE_ADD', `Dodano nową usługę: ${service.name}`, service.id, 'SERVICE');
          notifLogic.addToast("Usługa Dodana", "Nowy benefit jest widoczny w katalogu.", "SUCCESS");
      } else if (action === 'UPDATE') {
          setServices(prev => prev.map(s => s.id === service.id ? service : s));
          logEvent('SERVICE_UPDATE', `Zaktualizowano usługę: ${service.name}`, service.id, 'SERVICE');
          notifLogic.addToast("Usługa Zaktualizowana", "Zmiany zostały zapisane.", "SUCCESS");
      } else if (action === 'DELETE') {
          setServices(prev => prev.filter(s => s.id !== service.id));
          logEvent('SERVICE_DELETE', `Usunięto usługę: ${service.name}`, service.id, 'SERVICE');
          notifLogic.addToast("Usługa Usunięta", "Pozycja została usunięta z katalogu.", "INFO");
      }
  }, [setServices, logEvent, notifLogic.addToast]);

  // --- TICKET MANAGEMENT ---
  const handleCreateTicket = useCallback((subject: string, category: TicketCategory, priority: TicketPriority, message: string, relatedEntityId?: string) => {
      if (!currentUser) return;
      const ticketId = `TCK-${generateUUID().slice(0,8).toUpperCase()}`;
      const newMessage: TicketMessage = {
          id: `MSG-${Date.now()}`,
          ticketId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          message,
          timestamp: new Date().toISOString()
      };

      const newTicket: SupportTicket = {
          id: ticketId,
          subject,
          category,
          priority,
          status: 'OPEN',
          creatorId: currentUser.id,
          creatorName: currentUser.name,
          companyId: currentUser.companyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          relatedEntityId,
          messages: [newMessage]
      };

      setTickets(prev => [newTicket, ...prev]);
      logEvent('TICKET_CREATED', `Utworzono zgłoszenie ${ticketId}: ${subject}`, ticketId, 'TICKET');
      
      // Notify Admin
      notifLogic.notifyUser('ALL_ADMINS', `Nowe zgłoszenie od ${currentUser.name}: ${subject}`, 'INFO', {
          type: 'VIEW_TICKET',
          targetId: ticketId,
          label: 'Zobacz Zgłoszenie',
          variant: 'primary'
      }, ticketId, 'TICKET');

      notifLogic.addToast("Zgłoszenie Wysłane", `Numer referencyjny: ${ticketId}`, "SUCCESS");
  }, [currentUser, setTickets, logEvent, notifLogic.notifyUser, notifLogic.addToast]);

  const handleReplyTicket = useCallback((ticketId: string, message: string) => {
      if (!currentUser) return;
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      const newMessage: TicketMessage = {
          id: `MSG-${Date.now()}`,
          ticketId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          message,
          timestamp: new Date().toISOString()
      };

      setTickets(prev => prev.map(t => t.id === ticketId ? { 
          ...t, 
          messages: [...t.messages, newMessage],
          updatedAt: new Date().toISOString(),
          status: t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'IN_PROGRESS' : t.status
      } : t));

      // Notify the other party
      if (currentUser.role === Role.SUPERADMIN) {
          notifLogic.notifyUser(ticket.creatorId, `Nowa odpowiedź w zgłoszeniu ${ticketId}.`, 'INFO', undefined, ticketId, 'TICKET');
      } else {
          notifLogic.notifyUser('ALL_ADMINS', `Nowa odpowiedź od użytkownika w zgłoszeniu ${ticketId}.`, 'INFO', undefined, ticketId, 'TICKET');
      }
  }, [currentUser, tickets, setTickets, notifLogic.notifyUser]);

  const handleUpdateTicketStatus = useCallback((ticketId: string, status: TicketStatus) => {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t));
      logEvent('TICKET_STATUS_UPDATE', `Zmiana statusu zgłoszenia ${ticketId} na ${status}.`, ticketId, 'TICKET');
      
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && status === 'RESOLVED') {
          notifLogic.notifyUser(ticket.creatorId, `Zgłoszenie ${ticketId} zostało rozwiązane.`, 'SUCCESS');
      }
  }, [setTickets, logEvent, tickets, notifLogic.notifyUser]);

  const handleToggleTwoFactor = useCallback((userId: string, enabled: boolean) => {
      userLogic.setUsers(prev => prev.map(u => u.id === userId ? { ...u, isTwoFactorEnabled: enabled } : u));
      const action = enabled ? 'ENABLED' : 'DISABLED';
      logEvent(`2FA_${action}`, `Użytkownik ${userId} ${enabled ? 'włączył' : 'wyłączył'} weryfikację dwuetapową.`, userId, 'USER');
      notifLogic.addToast("Bezpieczeństwo", `2FA zostało ${enabled ? 'aktywowane' : 'dezaktywowane'}.`, "SUCCESS");
  }, [userLogic.setUsers, logEvent, notifLogic.addToast]);

  // --- MEMOIZED VALUE TO PREVENT UNNECESSARY RENDERS ---
  const contextValue = useMemo(() => ({
    state: {
      currentUser,
      users: userLogic.users,
      vouchers: voucherLogic.vouchers,
      companies: orderLogic.companies,
      orders: orderLogic.orders,
      buybacks: voucherLogic.buybacks,
      auditLogs,
      commissions: orderLogic.commissions,
      quarterlyStats,
      notifications: notifLogic.notifications,
      notificationConfigs: notifLogic.notificationConfigs,
      services,
      transactions: voucherLogic.transactions,
      importHistory: userLogic.importHistory,
      distributionBatches: voucherLogic.distributionBatches,
      systemConfig,
      toasts: notifLogic.toasts,
      tickets 
    },
    actions: {
      login,
      loginWithUser,
      logout,
      switchUser,
      setUsers: userLogic.setUsers,
      setCompanies: orderLogic.setCompanies,
      handleUpdateSystemConfig,
      handleUpdateNotificationConfig: notifLogic.handleUpdateNotificationConfig,
      handleUpdateCompanyConfig,
      handleAddCompany: orderLogic.handleAddCompany,
      handleCrmSync: orderLogic.handleCrmSync, 
      handleManualEmission: voucherLogic.handleManualEmission,
      handlePlaceOrder: orderLogic.handlePlaceOrder,
      handleApproveOrder: orderLogic.handleApproveOrder,
      handleBankPayment: orderLogic.handleBankPayment,
      handleDistribute: voucherLogic.handleDistribute,
      handleBulkDistribute: voucherLogic.handleBulkDistribute,
      handleDeactivateEmployee: userLogic.handleDeactivateEmployee,
      handleUpdateEmployee: userLogic.handleUpdateEmployee,
      handleBulkImport: userLogic.handleBulkImport,
      handleServicePurchase: voucherLogic.handleServicePurchase,
      simulateExpiration: voucherLogic.simulateExpiration,
      handleApproveBuyback: voucherLogic.handleApproveBuyback,
      handleProcessBuybackPayment: voucherLogic.handleProcessBuybackPayment,
      handleMarkNotificationsRead: notifLogic.handleMarkNotificationsRead,
      handleMarkSingleNotificationRead: notifLogic.handleMarkSingleNotificationRead,
      handleExportPayrollTemplate,
      handleParseAndMatchPayroll,
      handleNotificationAction,
      handleClearNotifications: notifLogic.handleClearNotifications,
      handleUpdateUserFinance: userLogic.handleUpdateUserFinance,
      handleRequestIbanChange: userLogic.handleRequestIbanChange,
      handleResolveIbanChange: userLogic.handleResolveIbanChange,
      handleManageService,
      handleCreateTicket,
      handleReplyTicket,
      handleUpdateTicketStatus,
      handleAnonymizeUser: userLogic.handleAnonymizeUser,
      handleToggleTwoFactor,
      fetchUsersFromApi: userLogic.fetchUsersFromApi,
      addToast: notifLogic.addToast,
      removeToast: notifLogic.removeToast
    }
  }), [
    currentUser, userLogic.users, voucherLogic.vouchers, orderLogic.companies, orderLogic.orders, voucherLogic.buybacks,
    auditLogs, orderLogic.commissions, quarterlyStats, notifLogic.notifications, notifLogic.notificationConfigs,
    services, voucherLogic.transactions, userLogic.importHistory, voucherLogic.distributionBatches, systemConfig, notifLogic.toasts, tickets,
    login, loginWithUser, logout, switchUser, userLogic.setUsers, orderLogic.setCompanies, handleUpdateSystemConfig, notifLogic.handleUpdateNotificationConfig, handleUpdateCompanyConfig,
    orderLogic.handleAddCompany, orderLogic.handleCrmSync, voucherLogic.handleManualEmission, orderLogic.handlePlaceOrder, orderLogic.handleApproveOrder,
    orderLogic.handleBankPayment, voucherLogic.handleDistribute, voucherLogic.handleBulkDistribute, userLogic.handleDeactivateEmployee,
    userLogic.handleUpdateEmployee, userLogic.handleBulkImport, voucherLogic.handleServicePurchase, voucherLogic.simulateExpiration,
    voucherLogic.handleApproveBuyback, voucherLogic.handleProcessBuybackPayment, notifLogic.handleMarkNotificationsRead,
    notifLogic.handleMarkSingleNotificationRead, handleExportPayrollTemplate, handleParseAndMatchPayroll, handleNotificationAction,
    notifLogic.handleClearNotifications, userLogic.handleUpdateUserFinance, userLogic.handleRequestIbanChange, userLogic.handleResolveIbanChange,
    handleManageService, handleCreateTicket, handleReplyTicket, handleUpdateTicketStatus, userLogic.handleAnonymizeUser, handleToggleTwoFactor,
    notifLogic.addToast, notifLogic.removeToast, userLogic.fetchUsersFromApi
  ]);

  return (
    <StrattonContext.Provider value={contextValue}>
      {children}
    </StrattonContext.Provider>
  );
};

export const useStrattonSystem = () => {
  const context = useContext(StrattonContext);
  if (!context) {
    throw new Error('useStrattonSystem must be used within a StrattonProvider');
  }
  return context;
};
