// DELETE /api/hr/employees/[id]/documents/[docId] — usuń dokument (Storage + rekord)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { coordinatorGrantedContractIds } from '@/lib/hr/coordinatorScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // koordynator może tylko DODAWAĆ dokumenty — usuwanie zablokowane, chyba że ma nadany wyjątek agencja.dokumenty-usun
  if (auth.role === 'koordynator' && !(await can(auth, 'agencja.dokumenty-usun'))) {
    return NextResponse.json({ error: 'Brak uprawnień do usuwania dokumentów' }, { status: 403 });
  }
  const { id, docId } = await params;
  const sb = admin() as any;
  // koordynator z wyjątkiem agencja.dokumenty-usun: strażnik zakresu jak w PATCH /api/hr/employees/[id]
  // — może usuwać dokumenty TYLKO pracownikom przypisanym mu bezpośrednio, zgłoszonym przez niego
  // (kandydat) lub z kontraktu przyznanego mu w Ustawieniach; inaczej mógłby kasować skany
  // dowolnego pracownika w firmie
  if (auth.role === 'koordynator') {
    const { data: emp } = await sb.from('hr_employees').select('coordinator_id, submitted_by, candidate, contract_id').eq('id', id).single();
    let allowed = !!emp && (emp.coordinator_id === auth.id || (emp.candidate && emp.submitted_by === auth.id));
    if (!allowed && emp?.contract_id) {
      const granted = await coordinatorGrantedContractIds(auth.id);
      allowed = granted.includes(emp.contract_id);
    }
    if (!allowed) return NextResponse.json({ error: 'To nie jest pracownik przypisany do Ciebie ani do Twojego kontraktu' }, { status: 403 });
  }
  // dokument musi faktycznie należeć do pracownika [id] — inaczej można by podać cudzy docId
  // przy własnym (dozwolonym) pracowniku i skasować dowolny dokument w systemie
  const { data: doc } = await sb.from('hr_documents').select('path, filename, employee_id').eq('id', docId).single();
  if (!doc || doc.employee_id !== id) return NextResponse.json({ error: 'Dokument nie należy do tego pracownika' }, { status: 404 });
  if (doc.path) await sb.storage.from('hr-documents').remove([doc.path]);
  const { error } = await sb.from('hr_documents').delete().eq('id', docId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
