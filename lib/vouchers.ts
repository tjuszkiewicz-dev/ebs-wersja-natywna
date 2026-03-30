// ── Warstwa domenowa voucherów ────────────────────────────────────────────────
// Wszystkie operacje na voucherach przechodzą przez ten plik.
// Zasady:
//   • Saldo tylko przez transfer_vouchers() / mint_vouchers() — nigdy bezpośredni UPDATE
//   • Ledger append-only — żaden kod nie robi UPDATE/DELETE na voucher_transactions
//   • Prowizje zawsze w PLN — amount_pln, nigdy w voucherach
//   • Numery seryjne tylko przez generate_voucher_serial() w bazie

import { supabaseServer } from './supabase';
import { COMMISSION_RATES } from '../utils/config';
import { ROLE_TO_DB } from './roleMap';
import { Role } from '../types';
import type {
  VoucherAccount,
  VoucherTransaction,
  VoucherOrder,
  Voucher,
  Commission,
  TransactionHistoryItem,
  OrderWithCompany,
  PurchaseVouchersParams,
  TransferVouchersParams,
  RedeemVoucherParams,
  ApiResult,
} from '../types/vouchers';

// ---------------------------------------------------------------------------
// SALDO
// ---------------------------------------------------------------------------

/** Pobierz aktualne saldo voucherowe użytkownika */
export async function getVoucherBalance(userId: string): Promise<ApiResult<number>> {
  const db = supabaseServer();
  const { data, error } = await db
    .from('voucher_accounts')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { data: null, error: { message: error?.message ?? 'No data', code: error?.code } };
  return { data: data.balance, error: null };
}

// ---------------------------------------------------------------------------
// HISTORIA TRANSAKCJI
// ---------------------------------------------------------------------------

/** Pobierz historię transakcji użytkownika (ledger) */
export async function getTransactionHistory(
  userId: string,
  limit = 50
): Promise<ApiResult<TransactionHistoryItem[]>> {
  const db = supabaseServer();
  const { data, error } = await db
    .from('voucher_transactions')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: { message: error.message, code: error.code } };
  return { data: data as TransactionHistoryItem[], error: null };
}

// ---------------------------------------------------------------------------
// TRANSFER VOUCHERÓW
// ---------------------------------------------------------------------------

/** Atomiczny transfer voucherów między użytkownikami (wywołuje SQL transfer_vouchers()) */
export async function transferVouchers(
  params: TransferVouchersParams
): Promise<ApiResult<void>> {
  const db = supabaseServer();
  const { error } = await db.rpc('transfer_vouchers', {
    p_from_user_id: params.fromUserId,
    p_to_user_id:   params.toUserId,
    p_amount:       params.amount,
    p_type:         params.type,
    p_order_id:     params.orderId ?? null,
  });

  if (error) return { data: null, error: { message: error.message, code: error.code } };
  return { data: undefined, error: null };
}

// ---------------------------------------------------------------------------
// ZAKUP VOUCHERÓW (pracodawca)
// ---------------------------------------------------------------------------

/**
 * Tworzy zamówienie, emituje vouchery i nalicza prowizje.
 * Wywoływana po potwierdzeniu płatności przez administratora.
 */
export async function purchaseVouchers(
  params: PurchaseVouchersParams
): Promise<ApiResult<VoucherOrder>> {
  const db = supabaseServer();

  const amountVouchers = Math.floor(params.amountPln);
  const feeRate        = COMMISSION_RATES.ADVISOR_FIRST_INVOICE; // 45% — pierwsza faktura
  const feePln         = parseFloat((params.amountPln * feeRate).toFixed(2));
  const totalPln       = parseFloat((params.amountPln + feePln).toFixed(2));

  // 1. Utwórz zamówienie
  const { data: order, error: orderError } = await db
    .from('voucher_orders')
    .insert({
      company_id:       params.companyId,
      hr_user_id:       params.hrUserId,
      amount_pln:       params.amountPln,
      amount_vouchers:  amountVouchers,
      fee_pln:          feePln,
      total_pln:        totalPln,
      status:           'pending' as const,
      is_first_invoice: params.isFirstInvoice ?? false,
    })
    .select()
    .single();

  if (orderError || !order) return { data: null, error: { message: orderError?.message ?? 'No data' } };

  // 2. Emituj vouchery (masowa emisja przez SQL mint_vouchers())
  const { error: mintError } = await db.rpc('mint_vouchers', {
    p_order_id:     order.id,
    p_company_id:   params.companyId,
    p_owner_id:     params.hrUserId,
    p_quantity:     amountVouchers,
    p_valid_months: params.validMonths ?? 12,
  });

  if (mintError) return { data: null, error: { message: mintError.message } };

  // 3. Oznacz zamówienie jako opłacone
  const { data: paidOrder, error: paidError } = await db
    .from('voucher_orders')
    .update({ status: 'paid' as const })
    .eq('id', order.id)
    .select()
    .single();

  if (paidError || !paidOrder) return { data: null, error: { message: paidError?.message ?? 'No data' } };

  return { data: paidOrder as VoucherOrder, error: null };
}

