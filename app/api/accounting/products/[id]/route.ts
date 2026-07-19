// PATCH/DELETE /api/accounting/products/[id] — edycja produktu / ruch magazynowy / usunięcie
// PATCH body: pola produktu ALBO { stock_delta: +N/-N, reason? } (przyjęcie/wydanie)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess } from '@/lib/accounting/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadWithAccess(id: string, auth: any) {
  const { data } = await (admin() as any).from('acc_products').select('*').eq('id', id).single();
  if (!data) return null;
  return (await companyAccess(auth, data.company_id, true)) ? data : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const p = await loadWithAccess(id, auth);
  if (!p) return NextResponse.json({ error: 'Brak produktu lub uprawnień' }, { status: 403 });
  const b = await request.json().catch(() => ({}));

  // ruch magazynowy: przyjęcie (+) / wydanie (−)
  if ('stock_delta' in b) {
    const delta = Number(b.stock_delta);
    if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: 'Nieprawidłowa ilość' }, { status: 400 });
    const next = Math.round((Number(p.stock_qty) + delta) * 1000) / 1000;
    if (next < 0) return NextResponse.json({ error: `Stan nie może zejść poniżej zera (obecnie ${p.stock_qty})` }, { status: 400 });
    const { error } = await (admin() as any).from('acc_products').update({ stock_qty: next }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, stock_qty: next });
  }

  const patch: any = {};
  for (const f of ['name', 'sku', 'unit', 'notes'] as const) if (f in b) patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  for (const f of ['purchase_price', 'sale_price', 'vat_rate', 'min_qty', 'stock_qty'] as const) if (f in b) patch[f] = b[f] === null || b[f] === '' ? null : Number(b[f]);
  if (patch.name !== undefined && !patch.name) return NextResponse.json({ error: 'Nazwa wymagana' }, { status: 400 });
  const { data, error } = await (admin() as any).from('acc_products').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const p = await loadWithAccess(id, auth);
  if (!p) return NextResponse.json({ error: 'Brak produktu lub uprawnień' }, { status: 403 });
  const { error } = await (admin() as any).from('acc_products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
