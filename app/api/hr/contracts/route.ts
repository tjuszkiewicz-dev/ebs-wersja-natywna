// GET /api/hr/contracts — lista kontraktów (+ liczba pracowników) · POST — nowy
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { geocodeAddress } from '@/lib/hr/geo';
import { coordinatorContractScope } from '@/lib/hr/coordinatorScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin() as any;

  // tryb "same nazwy" (selecty, np. przydział kandydata) — bez danych kontraktu i bez filtra
  if (new URL(request.url).searchParams.get('names') === '1') {
    const { data, error } = await sb.from('hr_contracts').select('id, name').eq('status', 'active').order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contracts: data ?? [], can_manage: auth.role !== 'koordynator' });
  }
  const { data, error } = await sb.from('hr_contracts').select('*, hr_employees(count)').order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let contracts = (data || []).map((c: any) => ({ ...c, employee_count: c.hr_employees?.[0]?.count ?? 0, hr_employees: undefined }));

  // liczniki statusow pracy per kontrakt — jedno zapytanie, grupowanie w pamieci
  const { data: statusRows } = await sb.from('hr_employees').select('contract_id, work_status').eq('archived', false);
  const statusCounts = new Map<string, Record<string, number>>();
  for (const r of statusRows ?? []) {
    if (!r.contract_id) continue;
    const bucket = statusCounts.get(r.contract_id) ?? {};
    const key = r.work_status || 'pracuje';
    bucket[key] = (bucket[key] ?? 0) + 1;
    statusCounts.set(r.contract_id, bucket);
  }
  contracts = contracts.map((c: any) => ({ ...c, status_counts: statusCounts.get(c.id) ?? {} }));

  // koordynator: tylko przegląd; kontrakty, na których ma pracowników LUB jawnie przyznane w Ustawieniach
  // (definicja WSPÓLNA z guardem przy przywracaniu z Archiwum — coordinatorContractScope)
  if (auth.role === 'koordynator') {
    const allowed = new Set(await coordinatorContractScope(auth.id));
    contracts = contracts.filter((c: any) => allowed.has(c.id));
  }
  return NextResponse.json({ contracts, can_manage: auth.role !== 'koordynator' });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (auth.role === 'koordynator') return NextResponse.json({ error: 'Koordynator nie może dodawać kontraktów' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.name?.trim()) return NextResponse.json({ error: 'Nazwa kontraktu jest wymagana' }, { status: 400 });
  // geokodowanie magazynu (dla odległości/dojazdu z noclegów) — best-effort
  const addr = b.address?.trim() || null;
  const pt = addr ? await geocodeAddress(addr) : null;
  const { data, error } = await (admin() as any).from('hr_contracts').insert({
    name: b.name.trim(),
    employer: b.employer?.trim() || null,
    address: addr,
    lat: pt?.lat ?? null,
    lng: pt?.lng ?? null,
    geocoded_at: pt ? new Date().toISOString() : null,
    contact_person: b.contact_person?.trim() || null,
    phone: b.phone?.trim() || null,
    status: b.status || 'active',
    notes: b.notes?.trim() || null,
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
