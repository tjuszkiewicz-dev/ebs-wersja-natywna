// GET/PATCH/DELETE /api/hr/employees/[id]
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { coordinatorGrantedContractIds } from '@/lib/hr/coordinatorScope';
import { isWorkStatusId } from '@/lib/hr/workStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];
const FIELDS = ['first_name', 'last_name', 'phone', 'email', 'bank_account', 'country_of_origin', 'notes', 'status', 'work_status', 'contract_id', 'team', 'residence_card_number', 'residence_card_expiry', 'work_permit_number', 'work_permit_expiry', 'visa_expiry', 'zus_registration_date', 'accommodation_id', 'pesel', 'passport_number', 'birth_date', 'birth_place', 'second_name', 'family_name', 'passport_expiry', 'second_last_name', 'language', 'coordinator_id', 'profession', 'shoe_size', 'clothing_size', 'medical_exam_date', 'medical_exam_expiry', 'gender', 'schengen_entry_date'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { data, error } = await (admin() as any).from('hr_employees').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if ('work_status' in b && !isWorkStatusId(b.work_status)) {
    return NextResponse.json({ error: 'Nieznany status pracy' }, { status: 400 });
  }
  const patch: any = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (f in b) patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  // koordynator: edytuje dane (PESEL, imiona, dokumenty...) SWOICH pracowników
  // oraz WSZYSTKICH pracowników na kontraktach przyznanych mu w Ustawieniach
  // (hr_coordinator_contracts — np. Olena → SHEIN-ALCES);
  // nie przenosi między kontraktami ani nie zmienia koordynatora
  if (auth.role === 'koordynator') {
    const { data: emp } = await (admin() as any).from('hr_employees').select('coordinator_id, submitted_by, candidate, contract_id').eq('id', id).single();
    let allowed = !!emp && (emp.coordinator_id === auth.id || (emp.candidate && emp.submitted_by === auth.id));
    if (!allowed && emp?.contract_id) {
      const granted = await coordinatorGrantedContractIds(auth.id);
      allowed = granted.includes(emp.contract_id);
    }
    if (!allowed) return NextResponse.json({ error: 'To nie jest pracownik przypisany do Ciebie ani do Twojego kontraktu' }, { status: 403 });
    delete patch.contract_id;
    delete patch.coordinator_id;
  }
  const { data, error } = await (admin() as any).from('hr_employees').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.delete'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data: emp } = await sb.from('hr_employees').select('first_name, second_name, last_name, second_last_name').eq('id', id).single();
  // usuń pliki ze Storage (folder pracownika)
  const { data: docs } = await sb.from('hr_documents').select('path').eq('employee_id', id);
  if (docs && docs.length) await sb.storage.from('hr-documents').remove(docs.map((d: any) => d.path));
  const { error } = await sb.from('hr_employees').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
