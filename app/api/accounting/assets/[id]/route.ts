// PATCH/DELETE /api/accounting/assets/[id] — edycja/status (sprzedany, zlikwidowany)/usunięcie
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess } from '@/lib/accounting/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadWithAccess(id: string, auth: any) {
  const { data } = await (admin() as any).from('acc_fixed_assets').select('*').eq('id', id).single();
  if (!data) return null;
  return (await companyAccess(auth, data.company_id, true)) ? data : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const a = await loadWithAccess(id, auth);
  if (!a) return NextResponse.json({ error: 'Brak środka lub uprawnień' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const patch: any = {};
  for (const f of ['name', 'notes', 'purchase_date'] as const) if (f in b) patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  if ('initial_value' in b && Number(b.initial_value) > 0) patch.initial_value = Number(b.initial_value);
  if ('amortization_rate' in b && Number(b.amortization_rate) > 0) patch.amortization_rate = Number(b.amortization_rate);
  if ('status' in b && ['active', 'sold', 'liquidated', 'fully_amortized'].includes(b.status)) patch.status = b.status;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Brak zmian' }, { status: 400 });
  const { data, error } = await (admin() as any).from('acc_fixed_assets').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const a = await loadWithAccess(id, auth);
  if (!a) return NextResponse.json({ error: 'Brak środka lub uprawnień' }, { status: 403 });
  const { error } = await (admin() as any).from('acc_fixed_assets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
