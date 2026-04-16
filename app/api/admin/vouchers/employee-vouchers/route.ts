// GET /api/admin/vouchers/employee-vouchers?userId=UUID&companyId=UUID
// Lazy-load individual voucher records for one employee.
// Called when admin expands an employee row in the voucher tree.
// Bypasses Supabase 1000-row limit via get_employee_vouchers() SECURITY DEFINER RPC.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId    = req.nextUrl.searchParams.get('userId');
  const companyId = req.nextUrl.searchParams.get('companyId');

  if (!userId || !companyId) {
    return NextResponse.json({ error: 'Wymagany userId i companyId' }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc('get_employee_vouchers', {
    p_user_id:    userId,
    p_company_id: companyId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vouchers: data ?? [] });
}
