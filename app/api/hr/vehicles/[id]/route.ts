// PATCH/DELETE /api/hr/vehicles/[id] — edycja i usunięcie pojazdu
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { buildVehicleRow } from '@/lib/hr/vehicles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.flota'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const patch = buildVehicleRow(b, { updated_at: new Date().toISOString() });
  const { data, error } = await (admin() as any).from('hr_vehicles').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.delete'))) return NextResponse.json({ error: 'Usuwać pojazdy może administrator' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { error } = await sb.from('hr_vehicles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // wpisy kosztów w bilansie ZOSTAJĄ — to poniesione wydatki (historia hr_vehicle_costs schodzi kaskadą)
  return NextResponse.json({ ok: true });
}
