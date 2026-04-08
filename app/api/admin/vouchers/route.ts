// GET  /api/admin/vouchers?page=1&limit=50&companyId=&status=&search=
// Returns paginated voucher list with company + owner names joined.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();
  const { searchParams } = req.nextUrl;
  const page      = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit     = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')));
  const companyId = searchParams.get('companyId') || null;
  const status    = searchParams.get('status')    || null;
  const search    = searchParams.get('search')    || null;

  // Run expiry sweep before listing
  await (supabase.rpc as any)('expire_overdue_vouchers', { p_company_id: companyId });

  let query = supabase
    .from('vouchers')
    .select(`
      id,
      serial_number,
      face_value_pln,
      status,
      company_id,
      current_owner_id,
      issued_at,
      valid_until,
      redeemed_at,
      buyback_agreement_id,
      companies ( name, nip )
    `, { count: 'exact' })
    .order('issued_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (companyId) query = query.eq('company_id', companyId);
  if (status)    query = query.eq('status', status as any);
  if (search)    query = query.ilike('serial_number', `%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const vouchers = data ?? [];

  // Fetch owner profiles separately (current_owner_id → auth.users, not user_profiles FK)
  const ownerIds = [...new Set(vouchers.map((v: any) => v.current_owner_id).filter(Boolean))];
  let ownerMap: Record<string, { full_name: string | null; role: string }> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .in('id', ownerIds);
    for (const p of profiles ?? []) ownerMap[p.id] = { full_name: p.full_name, role: p.role };
  }

  const result = vouchers.map((v: any) => ({
    ...v,
    user_profiles: v.current_owner_id ? (ownerMap[v.current_owner_id] ?? null) : null,
  }));

  return NextResponse.json({ vouchers: result, total: count ?? 0, page, limit });
}
