// GET /api/admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
// Agregowane dane dla pulpitu admina (jedno wywołanie).
// Wymaga roli superadmin.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const parsed = QuerySchema.safeParse({
    from: searchParams.get('from'),
    to:   searchParams.get('to'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Wymagane parametry: from, to (YYYY-MM-DD)' }, { status: 400 });
  }

  const { from, to } = parsed.data;
  const fromISO = `${from}T00:00:00.000Z`;
  const toISO   = `${to}T23:59:59.999Z`;

  const supabase = supabaseServer();

  const [
    ordersResult,
    commissionsResult,
    companiesResult,
    orderedChartResult,
    redeemedChartResult,
    buybackChartResult,
  ] = await Promise.all([
    // Wyemitowane vouchery z zamówień w okresie
    supabase
      .from('voucher_orders')
      .select('amount_vouchers')
      .in('status', ['approved', 'paid'])
      .gte('created_at', fromISO)
      .lte('created_at', toISO),

    // Prowizje naliczone w okresie
    supabase
      .from('commissions')
      .select('amount_pln')
      .gte('created_at', fromISO)
      .lte('created_at', toISO),

    // Liczba firm (wszystkie)
    supabase
      .from('companies')
      .select('*', { count: 'exact', head: true }),

    // Zamówione vouchery (wartość PLN) per dzień
    supabase
      .from('voucher_orders')
      .select('created_at, amount_pln')
      .in('status', ['approved', 'paid'])
      .gte('created_at', fromISO)
      .lte('created_at', toISO),

    // Zrealizowane vouchery (typ: wykorzystanie) per dzień
    supabase
      .from('voucher_transactions')
      .select('created_at, amount')
      .eq('type', 'wykorzystanie')
      .gte('created_at', fromISO)
      .lte('created_at', toISO),

    // Odkup voucherów per dzień
    supabase
      .from('buyback_agreements')
      .select('created_at, total_value')
      .gte('created_at', fromISO)
      .lte('created_at', toISO),
  ]);

  const vouchersIssued = (ordersResult.data ?? []).reduce(
    (sum, o) => sum + (Number(o.amount_vouchers) || 0), 0
  );
  const commissionsTotal = (commissionsResult.data ?? []).reduce(
    (sum, c) => sum + (Number(c.amount_pln) || 0), 0
  );

  // Agregacja dziennych danych do wykresu
  const chartMap = new Map<string, { ordered: number; redeemed: number; buybacks: number }>();

  const getDay = (iso: string) => iso.slice(0, 10);
  const ensureDay = (day: string) => {
    if (!chartMap.has(day)) chartMap.set(day, { ordered: 0, redeemed: 0, buybacks: 0 });
    return chartMap.get(day)!;
  };

  for (const o of orderedChartResult.data ?? []) {
    ensureDay(getDay(o.created_at)).ordered += Number(o.amount_pln) || 0;
  }
  for (const r of redeemedChartResult.data ?? []) {
    ensureDay(getDay(r.created_at)).redeemed += Number(r.amount) || 0;
  }
  for (const b of buybackChartResult.data ?? []) {
    ensureDay(getDay(b.created_at)).buybacks += Number(b.total_value) || 0;
  }

  const chart = Array.from(chartMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  return NextResponse.json({
    stats: {
      vouchersIssued,
      commissionsTotal: parseFloat(commissionsTotal.toFixed(2)),
      activeCompanies:  companiesResult.count ?? 0,
    },
    chart,
  });
}
