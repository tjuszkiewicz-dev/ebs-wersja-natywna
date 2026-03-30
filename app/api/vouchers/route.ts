// GET /api/vouchers?companyId=UUID  — lista voucherów firmy (dla HR/superadmin)
// GET /api/vouchers?userId=UUID     — lista voucherów użytkownika (dla pracownika)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = supabaseServer();
  const { searchParams } = req.nextUrl;
  const companyId = searchParams.get('companyId');
  const userId    = searchParams.get('userId');

  if (userId) {
    // Pracownik: jego własne vouchery
    if (auth.id !== userId && auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('current_owner_id', userId)
      .order('issued_at', { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (companyId) {
    // HR/superadmin: vouchery firmy
    if (!['superadmin', 'pracodawca'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('company_id', companyId)
      .order('issued_at', { ascending: false })
      .limit(2000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  return NextResponse.json({ error: 'Wymagany parametr: companyId lub userId' }, { status: 400 });
}