// ---------------------------------------------------------------------------
// LISTA VOUCHERÓW
// ---------------------------------------------------------------------------

/** Pobierz listę fizycznych voucherów użytkownika */
export async function getVouchers(
  userId: string,
  status?: Voucher['status']
): Promise<ApiResult<Voucher[]>> {
  const db = supabaseServer();
  let query = db
    .from('vouchers')
    .select('*')
    .eq('current_owner_id', userId)
    .order('issued_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return { data: null, error: { message: error.message } };
  return { data: data as Voucher[], error: null };
}

// ---------------------------------------------------------------------------
// REALIZACJA VOUCHERA
// ---------------------------------------------------------------------------

/** Realizacja pojedynczego vouchera przez numer seryjny */
export async function redeemVoucher(
  params: RedeemVoucherParams
): Promise<ApiResult<string>> {
  const db = supabaseServer();
  const { data, error } = await db.rpc('redeem_voucher', {
    p_serial_number: params.serialNumber,
    p_user_id:       params.userId,
    p_service_id:    params.serviceId   ?? null,
    p_service_name:  params.serviceName ?? null,
  });

  if (error) return { data: null, error: { message: error.message } };
  return { data: data as string, error: null };
}

// ---------------------------------------------------------------------------
// ZAMÓWIENIA
// ---------------------------------------------------------------------------

/** Pobierz zamówienia firmy */
export async function getCompanyOrders(companyId: string): Promise<ApiResult<VoucherOrder[]>> {
  const db = supabaseServer();
  const { data, error } = await db
    .from('voucher_orders')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: { message: error.message } };
  return { data: data as VoucherOrder[], error: null };
}

// ---------------------------------------------------------------------------
// PROWIZJE
// ---------------------------------------------------------------------------

/** Pobierz prowizje agenta */
export async function getAgentCommissions(agentId: string): Promise<ApiResult<Commission[]>> {
  const db = supabaseServer();
  const { data, error } = await db
    .from('commissions')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: { message: error.message } };
  return { data: data as Commission[], error: null };
}

/**
 * Nalicz prowizje dla agentów przy zamówieniu.
 * Prowizje zawsze w PLN — nigdy w voucherach.
 */
export async function calculateAndSaveCommissions(
  orderId: string,
  orderAmountPln: number,
  companyId: string,
  isFirstInvoice: boolean
): Promise<ApiResult<void>> {
  const db = supabaseServer();

  // Pobierz strukturę sprzedaży dla firmy
  const { data: company } = await db
    .from('companies')
    .select('advisor_id, manager_id, director_id')
    .eq('id', companyId)
    .single();

  if (!company) return { data: undefined, error: null };

  const commissionsToInsert: Array<{
    agent_id: string;
    agent_name: string;
    agent_role: 'partner' | 'menedzer' | 'dyrektor';
    commission_type: 'acquisition' | 'recurring';
    order_id: string;
    amount_pln: number;
    rate: string;
    is_paid: boolean;
  }> = [];

  const addCommission = async (
    agentId: string | null,
    role: 'partner' | 'menedzer' | 'dyrektor',
    rate: number,
    type: 'acquisition' | 'recurring'
  ) => {
    if (!agentId) return;
    const { data: profile } = await db
      .from('user_profiles')
      .select('full_name')
      .eq('id', agentId)
      .single();

    commissionsToInsert.push({
      agent_id:        agentId,
      agent_name:      profile?.full_name ?? 'Agent',
      agent_role:      role,
      commission_type: type,
      order_id:        orderId,
      amount_pln:      parseFloat((orderAmountPln * rate).toFixed(2)),
      rate:            `${(rate * 100).toFixed(0)}%`,
      is_paid:         false,
    });
  };

  if (isFirstInvoice) {
    // Pierwsza faktura: prowizja jednorazowa dla doradcy (45%)
    await addCommission(company.advisor_id, 'partner', COMMISSION_RATES.ADVISOR_FIRST_INVOICE, 'acquisition');
  } else {
    // Kolejne faktury: prowizje cykliczne
    await addCommission(company.advisor_id,  'partner',   COMMISSION_RATES.ADVISOR_RECURRING,  'recurring');
    await addCommission(company.manager_id,  'menedzer',  COMMISSION_RATES.MANAGER_RECURRING,  'recurring');
    await addCommission(company.director_id, 'dyrektor',  COMMISSION_RATES.DIRECTOR_RECURRING, 'recurring');
  }

  if (commissionsToInsert.length === 0) return { data: undefined, error: null };

  const { error } = await db.from('commissions').insert(commissionsToInsert);
  if (error) return { data: null, error: { message: error.message } };
  return { data: undefined, error: null };
}
