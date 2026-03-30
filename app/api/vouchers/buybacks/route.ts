// GET /api/vouchers/buybacks — lista umów odkupu
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(_req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = supabaseServer();

  let query = supabase
    .from('buyback_agreements')
    .select('*')
    .order('created_at', { ascending: false });

  if (auth.role === 'pracownik') {
    query = query.eq('user_id', auth.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
