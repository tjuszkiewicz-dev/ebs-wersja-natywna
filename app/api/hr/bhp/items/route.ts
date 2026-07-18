// Magazyn BHP — katalog pozycji (odzież, obuwie, sprzęt).
// GET lista, POST nowa pozycja, DELETE ?id.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.bhp'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = await (admin() as any).from('hr_bhp_items').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.bhp'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Podaj nazwę pozycji' }, { status: 400 });
  const uid = isUuid(auth.id) ? auth.id : null;
  const { data, error } = await (admin() as any).from('hr_bhp_items').insert({
    name, category: String(b.category || '').trim() || null,
    unit_cost: Number(b.unit_cost) || 0,
    stock: b.stock === '' || b.stock == null ? null : Number(b.stock),
    sizes: String(b.sizes || '').trim() || null,
    notes: String(b.notes || '').trim() || null,
    created_by: uid,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.bhp'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Brak id' }, { status: 400 });
  const { error } = await (admin() as any).from('hr_bhp_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
