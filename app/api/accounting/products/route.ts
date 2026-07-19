// GET /api/accounting/products?company_id= — magazyn firmy (produkty, stany)
// POST — nowy produkt
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess } from '@/lib/accounting/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const companyId = new URL(request.url).searchParams.get('company_id') || '';
  const role = await companyAccess(auth, companyId);
  if (!role) return NextResponse.json({ error: 'Brak dostępu do firmy' }, { status: 403 });
  const { data, error } = await (admin() as any).from('acc_products').select('*').eq('company_id', companyId).order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [], can_edit: role !== 'podglad' });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.company_id || !b?.name?.trim()) return NextResponse.json({ error: 'Wymagana firma i nazwa' }, { status: 400 });
  if (!(await companyAccess(auth, b.company_id, true))) return NextResponse.json({ error: 'Brak uprawnień do zapisu' }, { status: 403 });
  const { data, error } = await (admin() as any).from('acc_products').insert({
    company_id: b.company_id,
    name: String(b.name).trim().slice(0, 250),
    sku: b.sku?.trim() || null,
    unit: (b.unit?.trim() || 'szt.').slice(0, 20),
    purchase_price: Number(b.purchase_price) || null,
    sale_price: Number(b.sale_price) || null,
    vat_rate: Number.isFinite(Number(b.vat_rate)) ? Number(b.vat_rate) : 23,
    stock_qty: Number(b.stock_qty) || 0,
    min_qty: Number(b.min_qty) || null,
    notes: b.notes?.trim() || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
