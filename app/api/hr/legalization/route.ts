// Pipeline legalizacji pobytu — wnioski urzędowe + statusy + terminy.
// GET (?employee_id) lista; POST nowy wniosek; PATCH ?id aktualizacja; DELETE ?id.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { fullName } from '@/lib/hr/docPlaceholders';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEGAL_TYPES = ['karta_pobytu', 'wiza', 'pozwolenie_na_prace', 'oswiadczenie', 'przedluzenie', 'inne'];
const LEGAL_STATUSES = ['zbieranie_dokumentow', 'zlozony', 'w_toku', 'uzupelnienie', 'decyzja_pozytywna', 'decyzja_negatywna'];
const FIELDS = ['type', 'status', 'office', 'case_number', 'submitted_at', 'decision_date', 'deadline', 'note', 'employee_id'];
const EMP = 'employee:hr_employees(first_name, second_name, last_name, second_last_name, contract:hr_contracts(name))';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.legalizacja'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const employeeId = new URL(request.url).searchParams.get('employee_id');
  let q = (admin() as any).from('hr_legalization').select(`*, ${EMP}`).order('deadline', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  if (isUuid(employeeId)) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = (data || []).map((r: any) => ({ ...r, employee_name: r.employee ? fullName(r.employee) : '—', contract: r.employee?.contract?.name || null }));
  return NextResponse.json({ items, can_delete: await can(auth, 'agencja.delete') });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.legalizacja'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!isUuid(b.employee_id)) return NextResponse.json({ error: 'Wybierz pracownika' }, { status: 400 });
  const type = LEGAL_TYPES.includes(b.type) ? b.type : 'karta_pobytu';
  const status = LEGAL_STATUSES.includes(b.status) ? b.status : 'zbieranie_dokumentow';
  const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
  const uid = isUuid(auth.id) ? auth.id : null;
  const { data, error } = await (admin() as any).from('hr_legalization').insert({
    employee_id: b.employee_id, type, status,
    office: String(b.office || '').trim() || null, case_number: String(b.case_number || '').trim() || null,
    submitted_at: date(b.submitted_at), deadline: date(b.deadline), decision_date: date(b.decision_date),
    note: String(b.note || '').trim() || null, created_by: uid,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.legalizacja'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Brak id' }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const patch: any = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) {
    if (!(f in b)) continue;
    if (f === 'type') { if (LEGAL_TYPES.includes(b[f])) patch[f] = b[f]; continue; }
    if (f === 'status') { if (LEGAL_STATUSES.includes(b[f])) patch[f] = b[f]; continue; }
    if (['submitted_at', 'decision_date', 'deadline'].includes(f)) { patch[f] = /^\d{4}-\d{2}-\d{2}$/.test(String(b[f] || '')) ? b[f] : null; continue; }
    if (f === 'employee_id') continue;
    patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  }
  const { data, error } = await (admin() as any).from('hr_legalization').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.delete'))) return NextResponse.json({ error: 'Usuwać wnioski może administrator' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Brak id' }, { status: 400 });
  const { error } = await (admin() as any).from('hr_legalization').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
