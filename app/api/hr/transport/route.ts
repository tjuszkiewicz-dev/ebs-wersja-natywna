// Plan dowozu — przypisanie pracowników do pojazdów (busów) Floty.
// GET  — pojazdy z miejscami + przypisani pracownicy (z noclegiem do listy odbioru) + nieprzypisani.
// POST — przypisz { vehicle_id, employee_id } (pracownik jeździ jednym busem → przenosi).
// DELETE ?employee_id= — usuń z busa.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { fullName } from '@/lib/hr/docPlaceholders';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMP_SEL = 'id, first_name, second_name, last_name, second_last_name, accommodation:hr_accommodations(name, address), contract:hr_contracts(name)';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await can(auth, 'agencja.dowoz'))) return NextResponse.json({ error: 'Brak dostępu do Planu dowozu' }, { status: 403 });
  const sb = admin() as any;

  const [{ data: vehicles }, { data: assigns }, { data: emps }] = await Promise.all([
    sb.from('hr_vehicles').select('id, make, model, registration, seats, driver_name, main_user_name, contract:hr_contracts(name)').neq('status', 'wycofany').order('make'),
    sb.from('hr_transport_assignments').select(`vehicle_id, employee:hr_employees(${EMP_SEL})`),
    sb.from('hr_employees').select(EMP_SEL).eq('archived', false).eq('candidate', false).order('last_name'),
  ]);

  const byVehicle = new Map<string, any[]>();
  const assignedIds = new Set<string>();
  for (const a of assigns || []) {
    const emp = (a as any).employee;
    if (!emp) continue;
    assignedIds.add(emp.id);
    const row = { id: emp.id, name: fullName(emp), accommodation: emp.accommodation?.name || null, accommodation_address: emp.accommodation?.address || null, contract: emp.contract?.name || null };
    if (!byVehicle.has((a as any).vehicle_id)) byVehicle.set((a as any).vehicle_id, []);
    byVehicle.get((a as any).vehicle_id)!.push(row);
  }

  const pojazdy = (vehicles || []).map((v: any) => {
    const label = [v.make, v.model].filter(Boolean).join(' ') + (v.registration ? ` (${v.registration})` : '');
    const assigned = byVehicle.get(v.id) || [];
    return {
      id: v.id, label, seats: v.seats || 0, kierowca: v.main_user_name || v.driver_name || null,
      projekt: v.contract?.name || null, assigned, wolne: Math.max(0, (v.seats || 0) - assigned.length),
    };
  });

  const nieprzypisani = (emps || []).filter((e: any) => !assignedIds.has(e.id))
    .map((e: any) => ({ id: e.id, name: fullName(e), accommodation: e.accommodation?.name || null, contract: e.contract?.name || null }));

  return NextResponse.json({ pojazdy, nieprzypisani });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await can(auth, 'agencja.dowoz'))) return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!isUuid(b.vehicle_id) || !isUuid(b.employee_id)) return NextResponse.json({ error: 'Wymagane vehicle_id i employee_id' }, { status: 400 });
  const sb = admin() as any;

  // limit miejsc
  const [{ data: veh }, { count }] = await Promise.all([
    sb.from('hr_vehicles').select('seats').eq('id', b.vehicle_id).single(),
    sb.from('hr_transport_assignments').select('employee_id', { count: 'exact', head: true }).eq('vehicle_id', b.vehicle_id),
  ]);
  const seats = veh?.seats || 0;
  // czy pracownik już był w tym busie? (przeniesienie z innego nie zwiększa liczby)
  const { data: existing } = await sb.from('hr_transport_assignments').select('vehicle_id').eq('employee_id', b.employee_id).maybeSingle();
  const alreadyHere = existing?.vehicle_id === b.vehicle_id;
  if (!alreadyHere && seats > 0 && (count || 0) >= seats) return NextResponse.json({ error: `Brak wolnych miejsc — pojazd ma ${seats} miejsc.` }, { status: 400 });

  // upsert: pracownik jeździ jednym busem (unikat po employee_id → przenosi)
  const { error } = await sb.from('hr_transport_assignments')
    .upsert({ employee_id: b.employee_id, vehicle_id: b.vehicle_id, created_by: isUuid(auth.id) ? auth.id : null }, { onConflict: 'employee_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await can(auth, 'agencja.dowoz'))) return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
  const employeeId = new URL(request.url).searchParams.get('employee_id');
  if (!isUuid(employeeId)) return NextResponse.json({ error: 'Wymagane employee_id' }, { status: 400 });
  const { error } = await (admin() as any).from('hr_transport_assignments').delete().eq('employee_id', employeeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
