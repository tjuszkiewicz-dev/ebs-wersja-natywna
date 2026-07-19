// Magazyn BHP — wydania sprzętu/odzieży per pracownik.
// GET (?employee_id) lista wydań; POST wydanie → AUTO-KOSZT w bilansie (reguła zliczania);
// PATCH ?id (zwrot: returned_at) ; DELETE ?id (usuwa też wpis w bilansie).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { hrLinkedCompanyId } from '@/lib/accounting/access';
import { fullName } from '@/lib/hr/docPlaceholders';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMP = 'employee:hr_employees(first_name, second_name, last_name, second_last_name)';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.bhp'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const employeeId = new URL(request.url).searchParams.get('employee_id');
  let q = (admin() as any).from('hr_bhp_issues').select(`*, ${EMP}`).order('issued_at', { ascending: false }).order('created_at', { ascending: false }).limit(300);
  if (isUuid(employeeId)) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const issues = (data || []).map((i: any) => ({ ...i, employee_name: i.employee ? fullName(i.employee) : '—', wartosc: Number(i.unit_cost || 0) * Number(i.quantity || 1) }));
  return NextResponse.json({ issues, can_delete: await can(auth, 'agencja.delete') });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.bhp'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!isUuid(b.employee_id)) return NextResponse.json({ error: 'Wybierz pracownika' }, { status: 400 });
  const itemName = String(b.item_name || '').trim();
  if (!itemName) return NextResponse.json({ error: 'Podaj nazwę wydawanej pozycji' }, { status: 400 });
  const sb = admin() as any;
  const quantity = Math.max(1, Number(b.quantity) || 1);
  const unitCost = Number(b.unit_cost) || 0;
  const issuedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(b.issued_at || '')) ? b.issued_at : new Date().toISOString().slice(0, 10);
  const uid = isUuid(auth.id) ? auth.id : null;
  const total = Math.round(unitCost * quantity * 100) / 100;

  const { data: emp } = await sb.from('hr_employees').select('first_name, second_name, last_name, second_last_name').eq('id', b.employee_id).single();
  const who = emp ? fullName(emp) : 'pracownik';

  // KSIĘGOWANIE: wydanie BHP = koszt firmy w bilansie (tylko gdy wartość > 0)
  const accCompanyId = await hrLinkedCompanyId();
  let accEntryId: string | null = null;
  if (accCompanyId && total > 0) {
    try {
      const { data: entry } = await sb.from('acc_entries').insert({
        company_id: accCompanyId, entry_date: issuedAt, kind: 'cost', category: 'bhp',
        description: `BHP/sprzęt — ${itemName}${b.size ? ` (rozm. ${b.size})` : ''} ×${quantity} — ${who}`,
        amount: total, source: 'bhp', status: 'zaksiegowana', created_by: uid,
      }).select('id').single();
      accEntryId = entry?.id ?? null;
    } catch (e) { console.error('[bhp-issue] księgowanie:', e); }
  }

  const { data, error } = await sb.from('hr_bhp_issues').insert({
    employee_id: b.employee_id, item_id: isUuid(b.item_id) ? b.item_id : null, item_name: itemName,
    size: String(b.size || '').trim() || null, quantity, unit_cost: unitCost, issued_at: issuedAt,
    acc_entry_id: accEntryId, note: String(b.note || '').trim() || null, created_by: uid,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // zejście ze stanu magazynowego (gdy prowadzony)
  if (isUuid(b.item_id)) {
    const { data: it } = await sb.from('hr_bhp_items').select('stock').eq('id', b.item_id).single();
    if (it && it.stock != null) await sb.from('hr_bhp_items').update({ stock: Math.max(0, Number(it.stock) - quantity) }).eq('id', b.item_id);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.bhp'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Brak id' }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const returnedAt = b.returned_at === null ? null : (/^\d{4}-\d{2}-\d{2}$/.test(String(b.returned_at || '')) ? b.returned_at : new Date().toISOString().slice(0, 10));
  const { data, error } = await (admin() as any).from('hr_bhp_issues').update({ returned_at: returnedAt }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.delete'))) return NextResponse.json({ error: 'Usuwać wydania może administrator' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Brak id' }, { status: 400 });
  const sb = admin() as any;
  const { data: issue } = await sb.from('hr_bhp_issues').select('acc_entry_id, amount:unit_cost').eq('id', id).single();
  const accCompanyId = await hrLinkedCompanyId();
  if (accCompanyId && issue?.acc_entry_id) await sb.from('acc_entries').delete().eq('id', issue.acc_entry_id); // spójność bilansu
  const { error } = await sb.from('hr_bhp_issues').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
