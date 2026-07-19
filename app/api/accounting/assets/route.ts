// GET /api/accounting/assets?company_id=&period=YYYY-MM — środki trwałe ze stanem amortyzacji
// POST — nowy środek trwały (amortyzacja liniowa)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess } from '@/lib/accounting/access';
import { assetState } from '@/lib/accounting/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const companyId = sp.get('company_id') || '';
  const role = await companyAccess(auth, companyId);
  if (!role) return NextResponse.json({ error: 'Brak dostępu do firmy' }, { status: 403 });
  const period = /^\d{4}-\d{2}$/.test(sp.get('period') || '') ? sp.get('period')! : new Date().toISOString().slice(0, 7);
  const { data, error } = await (admin() as any).from('acc_fixed_assets').select('*').eq('company_id', companyId).order('purchase_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const assets = (data ?? []).map((a: any) => ({ ...a, ...assetState(a, period) }));
  return NextResponse.json({ period, assets, can_edit: role !== 'podglad' });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.company_id || !b?.name?.trim() || !b?.purchase_date || !(Number(b.initial_value) > 0)) {
    return NextResponse.json({ error: 'Wymagane: firma, nazwa, data zakupu, wartość początkowa' }, { status: 400 });
  }
  if (!(await companyAccess(auth, b.company_id, true))) return NextResponse.json({ error: 'Brak uprawnień do zapisu' }, { status: 403 });
  const rate = Number(b.amortization_rate);
  const { data, error } = await (admin() as any).from('acc_fixed_assets').insert({
    company_id: b.company_id,
    name: String(b.name).trim().slice(0, 250),
    purchase_date: b.purchase_date,
    initial_value: Number(b.initial_value),
    amortization_rate: Number.isFinite(rate) && rate > 0 && rate <= 100 ? rate : 20,
    notes: b.notes?.trim() || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
