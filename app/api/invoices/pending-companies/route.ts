// GET /api/invoices/pending-companies
// Zwraca tablicę company_id firm, które mają co najmniej jedno nieopłacone zamówienie (status='approved').
// Lightweight — brak JOINów, tylko superadmin.

import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  // Zamówienia ze statusem 'approved' = zatwierdzone przez HR ale jeszcze nieopłacone przez admina
  const { data, error } = await supabase
    .from('voucher_orders')
    .select('company_id')
    .eq('status', 'approved');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uniqueIds = [...new Set((data ?? []).map((r: any) => r.company_id as string))];
  return NextResponse.json(uniqueIds);
}
