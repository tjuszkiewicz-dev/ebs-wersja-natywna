// Zarządzanie widocznością kontraktów przez koordynatorów (Ustawienia).
// GET — koordynatorzy + kontrakty + aktualne przyznania. PUT — ustaw przyznania koordynatora.
// szef_koordynatorow i administracja widzą wszystko niezależnie (nie ma potrzeby ich konfigurować).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// EBS nie ma rozróżnienia superadmin/owner z BBS (auth.isOwner) — najwyższa rola to 'superadmin'.
export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko Super Admin (Właściciel) zarządza widocznością kontraktów' }, { status: 403 });
  const sb = admin() as any;
  const [coords, contracts, grants] = await Promise.all([
    sb.from('user_profiles').select('id, full_name').eq('role', 'koordynator').order('full_name'),
    sb.from('hr_contracts').select('id, name, employer').eq('status', 'active').order('name'),
    sb.from('hr_coordinator_contracts').select('coordinator_id, contract_id'),
  ]);
  const map: Record<string, string[]> = {};
  for (const g of grants.data || []) { (map[(g as any).coordinator_id] ||= []).push((g as any).contract_id); }
  return NextResponse.json({
    coordinators: (coords.data || []).map((c: any) => ({ id: c.id, name: c.full_name || c.id })),
    contracts: (contracts.data || []).map((c: any) => ({ id: c.id, name: c.name, employer: c.employer })),
    grants: map,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko Super Admin (Właściciel) zarządza widocznością kontraktów' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!isUuid(b.coordinator_id)) return NextResponse.json({ error: 'Wskaż koordynatora' }, { status: 400 });
  const contractIds: string[] = [...new Set((Array.isArray(b.contract_ids) ? b.contract_ids : []).filter(isUuid) as string[])];
  const sb = admin() as any;
  const uid = isUuid(auth.id) ? auth.id : null;

  const del = await sb.from('hr_coordinator_contracts').delete().eq('coordinator_id', b.coordinator_id);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  if (contractIds.length) {
    const ins = await sb.from('hr_coordinator_contracts').insert(contractIds.map(cid => ({ coordinator_id: b.coordinator_id, contract_id: cid, created_by: uid })));
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, contract_ids: contractIds });
}
