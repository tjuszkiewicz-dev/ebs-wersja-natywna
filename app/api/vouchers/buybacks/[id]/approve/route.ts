// PATCH /api/vouchers/buybacks/[id]/approve — zatwierdź umowę odkupu (superadmin)
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
    .from('buyback_agreements').select('*').eq('id', params.id).single();

  if (fetchErr || !agreement)
    return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
  if (agreement.status !== 'pending_approval')
    return NextResponse.json({ error: 'Już przetworzone' }, { status: 409 });

  // Zatwierdź umowę — vouchery oznacz jako buyback_complete
  const snap = agreement.snapshot as { vouchers?: string[] } | null;
  const voucherIds: string[] = snap?.vouchers ?? [];
  if (voucherIds.length > 0) {
    await supabase.from('vouchers').update({ status: 'buyback_complete' }).in('id', voucherIds);
  }

  const { error } = await supabase
    .from('buyback_agreements')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ approved: true });
}
