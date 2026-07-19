// GET  /api/hr/vehicles/[id]/costs — historia kosztów pojazdu
// POST — nowy koszt (paliwo/serwis/ubezpieczenie/opłaty/inne) → AUTO-WPIS w bilansie
//        Księgowości (reguła: każda kwota dopięta do bilansu); aktualizuje też przebieg.
// DELETE ?cost_id= — usunięcie kosztu WRAZ z wpisem w bilansie (spójność).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { hrLinkedCompanyId } from '@/lib/accounting/access';
import { COST_KINDS } from '@/lib/hr/vehicles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { data, error } = await (admin() as any).from('hr_vehicle_costs').select('*').eq('vehicle_id', id).order('cost_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ costs: data ?? [], can_delete: await can(auth, 'agencja.delete') });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.flota'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data: v } = await sb.from('hr_vehicles').select('make, registration, mileage').eq('id', id).single();
  if (!v) return NextResponse.json({ error: 'Brak pojazdu' }, { status: 404 });

  const b = await request.json().catch(() => ({}));
  const amount = Number(b.amount);
  const kind = COST_KINDS[String(b.kind)] ? String(b.kind) : 'inne';
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Kwota musi być dodatnia' }, { status: 400 });
  const costDate = /^\d{4}-\d{2}-\d{2}$/.test(String(b.cost_date || '')) ? b.cost_date : new Date().toISOString().slice(0, 10);
  const mileage = b.mileage === '' || b.mileage == null ? null : Number(b.mileage);
  const note = String(b.note || '').trim().slice(0, 300) || null;
  const label = `${v.make} ${v.registration ?? ''}`.trim();
  // konto wewnętrzne (testy) nie ma UUID — kolumny uuid dostają wtedy null
  const uid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(auth.id)) ? auth.id : null;

  // KSIĘGOWANIE (reguła zliczania): koszt pojazdu = koszt firmy w bilansie
  const accCompanyId = await hrLinkedCompanyId();
  let accEntryId: string | null = null;
  if (accCompanyId) {
    try {
      const { data: entry } = await sb.from('acc_entries').insert({
        company_id: accCompanyId, entry_date: costDate,
        kind: 'cost', category: COST_KINDS[kind].accCategory,
        description: `${COST_KINDS[kind].label} — ${label}${note ? ` (${note})` : ''}`,
        amount, source: 'flota', status: 'zaksiegowana', created_by: uid,
      }).select('id').single();
      accEntryId = entry?.id ?? null;
    } catch (e) { console.error('[vehicle-costs] księgowanie:', e); }
  }

  const { data: row, error } = await sb.from('hr_vehicle_costs')
    .insert({ vehicle_id: id, cost_date: costDate, kind, amount, mileage, note, acc_entry_id: accEntryId, created_by: uid })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // przebieg przy koszcie wyższy niż aktualny → aktualizacja pojazdu
  if (mileage != null && Number.isFinite(mileage) && (v.mileage == null || mileage > Number(v.mileage))) {
    await sb.from('hr_vehicles').update({ mileage, updated_at: new Date().toISOString() }).eq('id', id);
  }

  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.delete'))) return NextResponse.json({ error: 'Usuwać koszty może administrator' }, { status: 403 });
  const { id } = await params;
  const costId = new URL(request.url).searchParams.get('cost_id');
  if (!costId) return NextResponse.json({ error: 'Brak kosztu' }, { status: 400 });
  const sb = admin() as any;
  const { data: cost } = await sb.from('hr_vehicle_costs').select('*').eq('id', costId).eq('vehicle_id', id).single();
  if (!cost) return NextResponse.json({ error: 'Brak kosztu' }, { status: 404 });
  const accCompanyId = await hrLinkedCompanyId();
  if (accCompanyId && cost.acc_entry_id) await sb.from('acc_entries').delete().eq('id', cost.acc_entry_id); // spójność z bilansem
  const { error } = await sb.from('hr_vehicle_costs').delete().eq('id', costId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
