// GET /api/accounting/companies — firmy widoczne dla usera (admin: wszystkie)
// POST — nowa firma (admin lub rola ksiegowa — księgowa zakłada własne firmy i zostaje ownerem)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { myCompanies, ACC_ADMIN_ROLES } from '@/lib/accounting/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_ROLES = [...ACC_ADMIN_ROLES, 'ksiegowa'];

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const companies = await myCompanies(auth);
  if (!companies.length) return NextResponse.json({ companies: [] });
  // dane pełne (adres itd.) dla widocznych firm
  const { data } = await (admin() as any).from('acc_companies').select('*').in('id', companies.map(c => c.id));
  const byId = new Map((data || []).map((c: any) => [c.id, c]));
  return NextResponse.json({
    companies: companies.map(c => {
      const { ksef_token_enc, ...safe } = (byId.get(c.id) || {}) as any;
      return { ...safe, ksef_configured: !!ksef_token_enc, member_role: c.member_role };
    }),
    can_create: CREATE_ROLES.includes(auth.role),
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !CREATE_ROLES.includes(auth.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.name?.trim()) return NextResponse.json({ error: 'Nazwa firmy wymagana' }, { status: 400 });
  const sb = admin() as any;
  const { data, error } = await sb.from('acc_companies').insert({
    name: String(b.name).trim().slice(0, 200),
    nip: b.nip?.replace(/\D/g, '') || null,
    regon: b.regon?.trim() || null,
    address: b.address?.trim() || null,
    city: b.city?.trim() || null,
    postal_code: b.postal_code?.trim() || null,
    email: b.email?.trim() || null,
    phone: b.phone?.trim() || null,
    bank_account: b.bank_account?.trim() || null,
    invoice_prefix: (b.invoice_prefix?.trim() || 'FV').slice(0, 10),
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from('acc_company_members').insert({ company_id: data.id, user_id: auth.id, role: 'owner' });
  return NextResponse.json(data, { status: 201 });
}
