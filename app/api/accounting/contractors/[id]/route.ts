// PATCH/DELETE /api/accounting/contractors/[id]
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess } from '@/lib/accounting/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadWithAccess(id: string, auth: any) {
  const { data } = await (admin() as any).from('acc_contractors').select('*').eq('id', id).single();
  if (!data) return null;
  const role = await companyAccess(auth, data.company_id, true);
  return role ? data : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const c = await loadWithAccess(id, auth);
  if (!c) return NextResponse.json({ error: 'Brak kontrahenta lub uprawnień' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const patch: any = {};
  for (const f of ['name', 'nip', 'address', 'city', 'postal_code', 'email', 'phone', 'notes'] as const) {
    if (f in b) patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  }
  if (patch.nip) patch.nip = String(patch.nip).replace(/\D/g, '');
  if (patch.name !== undefined && !patch.name) return NextResponse.json({ error: 'Nazwa wymagana' }, { status: 400 });
  const { data, error } = await (admin() as any).from('acc_contractors').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const c = await loadWithAccess(id, auth);
  if (!c) return NextResponse.json({ error: 'Brak kontrahenta lub uprawnień' }, { status: 403 });
  // kontrahent z fakturami: nie usuwamy (faktury mają FK set null — ale historii nie psujemy)
  const { count } = await (admin() as any).from('acc_invoices').select('id', { count: 'exact', head: true }).eq('contractor_id', id);
  if (count) return NextResponse.json({ error: `Kontrahent ma ${count} faktur — nie można usunąć (historia)` }, { status: 400 });
  const { error } = await (admin() as any).from('acc_contractors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
