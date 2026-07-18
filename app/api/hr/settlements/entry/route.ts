// POST  /api/hr/settlements/entry — dodaj zaliczkę lub wypłatę
// GET   ?employeeId= — historia zaliczek + wypłat pracownika
// DELETE ?id=&kind=advance|payout — usuń wpis
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tableOf = (kind: string) => (kind === 'payout' ? 'hr_payouts' : 'hr_advances');

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // koordynator ma w rozliczeniach tylko podgląd
  if (auth.role === 'koordynator') return NextResponse.json({ error: 'Koordynator nie może dodawać zaliczek ani wypłat' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.employee_id || !b?.period || b?.amount == null) return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Kwota musi być dodatnia' }, { status: 400 });
  const { data, error } = await (admin() as any).from(tableOf(b.kind)).insert({
    employee_id: b.employee_id,
    period: b.period,
    amount,
    note: b.note?.trim() || null,
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const employeeId = new URL(request.url).searchParams.get('employeeId');
  if (!employeeId) return NextResponse.json({ error: 'Brak pracownika' }, { status: 400 });
  const sb = admin() as any;
  const [adv, pay] = await Promise.all([
    sb.from('hr_advances').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }),
    sb.from('hr_payouts').select('*').eq('employee_id', employeeId).order('paid_at', { ascending: false }),
  ]);
  const items = [
    ...(adv.data || []).map((a: any) => ({ ...a, kind: 'advance', date: a.created_at })),
    ...(pay.data || []).map((p: any) => ({ ...p, kind: 'payout', date: p.paid_at })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  return NextResponse.json({ items });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.rozliczenia'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (auth.role === 'koordynator') return NextResponse.json({ error: 'Koordynator nie może usuwać wpisów rozliczeń' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const kind = searchParams.get('kind') || 'advance';
  if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 });
  const { error } = await (admin() as any).from(tableOf(kind)).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
