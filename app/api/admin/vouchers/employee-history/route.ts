// GET /api/admin/vouchers/employee-history?userId=UUID
// Returns all distribution batch records for one employee (full history).
// Source: distribution_batch_items JOIN distribution_batches.
// Enables per-employee monthly voucher allocation statement.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Wymagany userId' }, { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc('get_employee_voucher_history', {
    p_user_id: userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}
