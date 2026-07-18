// GET/PATCH/DELETE /api/hr/accommodations/[id]
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { buildAccRow, composeAccAddress, computeAccRent, withAccGeo } from '@/lib/hr/accommodations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { data, error } = await (admin() as any).from('hr_accommodations').select('*, residents:hr_employees(id, first_name, last_name)').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const { data: cur } = await (admin() as any).from('hr_accommodations').select('address, price_per_person, rented_spots').eq('id', id).single();
  let patch: any = buildAccRow(b, { updated_at: new Date().toISOString() });
  patch = composeAccAddress(patch);
  // czynsz liczony z DOCELOWYCH wartości (patch nadpisuje obecne)
  patch = computeAccRent({ price_per_person: patch.price_per_person ?? cur?.price_per_person, rented_spots: patch.rented_spots ?? cur?.rented_spots, ...patch });
  patch = await withAccGeo(patch, cur?.address ?? null);
  const { data, error } = await (admin() as any).from('hr_accommodations').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.delete'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  // odpięcie pracowników nastąpi automatycznie (on delete set null)
  const { error } = await (admin() as any).from('hr_accommodations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
