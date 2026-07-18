// GET /api/hr/vehicles — flota agencji (pojazdy + suma kosztów + projekt)
// POST — nowy pojazd
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { buildVehicleRow } from '@/lib/hr/vehicles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin();
  const [{ data: vehicles, error }, { data: costs }] = await Promise.all([
    (sb as any).from('hr_vehicles').select('*, contract:hr_contracts(id, name)').order('created_at', { ascending: true }),
    (sb as any).from('hr_vehicle_costs').select('vehicle_id, amount'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sums = new Map<string, number>();
  for (const c of costs || []) sums.set(c.vehicle_id, (sums.get(c.vehicle_id) || 0) + Number(c.amount || 0));
  return NextResponse.json((vehicles || []).map((v: any) => ({ ...v, costs_total: Math.round((sums.get(v.id) || 0) * 100) / 100 })));
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!String(b.make || '').trim()) return NextResponse.json({ error: 'Marka jest wymagana' }, { status: 400 });
  const row = buildVehicleRow(b, {});
  const { data, error } = await (admin() as any).from('hr_vehicles').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
