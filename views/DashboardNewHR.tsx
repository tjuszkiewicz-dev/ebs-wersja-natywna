import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Company, User, Voucher, Order, VoucherStatus, Role, ContractType,
  ImportRow
} from '../types';
import { useStrattonSystem } from '../context/StrattonContext';
import { generateExcelTemplate, parseExcelFile, exportActiveEmployees, exportEmployeeCredentials, HrExcelRow } from '../utils/excelHr';
import { supabaseProfileToUser } from '../lib/supabaseToUser';
import { formatCurrency, formatDate } from '../utils/formatters';
import { HrOrder, HRTab, STATUS_MAP, formatPeriod, buildOrderReportHtml } from '../utils/hrUtils';
import { EmpDetailRow } from '../components/hr/dashboard/EmployeeCard';
import { HROrderPickerModal } from '../components/hr/modals/HROrderPickerModal';
import { HROrderHistoryModal } from '../components/hr/modals/HROrderHistoryModal';
import { HRAddEmployeeModal } from '../components/hr/modals/HRAddEmployeeModal';
import {
  Upload, Download, FileSpreadsheet, Users, FileText, CreditCard, ClipboardList,
  Search, X, CheckCircle2, AlertCircle, AlertTriangle, Clock, ChevronRight,
  ChevronDown, ChevronUp, Eye, EyeOff, UserX, UserPlus, Building2, Phone, Mail, MapPin,
  Calendar, Plus, RefreshCw, Loader2, Info, TrendingUp, Wallet, Filter,
  ArrowLeft, LogOut, Save, History, Printer, KeyRound, Copy, Check, Trash2
} from 'lucide-react';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  company: Company;
  employees: User[];
  vouchers: Voucher[];
  orders: Order[];
  currentUser: User;
  onLogout: () => void;
  isAdminView?: boolean; // When embedded in admin panel
  currentView?: string;  // Synced from sidebar
  onViewChange?: (view: string) => void;
}


// ─── Main Component ─────────────────────────────────────────────────────────

