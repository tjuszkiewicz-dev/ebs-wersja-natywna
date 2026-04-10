// POST /api/vouchers/expire — marks distributed vouchers past their valid_until as expired
// Safe to call repeatedly (idempotent). HR/superadmin only.
// Optional body: { companyId: "uuid" } — if omitted, expires all companies.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();

  let companyId: string | null = null;

  // HR can only expire their own company; superadmin can pass any companyId
  if (auth.role === 'pracodawca') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    companyId = profile?.company_id ?? null;
  } else {
    const body = await req.json().catch(() => ({}));
    companyId = body?.companyId ?? null;
  }

  const { data: expired, error } = await supabase.rpc('expire_overdue_vouchers', {
    p_company_id: companyId,
  } as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expired: expired ?? 0 });
}
