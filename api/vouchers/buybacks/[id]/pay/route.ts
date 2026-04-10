// PATCH /api/vouchers/buybacks/[id]/pay — zaksięguj wypłatę odkupu (superadmin)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();

  const { data: agreement, error: fetchErr } = await supabase
    .from('buyback_agreements').select('user_id, status, voucher_count').eq('id', params.id).single();

  if (fetchErr || !agreement)
    return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
  if (agreement.status !== 'approved')
    return NextResponse.json({ error: 'Umowa musi być najpierw zatwierdzona' }, { status: 409 });

  const { error } = await supabase
    .from('buyback_agreements')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Powiadom pracownika o wypłacie
  await supabase.from('notifications').insert({
    user_id: agreement.user_id,
    message: `Wypłata za odkup ${agreement.voucher_count} voucherów została zaksięgowana.`,
    type:    'SUCCESS',
  });

  return NextResponse.json({ paid: true });
}
