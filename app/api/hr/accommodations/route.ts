// GET /api/hr/accommodations — lista baz noclegowych (z liczbą przypisanych,
// projektem/kontraktem i szacowaną odległością + czasem dojazdu do magazynu)
// POST — nowa baza noclegowa (czynsz liczony z ceny za osobę × wynajęte miejsca)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { geocodeAddress, driveEstimate } from '@/lib/hr/geo';
import { buildAccRow, composeAccAddress, computeAccRent, withAccGeo } from '@/lib/hr/accommodations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin();
  const { data, error } = await (sb as any)
    .from('hr_accommodations')
    .select('*, contract:hr_contracts(id, name, address, lat, lng), hr_employees(count)')
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // dogeokoduj brakujące magazyny projektów (max 2 na request — Nominatim rate limit)
  let geoBudget = 2;
  for (const a of data || []) {
    const c: any = a.contract;
    if (c && c.address && c.lat == null && geoBudget > 0) {
      geoBudget--;
      const pt = await geocodeAddress(c.address);
      if (pt) { c.lat = pt.lat; c.lng = pt.lng; await (sb as any).from('hr_contracts').update({ lat: pt.lat, lng: pt.lng, geocoded_at: new Date().toISOString() }).eq('id', c.id); }
    }
    if (a.address && a.lat == null && geoBudget > 0) {
      geoBudget--;
      const pt = await geocodeAddress(a.address);
      if (pt) { a.lat = pt.lat; a.lng = pt.lng; await (sb as any).from('hr_accommodations').update({ lat: pt.lat, lng: pt.lng, geocoded_at: new Date().toISOString() }).eq('id', a.id); }
    }
  }

  // liczniki statusow pracy per lokal — jedno zapytanie, grupowanie w pamieci
  const { data: statusRows } = await (sb as any).from('hr_employees').select('accommodation_id, work_status').eq('archived', false);
  const statusCounts = new Map<string, Record<string, number>>();
  for (const r of statusRows ?? []) {
    if (!r.accommodation_id) continue;
    const bucket = statusCounts.get(r.accommodation_id) ?? {};
    const key = r.work_status || 'pracuje';
    bucket[key] = (bucket[key] ?? 0) + 1;
    statusCounts.set(r.accommodation_id, bucket);
  }

  const accommodations = (data || []).map((a: any) => {
    const c: any = a.contract;
    const dist = (a.lat != null && a.lng != null && c?.lat != null && c?.lng != null)
      ? driveEstimate({ lat: a.lat, lng: a.lng }, { lat: c.lat, lng: c.lng })
      : null;
    return { ...a, assigned_count: a.hr_employees?.[0]?.count ?? 0, hr_employees: undefined, distance_km: dist?.distance_km ?? null, drive_min: dist?.drive_min ?? null, status_counts: statusCounts.get(a.id) ?? {} };
  });
  return NextResponse.json({ accommodations });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!b?.name?.trim()) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 });
  let row: any = buildAccRow(b, { created_by: auth.id });
  row = composeAccAddress(row);
  row = computeAccRent(row);
  row = await withAccGeo(row, null);
  const { data, error } = await (admin() as any).from('hr_accommodations').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