export const DashboardNewHR: React.FC<Props> = ({
  company, employees, vouchers, orders: contextOrders,
  currentUser, onLogout, isAdminView = false,
  currentView, onViewChange
}) => {
  const { actions, state } = useStrattonSystem();

  // HR orders — source of truth: DB (no localStorage)
  const [hrOrders, setHrOrders] = useState<HrOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/orders?companyId=${company.id}`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.data) return;
      const statusMap: Record<string, HrOrder['status']> = {
        pending: 'PENDING', approved: 'APPROVED', paid: 'PAID', rejected: 'REJECTED',
      };
      const dbOrders: HrOrder[] = json.data.map((o: any) => {
        const planSource: any[] =
          (Array.isArray(o.payroll_snapshots) ? o.payroll_snapshots : null) ??
          (Array.isArray(o.distribution_plan) ? o.distribution_plan : null) ??
          [];
        const distributions = planSource
          .map((s: any) => ({
            employeeId:   s.matched_user_id ?? s.matchedUserId ?? '',
            employeeName: s.employee_name   ?? s.employeeName  ?? '',
            pesel:        s.employee_pesel  ?? s.pesel         ?? '',
            amount:       Math.floor(s.final_netto_voucher ?? s.voucherPartNet ?? s.amount ?? 0),
          }))
          .filter((d: any) => d.amount > 0);
        return {
          id:            o.id,
          companyId:     o.company_id,
          date:          o.created_at,
          period:        o.created_at?.slice(0, 7) ?? '',
          totalAmount:   Number(o.amount_pln ?? 0),
          employeeCount: Number(o.amount_vouchers ?? 0),
          status:        statusMap[o.status] ?? 'PENDING',
          distributions,
          createdBy:     o.hr_user_id ?? '',
          umowaPdfUrl:   o.umowa_pdf_url ?? null,
        };
      });
      setHrOrders(dbOrders);
    } finally {
      setOrdersLoading(false);
    }
  }, [company.id]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const [activeTab, setActiveTab] = useState<HRTab>('ORDER');

  // Sync tab from sidebar
  useEffect(() => {
    if (!currentView) return;
    if (currentView === 'hr-order') setActiveTab('ORDER');
    else if (currentView === 'hr-history') setActiveTab('HISTORY');
    else if (currentView === 'hr-employees') setActiveTab('EMPLOYEES');
    else if (currentView === 'hr-payments') setActiveTab('PAYMENTS');
    else if (currentView === 'hr-buyback') setActiveTab('BUYBACK');
  }, [currentView]);

  // ─── Tab 5: Buyback state ────────────────────────────────────────────────
  const [buybackBatches,     setBuybackBatches]     = useState<any[]>([]);
  const [buybackLoading,     setBuybackLoading]     = useState(false);
  const [buybackError,       setBuybackError]       = useState<string | null>(null);
  const [generatingBatch,    setGeneratingBatch]    = useState(false);
  const [batchGenError,      setBatchGenError]      = useState<string | null>(null);
  const [batchGenSuccess,    setBatchGenSuccess]    = useState<string | null>(null);
  const [buybackEmpSearch,   setBuybackEmpSearch]   = useState('');
  const [buybackEmpFilter,   setBuybackEmpFilter]   = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const fetchBuybackBatches = useCallback(async () => {
    if (!company.id) return;
    setBuybackLoading(true);
    setBuybackError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/buyback-batches`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBuybackBatches(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setBuybackError(e.message ?? 'Błąd pobierania paczek');
    } finally {
      setBuybackLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    if (activeTab === 'BUYBACK') fetchBuybackBatches();
  }, [activeTab, fetchBuybackBatches]);

  // ─── Tab 1: New Order state ──────────────────────────────────────────────
  const [uploadedRows, setUploadedRows] = useState<HrExcelRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [newEmployeeCredentials, setNewEmployeeCredentials] = useState<{ id: string; email: string; name: string; tempPassword: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Tab 3: Employee Directory state ────────────────────────────────────
  const [empSearch, setEmpSearch] = useState('');
  const [empFilter, setEmpFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [empHistoryEmployee, setEmpHistoryEmployee] = useState<User | null>(null);

  // ─── Cleanup modal (admin only) ─────────────────────────────────────────
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ ok: boolean; deleted?: Record<string, number | string>; error?: string } | null>(null);

  const handleCompanyCleanup = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/admin/company-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCleanupResult({ ok: true, deleted: data.deleted });
      // Refresh local state
      fetchOrders();
      await actions.fetchUsersFromApi();
    } catch (e: any) {
      setCleanupResult({ ok: false, error: e.message });
    } finally {
      setCleanupLoading(false);
    }
  };

  // Credentials per employee: { [empId]: { show: boolean, resetting: boolean, copied: boolean } }
  const [credState, setCredState] = useState<Record<string, { show: boolean; resetting: boolean; copied: boolean }>>({});
  const setCredField = (empId: string, field: string, value: any) =>
    setCredState(prev => ({ ...prev, [empId]: { show: false, resetting: false, copied: false, ...prev[empId], [field]: value } }));

  const handleResetEmployeePassword = async (emp: User) => {
    setCredField(emp.id, 'resetting', true);
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const { newPassword } = await res.json();
        actions.setUsers(prev => prev.map(u => u.id === emp.id ? { ...u, tempPassword: newPassword } : u));
        setCredField(emp.id, 'show', true);
      }
    } finally {
      setCredField(emp.id, 'resetting', false);
    }
  };

  const handleCopyEmpCredentials = (emp: User) => {
    const pwd = (emp as any).tempPassword ?? '';
    if (!pwd) return;
    navigator.clipboard.writeText(`Login (e-mail): ${emp.email}\nHasło: ${pwd}`).then(() => {
      setCredField(emp.id, 'copied', true);
      setTimeout(() => setCredField(emp.id, 'copied', false), 2500);
    });
  };

  const handleHrConfirm = async (orderId: string) => {
    setHrConfirmState(prev => ({ ...prev, [orderId]: { ...prev[orderId], checked: prev[orderId]?.checked ?? false, loading: true, done: false, error: null } }));
    try {
      const res = await fetch(`/api/orders/${orderId}/hr-confirm`, { method: 'PATCH' });
      const body = await res.json();
      if (!res.ok) {
        setHrConfirmState(prev => ({ ...prev, [orderId]: { ...prev[orderId], loading: false, error: body.error ?? 'Błąd serwera' } }));
        return;
      }
      setHrOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'APPROVED' as HrOrder['status'] } : o));
      void fetchOrders();
      setHrConfirmState(prev => ({ ...prev, [orderId]: { ...prev[orderId], loading: false, done: true, error: null } }));
    } catch (e) {
      setHrConfirmState(prev => ({ ...prev, [orderId]: { ...prev[orderId], loading: false, error: 'Błąd połączenia z serwerem' } }));
    }
  };

  const [showOrderPickerModal, setShowOrderPickerModal] = useState(false);

  // ─── Tab 2: History state ────────────────────────────────────────────────
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [histFilter, setHistFilter] = useState('');
  const [hrConfirmState, setHrConfirmState] = useState<Record<string, { checked: boolean; loading: boolean; done: boolean; error: string | null }>>({});
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const handleDeleteOrder = async (orderId: string) => {
    setDeletingOrderId(orderId);
    try {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (UUID_RE.test(orderId)) {
        const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error ?? 'Nie udało się usunąć zamówienia');
          return;
        }
      }
      // Usuń z DB, odśwież stan
      await fetchOrders();
      if (expandedOrderId === orderId) setExpandedOrderId(null);
    } finally {
      setDeletingOrderId(null);
    }
  };
  // ─── Computed values ─────────────────────────────────────────────────────

  const myEmployees = useMemo(
    () => state.users.filter(u => u.companyId === company.id && u.role === Role.EMPLOYEE),
    [state.users, company.id]
  );

  // Company expiry deadline this month (from HR-configured day/hour/minute)
  const companyExpiryDeadline = useMemo(() => {
    const day    = company.voucherExpiryDay    ?? null;
    const hour   = company.voucherExpiryHour   ?? 0;
    const minute = company.voucherExpiryMinute ?? 5;
    if (!day) return null;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0);
  }, [company.voucherExpiryDay, company.voucherExpiryHour, company.voucherExpiryMinute]);

  const deadlinePassed = useMemo(
    () => !!companyExpiryDeadline && companyExpiryDeadline.getTime() <= Date.now(),
    [companyExpiryDeadline]
  );

  // Count expired vouchers per employee.
  // After migration 019: individual records have status='expired' and current_owner_id=employee.
  // For existing data (records still on HR user): fall back to employee.voucherBalance when
  // the company deadline has passed — every voucher an employee holds is past expiry.
  const expiredCountByEmpId = useMemo(() => {
    const map = new Map<string, number>();

    // Primary: individual voucher records with status EXPIRED assigned to employees
    vouchers
      .filter(v => v.status === VoucherStatus.EXPIRED && !!v.ownerId)
      .forEach(v => {
        map.set(v.ownerId!, (map.get(v.ownerId!) ?? 0) + 1);
      });

    // Fallback: if deadline has passed and an employee has balance but no expired records yet,
    // use their full balance (pre-migration data — voucher records are still on HR user)
    if (deadlinePassed) {
      myEmployees.forEach(emp => {
        if (!map.has(emp.id)) {
          const balance = emp.voucherBalance ?? 0;
          if (balance > 0) map.set(emp.id, balance);
        }
      });
    }

    return map;
  }, [vouchers, myEmployees, deadlinePassed]);

  // Employees with EXPIRED vouchers (defined after myEmployees)
  const buybackPendingEmployees = useMemo(() => {
    const results: { employee: User; count: number }[] = [];
    myEmployees.forEach(emp => {
      const count = expiredCountByEmpId.get(emp.id) ?? 0;
      if (count > 0) results.push({ employee: emp, count });
    });
    return results;
  }, [myEmployees, expiredCountByEmpId]);

  const handleGenerateBatch = useCallback(async () => {
    if (buybackPendingEmployees.length === 0) return;
    setBatchGenError(null);
    setBatchGenSuccess(null);
    setGeneratingBatch(true);
    try {
      const res = await fetch(`/api/companies/${company.id}/buyback-batches`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      if (d.csv) {
        const blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: `odkup_${d.periodLabel ?? 'batch'}.csv` });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }
      setBatchGenSuccess(`Paczka wygenerowana: ${d.voucherCount} voucherów, ${d.totalAmount?.toFixed(2)} PLN.`);
      fetchBuybackBatches();
    } catch (e: any) {
      setBatchGenError(e.message ?? 'Błąd generowania');
    } finally {
      setGeneratingBatch(false);
    }
  }, [company.id, buybackPendingEmployees.length, fetchBuybackBatches]);

  const employeesByPesel = useMemo(() => {
    const map = new Map<string, User>();
    myEmployees.forEach(u => { if (u.pesel) map.set(u.pesel, u); });
    return map;
  }, [myEmployees]);

  const totalPool = useMemo(
    () => vouchers.filter(v => v.companyId === company.id && (v.status === VoucherStatus.ACTIVE || v.status === VoucherStatus.DISTRIBUTED)).length,
    [vouchers, company.id]
  );

  const unpaidOrders = useMemo(
    () => hrOrders.filter(o => o.companyId === company.id && o.status === 'APPROVED'),
    [hrOrders, company.id]
  );

  // ─── Tab 4: Dokumenty finansowe ──────────────────────────────────────────
  type FinancialDoc = {
    id: string;
    type: 'nota' | 'faktura_vat';
    document_number: string | null;
    amount_net: number;
    vat_amount: number;
    amount_gross: number;
    status: 'pending' | 'paid';
    issued_at: string;
    pdf_url: string | null;
    linked_order_id: string | null;
    payment_confirmed_at: string | null;
  };
  const [financialDocs, setFinancialDocs] = useState<FinancialDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsTab, setDocsTab] = useState<'nota' | 'faktura_vat'>('nota');

  const fetchFinancialDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/invoices?companyId=${company.id}`);
      if (res.ok) setFinancialDocs(await res.json());
    } finally {
      setDocsLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    fetchFinancialDocs();
  }, [fetchFinancialDocs]);

  useEffect(() => {
    if (activeTab === 'PAYMENTS') fetchFinancialDocs();
  }, [activeTab, fetchFinancialDocs]);

  const unpaidDocsCount = useMemo(
    () => financialDocs.filter(d => d.status === 'pending').length,
    [financialDocs]
  );

  // ─── Tab 1: File upload handler ──────────────────────────────────────────

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) {
      setParseError('Dozwolone tylko pliki Excel (.xlsx, .xls)');
      return;
    }
    setIsParsing(true);
    setParseError(null);
    setOrderSuccess(null);
    setUploadedRows([]);
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) {
        setParseError('Plik jest pusty lub zawiera tylko nagłówek.');
      } else {
        // Odśwież listę pracowników z bazy danych przed klasyfikacją
        try {
          const usersRes = await fetch('/api/users');
          if (usersRes.ok) {
            const profiles: any[] = await usersRes.json();
            const mapped: User[] = profiles.map(p =>
              supabaseProfileToUser(p, p.email ?? '', p.company_id ?? '')
            );
            const mappedIds = new Set(mapped.map(u => u.id));
            // Scal: zachowaj pracowników lokalnych których nie ma jeszcze w bazie
            actions.setUsers(prev => {
              const localOnly = prev.filter(u => !mappedIds.has(u.id));
              return [...mapped, ...localOnly];
            });
          }
        } catch {
          // Jeśli fetch się nie powiedzie, klasyfikuj na podstawie lokalnego stanu
        }
        setUploadedRows(rows);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Błąd parsowania pliku');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [actions]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file], value: '' } } as any;
    handleFileChange(fakeEvent);
  }, [handleFileChange]);

  // Classify rows as NEW / EXISTING by PESEL
  const classifiedRows = useMemo(() => {
    return uploadedRows.map(row => ({
      ...row,
      existingUser: row.pesel ? employeesByPesel.get(row.pesel) : undefined,
    }));
  }, [uploadedRows, employeesByPesel]);

  const validRows = useMemo(() => classifiedRows.filter(r => r.isValid), [classifiedRows]);
  const totalAmount = useMemo(() => validRows.reduce((s, r) => s + r.amount, 0), [validRows]);

  // ─── Tab 1: Submit order ─────────────────────────────────────────────────

  const handleSubmitOrder = useCallback(async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    setOrderSuccess(null);

    try {
      // 1. Zapisz nowych pracowników do Supabase
      const newRows = validRows.filter(r => !r.existingUser);
      let actuallyImported = 0;
      if (newRows.length > 0) {
        const importRows: ImportRow[] = newRows.map((r, i) => ({
          rowId:        r.rowIndex,
          name:         r.firstName,
          surname:      r.lastName,
          email:        r.email,
          pesel:        r.pesel,
          department:   '',
          position:     '',
          isValid:      true,
          errors:       [],
        }));
        const result = await actions.handleBulkImport(importRows, company.id);
        if (!result) {
          // błąd już obsłużony przez handleBulkImport (toast)
          return;
        }
        actuallyImported = result.reportData?.importedCount ?? 0;
        if (result.newEmployees && result.newEmployees.length > 0) {
          setNewEmployeeCredentials(result.newEmployees);
        }
      }

      // 2. Pobierz aktualną listę pracowników z API (po imporcie IDs są już w Supabase)
      //    Potrzebujemy matched_user_id żeby /approve mógł rozdać vouchery
      let freshUsers: Array<{ id: string; pesel: string | null; email: string }> = [];
      try {
        const usersRes = await fetch(`/api/users?companyId=${company.id}`);
        if (usersRes.ok) freshUsers = await usersRes.json();
      } catch (_) {}
      const byPesel = new Map(freshUsers.filter(u => u.pesel).map(u => [u.pesel!, u]));
      const byEmail = new Map(freshUsers.map(u => [u.email.toLowerCase(), u]));

      // 3. Buduj plan dystrybucji z polami wymaganymi przez endpoint /approve:
      //    matched_user_id  → ID pracownika w Supabase (do transfer_vouchers)
      //    final_netto_voucher → ilość voucherów PLN do przekazania (bezpośrednio z Excela)
      const distributionPlan = validRows.map(r => {
        const matched =
          (r.pesel ? byPesel.get(r.pesel) : undefined) ??
          byEmail.get((r.email ?? '').toLowerCase()) ??
          undefined;
        const userId = matched?.id ?? r.existingUser?.id;
        return {
          employeeName:        `${r.firstName} ${r.lastName}`,
          pesel:               r.pesel,
          email:               r.email ?? '',
          amount:              r.amount,
          isNew:               !r.existingUser,
          // Pola wymagane przez /api/orders/[id]/approve → transfer_vouchers
          matched_user_id:     userId,
          matchedUserId:       userId,
          final_netto_voucher: r.amount,
          voucherPartNet:      r.amount,
        };
      });

      // 4. Złóż zamówienie w Supabase — pobierz prawdziwy UUID z bazy
      await actions.handlePlaceOrder(totalAmount, distributionPlan as any);

      // 5. Odśwież historię zamwień z DB
      void fetchOrders();

      setOrderSuccess(
        `Zamówienie zostało złożone. Łącznie: ${formatCurrency(totalAmount)} dla ${validRows.length} pracowników.` +
        (newRows.length > 0 ? ` Dodano ${actuallyImported} nowych pracowników.` : '')
      );
      setUploadedRows([]);
    } finally {
      setIsSubmitting(false);
    }
  }, [validRows, totalAmount, actions, fetchOrders]);

  // ─── Tab 3: Employee actions ─────────────────────────────────────────────

  const handleDeactivateEmployee = useCallback((userId: string) => {
    actions.setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, status: 'INACTIVE' } : u
    ));
  }, [actions]);

  const handleActivateEmployee = useCallback((userId: string) => {
    actions.setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, status: 'ACTIVE' } : u
    ));
  }, [actions]);

  const filteredEmployees = useMemo(() => {
    let list = myEmployees;
    if (empFilter === 'ACTIVE') list = list.filter(u => u.status === 'ACTIVE');
    if (empFilter === 'INACTIVE') list = list.filter(u => u.status === 'INACTIVE');
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.pesel ?? '').includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [myEmployees, empFilter, empSearch]);

  const filteredBuybackEmployees = useMemo(() => {
    let list = myEmployees;
    if (buybackEmpFilter === 'ACTIVE') list = list.filter(u => u.status === 'ACTIVE');
    if (buybackEmpFilter === 'INACTIVE') list = list.filter(u => u.status === 'INACTIVE');
    if (buybackEmpSearch.trim()) {
      const q = buybackEmpSearch.toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.pesel ?? '').includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [myEmployees, buybackEmpFilter, buybackEmpSearch]);

  // ─── Tab 2: Filtered history ─────────────────────────────────────────────

  const myHrOrders = useMemo(
    () => hrOrders.filter(o => o.companyId === company.id),
    [hrOrders, company.id]
  );

  const pendingOrdersCount = useMemo(
    () => myHrOrders.filter(o => o.status === 'PENDING').length,
    [myHrOrders]
  );

  const filteredHistory = useMemo(() => {
    if (!histFilter.trim()) return myHrOrders;
    const q = histFilter.toLowerCase();
    return myHrOrders.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.period.includes(q) ||
      (o.invoiceNumber ?? '').toLowerCase().includes(q)
    );
  }, [myHrOrders, histFilter]);

  // ─── Render helpers ──────────────────────────────────────────────────────

  const tabs: { id: HRTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'ORDER',     label: 'Nowe zamówienie',       icon: <Plus size={16}/> },
    { id: 'HISTORY',   label: 'Historia zamówień',     icon: <ClipboardList size={16}/>, badge: myHrOrders.length || undefined },
    { id: 'EMPLOYEES', label: 'Kartoteka pracowników', icon: <Users size={16}/>, badge: myEmployees.length || undefined },
    { id: 'PAYMENTS',  label: 'Płatności i faktury',   icon: <CreditCard size={16}/>, badge: unpaidDocsCount || undefined },
    { id: 'BUYBACK',   label: 'Anulowanie subskrypcji', icon: <RefreshCw size={16}/>, badge: buybackPendingEmployees.length || undefined },
  ];

  return (
    <div className="min-h-screen" style={{ fontFamily: '"Segoe UI", system-ui, sans-serif' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between" style={{ height: 48 }}>
        <div className="flex items-center gap-3">
          {isAdminView && (
            <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mr-2"
              onClick={() => window.history.back ? window.history.back() : undefined}>
              <ArrowLeft size={14}/> Wróć
            </button>
          )}
          <Building2 size={16} className="text-blue-600"/>
          <span className="font-semibold text-gray-800 text-sm">{company.name}</span>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-500">NIP: {company.nip}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Wallet size={14} className="text-emerald-500"/>
            <span>Pula aktywna: <strong className="text-gray-700">{totalPool} voucherów</strong></span>
          </div>
          {unpaidDocsCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200">
              <AlertCircle size={13}/>
              {unpaidDocsCount} {unpaidDocsCount === 1 ? 'dokument do opłacenia' : 'dokumenty do opłacenia'}
            </div>
          )}
          <button
              onClick={() => { setShowCleanupModal(true); setCleanupResult(null); }}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition-colors font-medium">
              <Trash2 size={13}/> Wyczyść dane klienta
            </button>
          {!isAdminView && (
            <button onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors">
              <LogOut size={14}/> Wyloguj
            </button>
          )}
        </div>
      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setExpandedEmployeeId(null);
                const viewMap: Record<HRTab, string> = { ORDER: 'hr-order', HISTORY: 'hr-history', EMPLOYEES: 'hr-employees', PAYMENTS: 'hr-payments', BUYBACK: 'hr-buyback' };
                onViewChange?.(viewMap[tab.id]);
              }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : tab.id === 'HISTORY' && pendingOrdersCount > 0
                    ? 'border-transparent text-emerald-600 hover:border-emerald-400 animate-pulse'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 font-semibold
                  ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div className="p-6">

        {/* ═══════════════════ TAB 1: NOWE ZAMÓWIENIE ════════════════ */}
        {activeTab === 'ORDER' && (
          <div className="max-w-4xl mx-auto space-y-5">

            {/* Success banner */}
            {orderSuccess && (
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0"/>
                <div>
                  <p className="font-semibold mb-0.5">Zamówienie złożone</p>
                  <p>{orderSuccess}</p>
                  <button className="mt-2 text-xs text-emerald-700 underline"
                    onClick={() => { setOrderSuccess(null); setActiveTab('HISTORY'); }}>
                    Zobacz historię zamówień →
                  </button>
                </div>
              </div>
            )}

            {/* New employee credentials panel */}
            {newEmployeeCredentials.length > 0 && (
              <div className="bg-white border border-amber-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 rounded-md">
                      <UserPlus size={16} className="text-amber-700"/>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Dane logowania nowych pracowników</p>
                      <p className="text-xs text-gray-500">Zapisz i przekaż pracownikom — hasła nie będą widoczne ponownie</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNewEmployeeCredentials([])}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Zamknij"
                  >
                    <X size={16}/>
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-3 py-2 font-medium">Pracownik</th>
                        <th className="text-left px-3 py-2 font-medium">Email (login)</th>
                        <th className="text-left px-3 py-2 font-medium">Hasło dostępowe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newEmployeeCredentials.map((emp, i) => (
                        <tr key={emp.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium text-gray-800">{emp.name}</td>
                          <td className="px-3 py-2 text-gray-600">{emp.email}</td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-sm bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded select-all">
                              {emp.tempPassword}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={12}/>
                  Dane logowania zostaną zapisane w karcie pracownika.
                </p>
              </div>
            )}

            {/* Info card */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-base font-semibold text-gray-800 mb-1">Złóż nowe zamówienie voucherów</h2>
              <p className="text-sm text-gray-500 mb-4">
                Prześlij listę pracowników z plik Excel. Nowi pracownicy z listy zostaną automatycznie dodani do kartoteki.
              </p>

              {/* Step 1: Download template */}
              <div className="flex items-start gap-3 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">1</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">Pobierz szablon Excel</p>
                  <p className="text-xs text-gray-500 mb-2">Kolumny: Imię, Nazwisko, PESEL, Kwota voucherów (PLN), Email</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={generateExcelTemplate}
                      className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                      <FileSpreadsheet size={15}/> Pobierz pusty szablon
                    </button>
                    <button
                      onClick={() => {
                        const activeEmps = myEmployees.filter(u => u.status === 'ACTIVE');
                        if (activeEmps.length === 0) {
                          alert('Brak aktywnych pracowników do eksportu.');
                          return;
                        }
                        exportActiveEmployees(
                          activeEmps.map(u => ({
                            firstName:      u.identity?.firstName ?? u.name.split(' ')[0] ?? u.name,
                            lastName:       u.identity?.lastName  ?? u.name.split(' ').slice(1).join(' ') ?? '',
                            pesel:          u.pesel ?? u.identity?.pesel ?? '',
                            email:          u.email ?? '',
                            phoneNumber:    u.identity?.phoneNumber ?? '',
                            department:     u.department ?? u.organization?.department ?? '',
                            position:       u.position   ?? u.organization?.position   ?? '',
                            contractType:   u.contract?.type === 'UZ' ? 'Umowa Zlecenie' : 'Umowa o Pracę',
                            iban:           u.finance?.payoutAccount?.iban ?? '',
                          })),
                          company.name
                        );
                      }}
                      className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-emerald-700 transition-colors">
                      <Download size={15}/> Pobierz aktywnych pracowników ({myEmployees.filter(u => u.status === 'ACTIVE').length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-700 text-white text-xs font-bold shrink-0 mt-0.5">2</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 mb-2">Prześlij wypełniony plik</p>

                  <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg py-8 px-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Upload size={24} className="mx-auto text-gray-400 mb-2"/>
                    <p className="text-sm text-gray-600 font-medium">Przeciągnij plik lub kliknij aby wybrać</p>
                    <p className="text-xs text-gray-400 mt-1">Obsługiwane formaty: .xlsx, .xls</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange}/>
                  </div>

                  {isParsing && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                      <Loader2 size={15} className="animate-spin"/> Przetwarzanie pliku...
                    </div>
                  )}
                  {parseError && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                      <AlertTriangle size={14}/> {parseError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview table */}
            {uploadedRows.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Podgląd listy ({uploadedRows.length} wierszy)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="text-emerald-600 font-medium">{classifiedRows.filter(r => r.isValid && r.existingUser).length} istniejących</span>
                      {' · '}
                      <span className="text-blue-600 font-medium">{classifiedRows.filter(r => r.isValid && !r.existingUser).length} nowych</span>
                      {' · '}
                      <span className="text-red-600 font-medium">{classifiedRows.filter(r => !r.isValid).length} błędów</span>
                    </p>
                  </div>
                  <button onClick={() => setUploadedRows([])} className="text-gray-400 hover:text-gray-600">
                    <X size={16}/>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide w-8">#</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Imię i nazwisko</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">PESEL</th>
                        <th className="text-right py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Kwota</th>
                        <th className="text-center py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Uwagi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {classifiedRows.map(row => (
                        <tr key={row.rowIndex} className={`${!row.isValid ? 'bg-red-50' : ''} hover:bg-gray-50`}>
                          <td className="py-2 px-4 text-gray-400 text-xs">{row.rowIndex}</td>
                          <td className="py-2 px-4 font-medium text-gray-800">
                            {row.firstName} {row.lastName}
                          </td>
                          <td className="py-2 px-4 text-gray-500 font-mono text-xs">{row.pesel}</td>
                          <td className="py-2 px-4 text-right font-semibold text-gray-800">
                            {row.isValid ? formatCurrency(row.amount) : '—'}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {!row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-medium">
                                <AlertTriangle size={11}/> Błąd
                              </span>
                            ) : row.existingUser ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                                <CheckCircle2 size={11}/> Istniejący
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                                <Plus size={11}/> Nowy
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-xs text-red-600">{row.errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary & submit */}
                {validRows.length > 0 && (
                  <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <span className="text-gray-500">Łączna kwota zamówienia: </span>
                      <span className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
                      <span className="text-gray-400 text-xs ml-2">({validRows.length} pracowników)</span>
                    </div>
                    <button
                      onClick={handleSubmitOrder}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 bg-blue-600 text-white font-medium px-6 py-2.5 rounded hover:bg-blue-700 disabled:opacity-60 transition-colors text-sm"
                    >
                      {isSubmitting ? <><Loader2 size={15} className="animate-spin"/> Przetwarzanie...</> : <><CheckCircle2 size={15}/> Złóż zamówienie</>}
                    </button>
                  </div>
                )}
                {validRows.length === 0 && uploadedRows.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-100 bg-red-50 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={14}/> Brak poprawnych wierszy. Popraw błędy w pliku Excel i prześlij ponownie.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ TAB 2: HISTORIA ZAMÓWIEŃ ══════════════ */}
        {activeTab === 'HISTORY' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center gap-3 justify-between flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  value={histFilter}
                  onChange={e => setHistFilter(e.target.value)}
                  placeholder="Szukaj zamówienia..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (myHrOrders.length === 0) { alert('Brak zamówień do wygenerowania raportu.'); return; }
                    const html = buildOrderReportHtml(
                      myHrOrders,
                      company,
                      'Raport wszystkich zamówień',
                      `Firma: ${company.name} | Wszystkie zamówienia (${myHrOrders.length}) | Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`
                    );
                    const win = window.open('', '_blank');
                    if (win) { win.document.write(html); win.document.close(); }
                  }}
                  className="flex items-center gap-2 bg-indigo-600 text-white text-xs font-medium px-3 py-2 rounded hover:bg-indigo-700 transition-colors whitespace-nowrap">
                  <Printer size={13}/> Raport zbiorczy
                </button>
                <button
                  onClick={() => {
                    if (myHrOrders.length === 0) { alert('Brak zamówień do wyboru.'); return; }
                    setShowOrderPickerModal(true);
                  }}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded hover:bg-gray-50 transition-colors whitespace-nowrap">
                  <FileText size={13}/> Raport z zamówienia
                </button>
              </div>
              <span className="text-sm text-gray-500">{filteredHistory.length} zamówień</span>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                <ClipboardList size={32} className="mx-auto text-gray-300 mb-3"/>
                <p className="text-gray-500 font-medium">Brak zamówień</p>
                <p className="text-sm text-gray-400 mt-1">Złóż pierwsze zamówienie z zakładki "Nowe zamówienie"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map(order => {
                  const st = STATUS_MAP[order.status];
                  const expanded = expandedOrderId === order.id;
                  return (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-semibold text-sm text-gray-800">{order.id}</span>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${st.color}`}>
                              {st.icon} {st.label}
                            </span>
                            <span className="text-xs text-gray-400">{formatPeriod(order.period)}</span>
                          </div>
                          {order.invoiceNumber && (
                            <p className="text-xs text-gray-400 mt-0.5">Faktura: {order.invoiceNumber}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                          <p className="text-xs text-gray-400">{order.employeeCount} pracowników</p>
                        </div>
                        <div className="text-right shrink-0 text-xs text-gray-400 w-24">
                          {formatDate(order.date)}
                        </div>
                        {order.umowaPdfUrl && (
                          <a
                            href={order.umowaPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="Pobierz Umowę Zlecenia Nabycia Voucherów"
                            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
                          >
                            <FileText size={12}/> Umowa
                          </a>
                        )}
                        {order.status === 'PENDING' && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteOrder(order.id); }}
                            disabled={deletingOrderId === order.id}
                            title="Usuń zamówienie"
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                          >
                            {deletingOrderId === order.id
                              ? <Loader2 size={15} className="animate-spin"/>
                              : <Trash2 size={15}/>}
                          </button>
                        )}
                        <div className="text-gray-400">
                          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Podział zamówienia</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400">
                                <th className="text-left py-1 pr-4 font-medium">Pracownik</th>
                                <th className="text-left py-1 pr-4 font-medium">PESEL</th>
                                <th className="text-right py-1 font-medium">Kwota</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {order.distributions.map((d, i) => (
                                <tr key={i} className="hover:bg-white">
                                  <td className="py-1.5 pr-4 font-medium text-gray-800">{d.employeeName}</td>
                                  <td className="py-1.5 pr-4 font-mono text-xs text-gray-500">{d.pesel}</td>
                                  <td className="py-1.5 text-right text-gray-700">{formatCurrency(d.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-gray-200">
                                <td colSpan={2} className="py-2 text-xs font-semibold text-gray-600">Łącznie</td>
                                <td className="py-2 text-right font-bold text-gray-900">{formatCurrency(order.totalAmount)}</td>
                              </tr>
                            </tfoot>
                          </table>

                          {order.status === 'PENDING' && (() => {
                            const cs = hrConfirmState[order.id] ?? { checked: false, loading: false, done: false, error: null };
                            if (cs.done) return (
                              <div className="mt-3 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
                                <CheckCircle2 size={16}/>
                                <span>Zamówienie potwierdzone — vouchery będą dostępne dla pracowników.</span>
                              </div>
                            );
                            return (
                              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-3">
                                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Potwierdzenie zamówienia</p>
                                <label className="flex items-start gap-3 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 accent-amber-600"
                                    checked={cs.checked}
                                    onChange={e => setHrConfirmState(prev => ({ ...prev, [order.id]: { ...cs, checked: e.target.checked } }))}
                                    disabled={cs.loading}
                                  />
                                  <span className="text-sm text-amber-900">
                                    Potwierdzam zamówienie z <strong>obowiązkiem zapłaty</strong>. Vouchery zostaną przypisane do pracowników.
                                  </span>
                                </label>
                                {cs.error && (
                                  <p className="text-xs text-red-600 font-medium">{cs.error}</p>
                                )}
                                <button
                                  onClick={() => handleHrConfirm(order.id)}
                                  disabled={!cs.checked || cs.loading}
                                  className="flex items-center gap-2 bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  {cs.loading ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                                  {cs.loading ? 'Przetwarzanie…' : 'Potwierdzam zamówienie'}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ TAB 3: KARTOTEKA PRACOWNIKÓW ══════════ */}
        {activeTab === 'EMPLOYEES' && (
          <div className="space-y-3">

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Szukaj po nazwisku, PESEL, emailu..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                {(['ALL','ACTIVE','INACTIVE'] as const).map(f => {
                  const count = f === 'ALL'
                    ? myEmployees.length
                    : myEmployees.filter(u => u.status === (f === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE')).length;
                  return (
                    <button key={f} onClick={() => setEmpFilter(f)}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                        empFilter === f ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {f === 'ALL' ? 'Wszyscy' : f === 'ACTIVE' ? 'Aktywni' : 'Nieaktywni'}
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                        empFilter === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowAddModal(true)}
                className="ml-auto flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 transition-colors shrink-0">
                <UserPlus size={15}/> Dodaj pracownika
              </button>
              <button
                onClick={() => {
                  const active = myEmployees.filter(u => u.status === 'ACTIVE');
                  if (active.length === 0) { alert('Brak aktywnych pracowników w systemie.'); return; }
                  exportEmployeeCredentials(
                    active.map(u => ({
                      name: u.name,
                      email: u.email,
                      tempPassword: (u as any).tempPassword ?? null,
                      pesel: u.pesel ?? '',
                      department: u.department ?? '',
                      position: u.position ?? '',
                    })),
                    company.name
                  );
                }}
                className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-emerald-700 transition-colors shrink-0">
                <Download size={15}/> Pobierz dostępy pracowników
              </button>
            </div>

            <div className="bg-white rounded-lg overflow-hidden shadow-sm" style={{ border: '1px solid #d1d5db' }}>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#1e3a5f' }}>
                      {['LP','Imię','Nazwisko','PESEL','Adres e-mail','Telefon','Dział','Stanowisko','Typ umowy','Saldo voucherów','Status',''].map((h, i) => (
                        <th key={i} style={{
                          border: '1px solid #16304f', padding: '9px 11px',
                          color: '#fff', fontWeight: 600, fontSize: 11,
                          textAlign: i === 0 ? 'center' : i === 9 ? 'right' : i === 10 ? 'center' : 'left',
                          whiteSpace: 'nowrap',
                          width: i === 0 ? 44 : i === 11 ? 36 : undefined,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px solid #e5e7eb', background: '#fff' }}>
                          Brak pracowników. Dodaj pracowników ręcznie lub przez import w zakładce "Nowe zamówienie".
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp, idx) => {
                        const isExpanded = expandedEmployeeId === emp.id;
                        const isActive   = emp.status === 'ACTIVE';
                        const firstName  = emp.identity?.firstName ?? emp.name.split(' ')[0] ?? emp.name;
                        const lastName   = emp.identity?.lastName  ?? emp.name.split(' ').slice(1).join(' ') ?? '';
                        const phone      = emp.identity?.phoneNumber ?? '';
                        const dept       = emp.department ?? emp.organization?.department ?? '';
                        const pos        = emp.position   ?? emp.organization?.position   ?? '';
                        const contract   = emp.contract?.type === ContractType.UZ ? 'Umowa Zlecenie' : 'Umowa o Pracę';
                        const balance    = emp.voucherBalance ?? emp.finance?.voucherBalance ?? 0;
                        const rowBg      = isExpanded ? '#eff6ff' : idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                        const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
                          border: '1px solid #e5e7eb', padding: '7px 11px',
                          background: rowBg,
                          ...extra,
                        });
                        return (
                          <React.Fragment key={emp.id}>
                            <tr
                              onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                              style={{ cursor: 'pointer', opacity: isActive ? 1 : 0.65 }}
                              className="hover:bg-blue-50 transition-colors"
                            >
                              <td style={{ ...cell(), textAlign: 'center', color: '#9ca3af' }}>{idx + 1}</td>
                              <td style={cell({ fontWeight: 500, color: '#111827' })}>{firstName}</td>
                              <td style={cell({ fontWeight: 500, color: '#111827' })}>{lastName}</td>
                              <td style={cell({ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' })}>{emp.pesel ?? '—'}</td>
                              <td style={cell({ color: '#374151' })}>{emp.email ?? '—'}</td>
                              <td style={cell({ color: '#6b7280' })}>{phone || '—'}</td>
                              <td style={cell({ color: '#6b7280' })}>{dept || '—'}</td>
                              <td style={cell({ color: '#6b7280' })}>{pos || '—'}</td>
                              <td style={cell({ color: '#6b7280', fontSize: 11, whiteSpace: 'nowrap' })}>{contract}</td>
                              <td style={cell({ textAlign: 'right', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' })}>{formatCurrency(balance)}</td>
                              <td style={cell({ textAlign: 'center' })}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 999,
                                  background: isActive ? '#d1fae5' : '#f3f4f6',
                                  color: isActive ? '#065f46' : '#6b7280',
                                }}>
                                  {isActive ? 'Aktywny' : 'Nieaktywny'}
                                </span>
                              </td>
                              <td style={cell({ textAlign: 'center', color: '#9ca3af' })}>
                                {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan={12} style={{ padding: 0, background: '#eff6ff', borderBottom: '1px solid #e5e7eb' }}>
                                  <div className="px-5 py-4">
                                    <div className="grid grid-cols-5 gap-3 mb-3">

                                      {/* Dane kontaktowe */}
                                      <div className="bg-white border border-blue-100 rounded-lg p-3">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                          <Mail size={11}/> Kontakt
                                        </p>
                                        <EmpDetailRow label="E-mail" value={emp.email}/>
                                        <EmpDetailRow label="Telefon" value={emp.identity?.phoneNumber}/>
                                      </div>

                                      {/* Adres */}
                                      <div className="bg-white border border-blue-100 rounded-lg p-3">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                          <MapPin size={11}/> Adres
                                        </p>
                                        <EmpDetailRow label="Ulica" value={emp.address?.street}/>
                                        <EmpDetailRow label="Kod poczt." value={(emp.address as any)?.zipCode}/>
                                        <EmpDetailRow label="Miasto" value={emp.address?.city}/>
                                      </div>

                                      {/* Konto bankowe */}
                                      <div className="bg-white border border-blue-100 rounded-lg p-3">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                          <CreditCard size={11}/> Konto bankowe
                                        </p>
                                        <EmpDetailRow label="IBAN" value={emp.finance?.payoutAccount?.iban} mono/>
                                        <EmpDetailRow label="Status" value={
                                          emp.finance?.payoutAccount?.iban
                                            ? (emp.finance.payoutAccount.isVerified ? 'Zweryfikowane ✓' : 'Niezweryfikowane')
                                            : undefined
                                        }/>
                                      </div>

                                      {/* Dane logowania */}
                                      <div className="bg-white border border-amber-200 rounded-lg p-3">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wide mb-2.5">
                                          <KeyRound size={11}/> Dostęp do platformy
                                        </p>
                                        <div className="space-y-1.5">
                                          <div>
                                            <span className="text-[10px] text-slate-400 block">Login</span>
                                            <span className="font-mono text-xs text-slate-700 break-all">{emp.email}</span>
                                          </div>
                                          <div>
                                            <span className="text-[10px] text-slate-400 block">Hasło dostępowe</span>
                                            {(emp as any).tempPassword ? (
                                              <div className="flex items-center gap-1">
                                                <span className="font-mono text-xs text-slate-700 flex-1">
                                                  {credState[emp.id]?.show ? (emp as any).tempPassword : '••••••••'}
                                                </span>
                                                <button type="button" onClick={e => { e.stopPropagation(); setCredField(emp.id, 'show', !credState[emp.id]?.show); }} className="text-slate-400 hover:text-slate-700">
                                                  {credState[emp.id]?.show ? <EyeOff size={11}/> : <Eye size={11}/>}
                                                </button>
                                                <button type="button" onClick={e => { e.stopPropagation(); handleCopyEmpCredentials(emp); }} className="text-slate-400 hover:text-amber-600">
                                                  {credState[emp.id]?.copied ? <Check size={11} className="text-emerald-500"/> : <Copy size={11}/>}
                                                </button>
                                              </div>
                                            ) : (
                                              <span className="text-[10px] text-slate-400 italic">Brak zapisanego hasła</span>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={e => { e.stopPropagation(); handleResetEmployeePassword(emp); }}
                                          disabled={credState[emp.id]?.resetting}
                                          className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 hover:bg-amber-100 disabled:opacity-50 transition"
                                        >
                                          {credState[emp.id]?.resetting
                                            ? <><RefreshCw size={10} className="animate-spin"/> Generowanie...</>
                                            : <><RefreshCw size={10}/> Generuj nowe hasło</>
                                          }
                                        </button>
                                      </div>

                                      {/* Zatrudnienie */}
                                      <div className="bg-white border border-blue-100 rounded-lg p-3">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                          <FileText size={11}/> Zatrudnienie
                                        </p>
                                        <EmpDetailRow label="Typ umowy" value={contract}/>
                                        <EmpDetailRow label="Od kiedy" value={emp.contract?.contractDateStart ? formatDate(emp.contract.contractDateStart) : undefined}/>
                                        <EmpDetailRow label="ID konta" value={emp.id} mono small/>
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pt-2.5 border-t border-blue-100">
                                      <button
                                        onClick={e => { e.stopPropagation(); setEmpHistoryEmployee(emp); }}
                                        className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition-colors">
                                        <History size={12}/> Historia voucherów
                                      </button>
                                      {isActive ? (
                                        <button
                                          onClick={e => { e.stopPropagation(); handleDeactivateEmployee(emp.id); }}
                                          className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded font-medium transition-colors">
                                          <UserX size={12}/> Dezaktywuj pracownika
                                        </button>
                                      ) : (
                                        <button
                                          onClick={e => { e.stopPropagation(); handleActivateEmployee(emp.id); }}
                                          className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded font-medium transition-colors">
                                          <CheckCircle2 size={12}/> Reaktywuj pracownika
                                        </button>
                                      )}
                                      <button
                                        onClick={e => { e.stopPropagation(); setExpandedEmployeeId(null); }}
                                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors">
                                        <ChevronUp size={12}/> Zwiń
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ TAB 4: PŁATNOŚCI I FAKTURY ════════════ */}
        {activeTab === 'PAYMENTS' && (
          <div className="max-w-5xl mx-auto space-y-4">

            {/* Banner nieuregulowanych */}
            {unpaidDocsCount > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0"/>
                <div className="flex-1">
                  <p className="font-semibold text-rose-800 text-sm">
                    {unpaidDocsCount === 1 ? 'Masz 1 nieuregulowany dokument' : `Masz ${unpaidDocsCount} nieuregulowane dokumenty`}
                  </p>
                  <p className="text-xs text-rose-600 mt-0.5">
                    Łączna kwota do zapłaty:{' '}
                    <strong>{formatCurrency(financialDocs.filter(d => d.status === 'pending').reduce((s, d) => s + Number(d.amount_gross), 0))}</strong>
                  </p>
                </div>
                <button onClick={fetchFinancialDocs} className="p-1 text-rose-400 hover:text-rose-600 transition-colors" title="Odśwież">
                  <RefreshCw size={14}/>
                </button>
              </div>
            )}

            {/* Przełącznik Noty / Faktury */}
            <div className="flex items-center gap-2">
              <div className="flex bg-white border border-gray-200 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setDocsTab('nota')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${docsTab === 'nota' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <FileText size={14}/> Noty obciążeniowe
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${docsTab === 'nota' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {financialDocs.filter(d => d.type === 'nota').length}
                  </span>
                </button>
                <button
                  onClick={() => setDocsTab('faktura_vat')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${docsTab === 'faktura_vat' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <CreditCard size={14}/> Faktury VAT
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${docsTab === 'faktura_vat' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {financialDocs.filter(d => d.type === 'faktura_vat').length}
                  </span>
                </button>
              </div>
              <button onClick={fetchFinancialDocs} disabled={docsLoading}
                className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                <RefreshCw size={13} className={docsLoading ? 'animate-spin' : ''}/> Odśwież
              </button>
            </div>

            {/* Opis sekcji */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1">
              {docsTab === 'nota' ? (
                <>
                  <p><strong>Nota obciążeniowa</strong> wystawiana jest przy potwierdzeniu zamówienia voucherów.</p>
                  <p>Vouchery wielofunkcyjne (MPV) są zwolnione z VAT przy emisji — podstawa: <strong>art. 8b ustawy o VAT</strong>. VAT rozliczany jest przez realizatora przy realizacji vouchera.</p>
                </>
              ) : (
                <>
                  <p><strong>Faktura VAT</strong> za obsługę serwisową wystawiana jest jednocześnie z notą.</p>
                  <p>Obejmuje opłatę za udostępnienie i dystrybucję voucherów pracownikom. Stawka VAT: <strong>23%</strong>.</p>
                </>
              )}
            </div>

            {/* Lista dokumentów */}
            {docsLoading ? (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                <Loader2 size={28} className="mx-auto text-blue-400 mb-3 animate-spin"/>
                <p className="text-gray-500 text-sm">Ładowanie dokumentów…</p>
              </div>
            ) : (() => {
              const docs = financialDocs.filter(d => d.type === docsTab);
              if (docs.length === 0) return (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                  <FileText size={32} className="mx-auto text-gray-300 mb-3"/>
                  <p className="text-gray-500 font-medium">
                    {docsTab === 'nota' ? 'Brak not obciążeniowych' : 'Brak faktur VAT'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Dokumenty pojawią się po potwierdzeniu pierwszego zamówienia
                  </p>
                </div>
              );
              return (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Nr dokumentu</th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Data wystawienia</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {docsTab === 'nota' ? 'Kwota (VAT 0%)' : 'Netto'}
                        </th>
                        {docsTab === 'faktura_vat' && (
                          <>
                            <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">VAT 23%</th>
                            <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Brutto</th>
                          </>
                        )}
                        <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {docs.map(doc => {
                        const isPaid = doc.status === 'paid';
                        return (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono text-xs text-gray-800 font-semibold">
                              {doc.document_number ?? '—'}
                              {doc.linked_order_id && (
                                <p className="text-gray-400 font-normal mt-0.5 truncate max-w-[180px]">
                                  Zam.: {doc.linked_order_id.slice(-8).toUpperCase()}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                              {formatDate(doc.issued_at)}
                              {isPaid && doc.payment_confirmed_at && (
                                <p className="text-emerald-600 mt-0.5">Opłacono: {formatDate(doc.payment_confirmed_at)}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-800">
                              {formatCurrency(Number(doc.amount_net))}
                            </td>
                            {docsTab === 'faktura_vat' && (
                              <>
                                <td className="py-3 px-4 text-right text-gray-600">
                                  {formatCurrency(Number(doc.vat_amount))}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-gray-900">
                                  {formatCurrency(Number(doc.amount_gross))}
                                </td>
                              </>
                            )}
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {isPaid ? <CheckCircle2 size={11}/> : <Clock size={11}/>}
                                {isPaid ? 'Opłacone' : 'Oczekuje'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {doc.pdf_url ? (
                                <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                                  <Download size={13}/> Pobierz
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ════════════════ TAB 5: ANULOWANIE SUBSKRYPCJI ════════════ */}
        {activeTab === 'BUYBACK' && (
          <div className="space-y-4">

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Anulowanie subskrypcji — odkup voucherów</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Pracownicy, których vouchery wygasły i nie zostały przedłużone, mogą otrzymać wypłatę gotówkową (1 voucher = 1 PLN).
                    Po wygenerowaniu paczki przelewów plik CSV zostanie pobrany automatycznie.
                  </p>
                </div>
                <button
                  onClick={fetchBuybackBatches}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
                >
                  <RefreshCw size={13}/> Odśwież
                </button>
              </div>
            </div>

            {/* Pending employees — kartoteka style */}
            <div className="space-y-3">

              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input
                    value={buybackEmpSearch}
                    onChange={e => setBuybackEmpSearch(e.target.value)}
                    placeholder="Szukaj po nazwisku, PESEL, emailu..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                  {(['ALL','ACTIVE','INACTIVE'] as const).map(f => {
                    const count = f === 'ALL'
                      ? myEmployees.length
                      : myEmployees.filter(u => u.status === (f === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE')).length;
                    return (
                      <button key={f} onClick={() => setBuybackEmpFilter(f)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                          buybackEmpFilter === f ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        {f === 'ALL' ? 'Wszyscy' : f === 'ACTIVE' ? 'Aktywni' : 'Nieaktywni'}
                        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                          buybackEmpFilter === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
                {buybackPendingEmployees.length > 0 && (
                  <button
                    onClick={handleGenerateBatch}
                    disabled={generatingBatch}
                    className="ml-auto flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-60 shrink-0"
                  >
                    {generatingBatch ? <><Loader2 size={14} className="animate-spin"/> Generuję...</> : <><Download size={14}/> Wygeneruj paczkę przelewów</>}
                  </button>
                )}
              </div>

              {batchGenSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 size={16} className="text-green-600 flex-shrink-0"/>
                  <p className="text-sm text-green-700">{batchGenSuccess}</p>
                </div>
              )}
              {batchGenError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0"/>
                  <p className="text-sm text-red-700">{batchGenError}</p>
                </div>
              )}

              <div className="bg-white rounded-lg overflow-hidden shadow-sm" style={{ border: '1px solid #d1d5db' }}>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#1e3a5f' }}>
                        {['LP','Imię','Nazwisko','PESEL','Adres e-mail','Telefon','Dział','Stanowisko','Typ umowy','Vouchery po terminie','Status',''].map((h, i) => (
                          <th key={i} style={{
                            border: '1px solid #16304f', padding: '9px 11px',
                            color: '#fff', fontWeight: 600, fontSize: 11,
                            textAlign: i === 0 ? 'center' : i === 9 ? 'right' : i === 10 ? 'center' : 'left',
                            whiteSpace: 'nowrap',
                            width: i === 0 ? 44 : i === 11 ? 36 : undefined,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBuybackEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px solid #e5e7eb', background: '#fff' }}>
                            Brak pracowników spełniających kryteria wyszukiwania.
                          </td>
                        </tr>
                      ) : (
                        filteredBuybackEmployees.map((emp, idx) => {
                          const isExpanded = expandedEmployeeId === emp.id;
                          const isActive   = emp.status === 'ACTIVE';
                          const firstName  = emp.identity?.firstName ?? emp.name.split(' ')[0] ?? emp.name;
                          const lastName   = emp.identity?.lastName  ?? emp.name.split(' ').slice(1).join(' ') ?? '';
                          const phone      = emp.identity?.phoneNumber ?? '';
                          const dept       = emp.department ?? emp.organization?.department ?? '';
                          const pos        = emp.position   ?? emp.organization?.position   ?? '';
                          const contract   = emp.contract?.type === ContractType.UZ ? 'Umowa Zlecenie' : 'Umowa o Pracę';
                          const expiredCount = expiredCountByEmpId.get(emp.id) ?? 0;
                          const hasExpired = expiredCount > 0;
                          const rowBg = isExpanded ? '#eff6ff' : hasExpired ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                          const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
                            border: '1px solid #e5e7eb', padding: '7px 11px',
                            background: rowBg,
                            ...extra,
                          });
                          return (
                            <React.Fragment key={emp.id}>
                              <tr
                                onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                                style={{ cursor: 'pointer', opacity: isActive ? 1 : 0.65 }}
                                className="hover:bg-blue-50 transition-colors"
                              >
                                <td style={{ ...cell(), textAlign: 'center', color: '#9ca3af' }}>{idx + 1}</td>
                                <td style={cell({ fontWeight: 500, color: '#111827' })}>{firstName}</td>
                                <td style={cell({ fontWeight: 500, color: '#111827' })}>{lastName}</td>
                                <td style={cell({ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' })}>{emp.pesel ?? '—'}</td>
                                <td style={cell({ color: '#374151' })}>{emp.email ?? '—'}</td>
                                <td style={cell({ color: '#6b7280' })}>{phone || '—'}</td>
                                <td style={cell({ color: '#6b7280' })}>{dept || '—'}</td>
                                <td style={cell({ color: '#6b7280' })}>{pos || '—'}</td>
                                <td style={cell({ color: '#6b7280', fontSize: 11, whiteSpace: 'nowrap' })}>{contract}</td>
                                <td style={cell({ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: hasExpired ? '#b45309' : '#9ca3af' })}>
                                  {hasExpired ? `${expiredCount} szt.` : '—'}
                                </td>
                                <td style={cell({ textAlign: 'center' })}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 999,
                                    background: isActive ? '#d1fae5' : '#f3f4f6',
                                    color: isActive ? '#065f46' : '#6b7280',
                                  }}>
                                    {isActive ? 'Aktywny' : 'Nieaktywny'}
                                  </span>
                                </td>
                                <td style={cell({ textAlign: 'center', color: '#9ca3af' })}>
                                  {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr>
                                  <td colSpan={12} style={{ padding: 0, background: '#eff6ff', borderBottom: '1px solid #e5e7eb' }}>
                                    <div className="px-5 py-4">
                                      <div className="grid grid-cols-5 gap-3 mb-3">

                                        {/* Dane kontaktowe */}
                                        <div className="bg-white border border-blue-100 rounded-lg p-3">
                                          <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                            <Mail size={11}/> Kontakt
                                          </p>
                                          <EmpDetailRow label="E-mail" value={emp.email}/>
                                          <EmpDetailRow label="Telefon" value={emp.identity?.phoneNumber}/>
                                        </div>

                                        {/* Adres */}
                                        <div className="bg-white border border-blue-100 rounded-lg p-3">
                                          <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                            <MapPin size={11}/> Adres
                                          </p>
                                          <EmpDetailRow label="Ulica" value={emp.address?.street}/>
                                          <EmpDetailRow label="Kod poczt." value={(emp.address as any)?.zipCode}/>
                                          <EmpDetailRow label="Miasto" value={emp.address?.city}/>
                                        </div>

                                        {/* Konto bankowe */}
                                        <div className="bg-white border border-blue-100 rounded-lg p-3">
                                          <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                            <CreditCard size={11}/> Konto bankowe
                                          </p>
                                          <EmpDetailRow label="IBAN" value={emp.finance?.payoutAccount?.iban} mono/>
                                          <EmpDetailRow label="Status" value={
                                            emp.finance?.payoutAccount?.iban
                                              ? (emp.finance.payoutAccount.isVerified ? 'Zweryfikowane ✓' : 'Niezweryfikowane')
                                              : undefined
                                          }/>
                                        </div>

                                        {/* Dane logowania */}
                                        <div className="bg-white border border-amber-200 rounded-lg p-3">
                                          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wide mb-2.5">
                                            <KeyRound size={11}/> Dostęp do platformy
                                          </p>
                                          <div className="space-y-1.5">
                                            <div>
                                              <span className="text-[10px] text-slate-400 block">Login</span>
                                              <span className="font-mono text-xs text-slate-700 break-all">{emp.email}</span>
                                            </div>
                                            <div>
                                              <span className="text-[10px] text-slate-400 block">Hasło dostępowe</span>
                                              {(emp as any).tempPassword ? (
                                                <div className="flex items-center gap-1">
                                                  <span className="font-mono text-xs text-slate-700 flex-1">
                                                    {credState[emp.id]?.show ? (emp as any).tempPassword : '••••••••'}
                                                  </span>
                                                  <button type="button" onClick={e => { e.stopPropagation(); setCredField(emp.id, 'show', !credState[emp.id]?.show); }} className="text-slate-400 hover:text-slate-700">
                                                    {credState[emp.id]?.show ? <EyeOff size={11}/> : <Eye size={11}/>}
                                                  </button>
                                                  <button type="button" onClick={e => { e.stopPropagation(); handleCopyEmpCredentials(emp); }} className="text-slate-400 hover:text-amber-600">
                                                    {credState[emp.id]?.copied ? <Check size={11} className="text-emerald-500"/> : <Copy size={11}/>}
                                                  </button>
                                                </div>
                                              ) : (
                                                <span className="text-[10px] text-slate-400 italic">Brak zapisanego hasła</span>
                                              )}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); handleResetEmployeePassword(emp); }}
                                            disabled={credState[emp.id]?.resetting}
                                            className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 hover:bg-amber-100 disabled:opacity-50 transition"
                                          >
                                            {credState[emp.id]?.resetting
                                              ? <><RefreshCw size={10} className="animate-spin"/> Generowanie...</>
                                              : <><RefreshCw size={10}/> Generuj nowe hasło</>
                                            }
                                          </button>
                                        </div>

                                        {/* Zatrudnienie */}
                                        <div className="bg-white border border-blue-100 rounded-lg p-3">
                                          <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                            <FileText size={11}/> Zatrudnienie
                                          </p>
                                          <EmpDetailRow label="Typ umowy" value={contract}/>
                                          <EmpDetailRow label="Od kiedy" value={emp.contract?.contractDateStart ? formatDate(emp.contract.contractDateStart) : undefined}/>
                                          <EmpDetailRow label="ID konta" value={emp.id} mono small/>
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="flex items-center gap-2 pt-2.5 border-t border-blue-100">
                                        <button
                                          onClick={e => { e.stopPropagation(); setEmpHistoryEmployee(emp); }}
                                          className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition-colors">
                                          <History size={12}/> Historia voucherów
                                        </button>
                                        {isActive ? (
                                          <button
                                            onClick={e => { e.stopPropagation(); handleDeactivateEmployee(emp.id); }}
                                            className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded font-medium transition-colors">
                                            <UserX size={12}/> Dezaktywuj pracownika
                                          </button>
                                        ) : (
                                          <button
                                            onClick={e => { e.stopPropagation(); handleActivateEmployee(emp.id); }}
                                            className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded font-medium transition-colors">
                                            <CheckCircle2 size={12}/> Reaktywuj pracownika
                                          </button>
                                        )}
                                        <button
                                          onClick={e => { e.stopPropagation(); setExpandedEmployeeId(null); }}
                                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors">
                                          <ChevronUp size={12}/> Zwiń
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* History */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Historia paczek przelewów</h3>
              </div>

              {buybackLoading ? (
                <div className="p-12 text-center">
                  <Loader2 size={28} className="mx-auto text-blue-400 mb-3 animate-spin"/>
                  <p className="text-gray-500 text-sm">Ładowanie historii…</p>
                </div>
              ) : buybackError ? (
                <div className="p-6 text-center">
                  <AlertCircle size={24} className="mx-auto text-red-400 mb-2"/>
                  <p className="text-red-500 text-sm">{buybackError}</p>
                </div>
              ) : buybackBatches.length === 0 ? (
                <div className="p-12 text-center">
                  <History size={32} className="mx-auto text-gray-300 mb-3"/>
                  <p className="text-gray-500 font-medium">Brak historii paczek</p>
                  <p className="text-sm text-gray-400 mt-1">Wygenerowane paczki pojawią się tu</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Okres</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Data wygenerowania</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Vouchery</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Kwota</th>
                      <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {buybackBatches.map((batch: any) => (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-800">{batch.period_label ?? '—'}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {batch.created_at ? formatDate(batch.created_at) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700">{batch.voucher_count ?? 0}</td>
                        <td className="py-3 px-4 text-right font-bold text-blue-700">
                          {Number(batch.total_amount ?? 0).toFixed(2)} PLN
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 size={11}/> {batch.status ?? 'completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Order Picker Modal */}
      {showOrderPickerModal && (
        <HROrderPickerModal
          orders={myHrOrders}
          company={company}
          onClose={() => setShowOrderPickerModal(false)}
        />
      )}

      {/* Employee Voucher History Modal */}
      {empHistoryEmployee && (
        <HROrderHistoryModal
          employee={empHistoryEmployee}
          hrOrders={hrOrders}
          company={company}
          onClose={() => setEmpHistoryEmployee(null)}
        />
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <HRAddEmployeeModal
          company={company}
          onClose={() => setShowAddModal(false)}
          onSaved={(newUser) => {
            setShowAddModal(false);
            // Add to local state immediately so it appears in the table without waiting for API refresh
            actions.setUsers(prev => {
              if (prev.some(u => u.email === newUser.email)) return prev;
              return [...prev, { ...newUser, companyId: company.id }];
            });
            setExpandedEmployeeId(newUser.id);
          }}
        />
      )}

      {/* ── Cleanup Modal ───────────────────────────────────────────── */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <Trash2 size={20} className="text-white" />
              <div>
                <h2 className="text-white font-bold text-base">Wyczyść dane klienta</h2>
                <p className="text-red-200 text-xs mt-0.5">{company.name}</p>
              </div>
              <button onClick={() => setShowCleanupModal(false)} className="ml-auto text-red-200 hover:text-white transition">
                <X size={18}/>
              </button>
            </div>

            <div className="px-6 py-5">
              {!cleanupResult ? (
                <>
                  <p className="text-sm text-gray-700 mb-3">
                    Operacja <strong className="text-red-600">trwale usunie</strong> dla tej firmy:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1.5 mb-5">
                    {[
                      'Historię zamówień voucherów',
                      'Wszystkie vouchery (aktywne, wygasłe, odkupione)',
                      'Kartotkę pracowników (profile i konta voucherowe)',
                      'Faktury i noty księgowe',
                      'Batche odkupów i transakcje',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-red-100 text-red-600 text-[10px] flex items-center justify-center font-bold shrink-0">{i+1}</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex gap-2">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Konto HR i dane firmy (<strong>{company.name}</strong>) pozostają nienaruszone.
                      Operacji nie można cofnąć.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCleanupModal(false)}
                      className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleCompanyCleanup}
                      disabled={cleanupLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-60"
                    >
                      {cleanupLoading
                        ? <><Loader2 size={14} className="animate-spin"/> Czyszczę…</>
                        : <><Trash2 size={14}/> Wyczyść</>
                      }
                    </button>
                  </div>
                </>
              ) : cleanupResult.ok ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={20} className="text-green-500" />
                    <p className="text-sm font-semibold text-gray-800">Dane wyczyszczone pomyślnie</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1 mb-5">
                    {Object.entries(cleanupResult.deleted ?? {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-mono font-semibold text-gray-700">{v} usuniętych</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowCleanupModal(false)}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                  >
                    Zamknij
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={18} className="text-red-500" />
                    <p className="text-sm font-semibold text-red-700">Błąd podczas czyszczenia</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-5 bg-red-50 p-3 rounded-lg">{cleanupResult.error}</p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowCleanupModal(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition">Zamknij</button>
                    <button onClick={handleCompanyCleanup} className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition">Spróbuj ponownie</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

