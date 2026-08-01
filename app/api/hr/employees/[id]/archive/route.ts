// POST /api/hr/employees/[id]/archive — { action: 'archive' | 'restore' }
// archive: „Usuń z kontraktu" — pracownik trafia do Archiwum z całą historią
//          (dokumenty, rozliczenia, grafik zostają); kontrakt zapamiętany do przywrócenia.
// restore: wraca z Archiwum — do dawnego kontraktu, jeśli nadal istnieje.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { coordinatorContractScope } from '@/lib/hr/coordinatorScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const action = b.action === 'restore' ? 'restore' : 'archive';

  const sb = admin() as any;
  const { data: emp, error: empErr } = await sb.from('hr_employees')
    .select('*, contract:hr_contracts(id, name)').eq('id', id).single();
  if (empErr || !emp) return NextResponse.json({ error: 'Nie ma takiego pracownika' }, { status: 404 });

  if (action === 'archive') {
    // koordynator archiwizuje (zwalnia) tylko SWOICH pracowników / swoich kandydatów
    if (auth.role === 'koordynator' && !(emp.coordinator_id === auth.id || (emp.candidate && emp.submitted_by === auth.id))) {
      return NextResponse.json({ error: 'Możesz zwolnić tylko pracownika przypisanego do Ciebie' }, { status: 403 });
    }
    // ZWOLNIENIE pracownika (nie-kandydata) wymaga podania przyczyny (co się stało)
    const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
    if (!emp.candidate && !reason) {
      return NextResponse.json({ error: 'Podaj przyczynę zwolnienia / przeniesienia do Archiwum' }, { status: 400 });
    }
    // czarna lista: flaga wymaga podania powodu (walidacja)
    const blacklisted = b.blacklisted === true;
    const blacklistReason = (typeof b.blacklist_reason === 'string' ? b.blacklist_reason.trim() : '') || reason;
    if (blacklisted && !blacklistReason) {
      return NextResponse.json({ error: 'Oflagowanie na czarną listę wymaga podania powodu' }, { status: 400 });
    }
    const { data, error } = await sb.from('hr_employees').update({
      archived: true,
      archived_at: new Date().toISOString(),
      archived_from_contract_id: emp.contract_id,
      archived_from: emp.candidate ? 'Poczekalnia (odrzucony kandydat)' : ((emp.contract as any)?.name ?? null),
      archive_reason: reason || null,
      contract_id: null,
      // zwolnienie = zwolnienie miejsca noclegowego (licznik zajętości i udział w czynszu
      // liczą się po accommodation_id — archiwalny nie może blokować łóżka)
      accommodation_id: null,
      blacklisted,
      blacklist_reason: blacklisted ? blacklistReason : null,
      work_status: 'zwolniony',
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // zwolnij też miejsce w busie (Plan dowozu) — best-effort
    await sb.from('hr_transport_assignments').delete().eq('employee_id', id);
    return NextResponse.json(data);
  }

  // restore — WŁASNOŚĆ pracownika sprawdzana ZAWSZE (niezależnie od tego, czy podano
  // contract_id) — dokładnie ta sama granica co przy archiwizacji (patrz wyżej): koordynator
  // przywraca tylko SWOICH pracowników / swoich kandydatów. Bez tego sprawdzenia podanie
  // contract_id wskazującego na WŁASNY kontrakt koordynatora pozwoliłoby mu przejąć
  // (i zobaczyć w GET /api/hr/employees) dowolnego cudzego zarchiwizowanego pracownika —
  // razem z danymi osobowymi (paszport, dokumenty, rozliczenia).
  if (auth.role === 'koordynator' && !(emp.coordinator_id === auth.id || (emp.candidate && emp.submitted_by === auth.id))) {
    return NextResponse.json({ error: 'Możesz przywrócić tylko pracownika przypisanego do Ciebie' }, { status: 403 });
  }

  // domyślnie wraca do dawnego kontraktu (jeśli nadal istnieje); {contract_id} w body
  // pozwala wybrać INNY kontrakt zamiast tego
  const requestedContractId = typeof b.contract_id === 'string' && b.contract_id.trim() ? b.contract_id.trim() : null;
  let contractId: string | null = null;
  if (requestedContractId) {
    // koordynator może przywrócić tylko do kontraktu w SWOIM zakresie — TA SAMA definicja
    // zakresu (coordinatorContractScope: swoi pracownicy ∪ jawnie przyznane w Ustawieniach)
    // co dropdown w HrArchiwum (GET /api/hr/contracts), żeby lista widoczna użytkownikowi
    // i strażnik uprawnień nigdy się nie rozjechały
    if (auth.role === 'koordynator') {
      const scope = await coordinatorContractScope(auth.id);
      if (!scope.includes(requestedContractId)) {
        return NextResponse.json({ error: 'Możesz przywrócić tylko do kontraktu w Twoim zakresie' }, { status: 403 });
      }
    }
    const { data: c } = await sb.from('hr_contracts').select('id').eq('id', requestedContractId).maybeSingle();
    contractId = c?.id ?? null;
  } else if (emp.archived_from_contract_id) {
    const { data: c } = await sb.from('hr_contracts').select('id').eq('id', emp.archived_from_contract_id).maybeSingle();
    contractId = c?.id ?? null;
  }
  const { data, error } = await sb.from('hr_employees').update({
    archived: false,
    archived_at: null,
    archived_from_contract_id: null,
    archived_from: null,
    archive_reason: null,
    contract_id: contractId,
    // przywrócenie = druga szansa: flaga czarnej listy schodzi (decyzja jest świadoma — UI wymaga potwierdzenia)
    blacklisted: false,
    blacklist_reason: null,
    work_status: 'pracuje',
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, restored_to_contract: !!contractId });
}
