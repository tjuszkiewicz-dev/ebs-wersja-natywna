// GET /api/orders?companyId=... — lista zamówień firmy
// POST /api/orders — złóż zamówienie (pracodawca / superadmin)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole, unauthorized, badRequest, serverError } from '@/lib/apiAuth';
import { getCompanyOrders } from '@/lib/vouchers';
import { supabaseServer } from '@/lib/supabase';
import { calculateOrderTotals, FINANCIAL_CONSTANTS } from '@/utils/financialMath';

const QuerySchema = z.object({
  companyId: z.string().min(1),
});

const PlaceOrderSchema = z.object({
  companyId:        z.string().min(1),
  hrUserId:         z.string().optional(),
  amount:           z.number().positive().max(1_000_000),
  distributionPlan: z.array(z.any()).optional(),
  snapshots:        z.array(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return unauthorized();

  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({ companyId: searchParams.get('companyId') });

  if (!parsed.success) {
    return badRequest('Wymagany parametr: companyId (UUID)');
  }

  const result = await getCompanyOrders(parsed.data.companyId);
  if (result.error) return serverError(result.error.message);

  return Response.json({ data: result.data, error: null });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = PlaceOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companyId, hrUserId, amount, distributionPlan, snapshots } = parsed.data;
  const supabase = supabaseServer();
  const year = new Date().getFullYear();
  const uniqueSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // W trybie dev-proxy auth.id = 'dev-vite' — użyj hrUserId z body (prawdziwy UUID z frontendu)
  const resolvedHrUserId = UUID_RE.test(auth.id) ? auth.id : (hrUserId && UUID_RE.test(hrUserId) ? hrUserId : null);

  // Check whether this is the company's first paid invoice
  const { count } = await supabase
    .from('voucher_orders')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'paid');

  const isFirstInvoice = (count ?? 0) === 0;

  // Pobierz fee_percent firmy — fallback do DEFAULT_SUCCESS_FEE (20%)
  const { data: companyData } = await supabase
    .from('companies')
    .select('fee_percent')
    .eq('id', companyId)
    .single();
  const companyFeeRate = ((companyData as any)?.fee_percent ?? (FINANCIAL_CONSTANTS.DEFAULT_SUCCESS_FEE * 100)) / 100;

  const totals = calculateOrderTotals(amount, companyFeeRate);

  const { data: order, error } = await supabase
    .from('voucher_orders')
    .insert({
      company_id:        companyId,
      // auth.id może być 'dev-vite' w trybie dev proxy — UUID regex guard
      hr_user_id:        resolvedHrUserId,
      amount_pln:        totals.voucherValue,
      amount_vouchers:   Math.floor(totals.voucherValue),
      fee_pln:           totals.feeGross,
      total_pln:         totals.totalPayable,
      status:            'pending',
      is_first_invoice:  isFirstInvoice,
      doc_voucher_id:    `NK/${year}/${uniqueSuffix}/B`,
      doc_fee_id:        `FV/${year}/${uniqueSuffix}/S`,
      distribution_plan: distributionPlan ?? null,
      payroll_snapshots: snapshots ?? null,
    })
    .select()
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Nie udało się utworzyć zamówienia' }, { status: 500 });
  }

  return NextResponse.json(order, { status: 201 });
}
