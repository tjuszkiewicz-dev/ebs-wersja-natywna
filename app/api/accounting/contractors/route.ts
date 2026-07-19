// GET /api/accounting/contractors?company_id= — kontrahenci firmy
// POST — nowy kontrahent (dane ręczne albo z GUS po NIP — lookup robi UI przez /api/companies/gus-lookup)
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
  const { data, error } = await (admin() as any).from('acc_contractors').select('*').eq('company_id', companyId).order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contractors: data ?? [], can_edit: role !== 'podglad' });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.company_id || !b?.name?.trim()) return NextResponse.json({ error: 'Wymagana firma i nazwa kontrahenta' }, { status: 400 });
  const role = await companyAccess(auth, b.company_id, true);
  if (!role) return NextResponse.json({ error: 'Brak uprawnień do zapisu w tej firmie' }, { status: 403 });
  const { data, error } = await (admin() as any).from('acc_contractors').insert({
    company_id: b.company_id,
    name: String(b.name).trim().slice(0, 250),
    nip: b.nip?.replace(/\D/g, '') || null,
    address: b.address?.trim() || null,
    city: b.city?.trim() || null,
    postal_code: b.postal_code?.trim() || null,
    email: b.email?.trim() || null,
    phone: b.phone?.trim() || null,
    notes: b.notes?.trim() || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
