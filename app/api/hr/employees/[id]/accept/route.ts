// POST /api/hr/employees/[id]/accept — akceptacja kandydata z Poczekalni:
// przypisuje do kontraktu (+grupa, +koordynator — domyślnie zgłaszający),
// kandydat znika z Poczekalni i pojawia się w Kontraktach.
// Tylko wyższe role: superadmin / dyrektor / szef koordynatorów.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCEPT_ROLES = ['superadmin', 'dyrektor', 'szef_koordynatorow'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  const isManager = ACCEPT_ROLES.includes(auth?.role ?? '');
  // koordynator może przydzielić do kontraktu WŁASNEGO kandydata (sprawdzane niżej)
  if (!auth || (!isManager && auth.role !== 'koordynator')) {
    return NextResponse.json({ error: 'Brak uprawnień do przydzielania kandydatów' }, { status: 403 });
  }
  const { id } = await params;
  const b = await request.json().catch(() => null);
  if (!b?.contract_id) return NextResponse.json({ error: 'Wybierz kontrakt, do którego trafia pracownik' }, { status: 400 });

  const sb = admin() as any;
  const { data: emp, error: ee } = await sb.from('hr_employees').select('id, candidate, submitted_by, coordinator_id').eq('id', id).single();
  if (ee || !emp) return NextResponse.json({ error: 'Nie znaleziono kandydata' }, { status: 404 });
  if (!emp.candidate) return NextResponse.json({ error: 'Ta osoba nie jest już w Poczekalni' }, { status: 400 });
  if (!isManager && emp.submitted_by !== auth.id) {
    return NextResponse.json({ error: 'Możesz przydzielić tylko swojego kandydata' }, { status: 403 });
  }

  const { data, error } = await sb.from('hr_employees').update({
    candidate: false,
    contract_id: b.contract_id,
    team: b.team?.trim() || null,
    // koordynator nie wybiera koordynatora — zostaje on sam (lub dotychczasowy)
    coordinator_id: isManager
      ? (b.coordinator_id || emp.coordinator_id || emp.submitted_by || null)
      : (emp.coordinator_id || auth.id),
    status: 'active',
  }).eq('id', id).select('*, contract:hr_contracts(id, name)').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
