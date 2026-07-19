// PATCH/DELETE /api/accounting/entries/[id] — edycja/usunięcie wpisu (superadmin+dyrektor)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = ['entry_date', 'kind', 'category', 'description', 'contractor', 'invoice_number', 'amount', 'status'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'ksiegowosc.bilans'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const patch: any = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) {
    if (!(f in b)) continue;
    if (f === 'amount') {
      const a = Number(b.amount);
      if (!Number.isFinite(a) || a <= 0) return NextResponse.json({ error: 'Kwota musi być dodatnia' }, { status: 400 });
      patch.amount = a;
    } else patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  }
  const { data, error } = await (admin() as any).from('acc_entries').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'ksiegowosc.bilans'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data: entry } = await sb.from('acc_entries').select('file_path, amount, kind, contractor').eq('id', id).single();
  if (entry?.file_path) await sb.storage.from('invoices').remove([entry.file_path]);
  const { error } = await sb.from('acc_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
