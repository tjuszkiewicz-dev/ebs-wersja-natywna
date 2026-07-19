// GET/PATCH /api/accounting/companies/[id] — dane firmy + członkowie; edycja: owner/admin
// POST — zarządzanie członkami: { action: 'add'|'remove'|'set_role', user_id, member_role? }
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { companyAccess } from '@/lib/accounting/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function profilesMap(ids: string[]): Promise<Map<string, { full_name: string }>> {
  if (!ids.length) return new Map();
  const { data } = await (admin() as any).from('user_profiles').select('id, full_name').in('id', ids);
  return new Map((data || []).map((u: any) => [u.id, { full_name: u.full_name }]));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const role = await companyAccess(auth, id);
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = admin() as any;
  const [{ data: company }, { data: members }] = await Promise.all([
    sb.from('acc_companies').select('*').eq('id', id).single(),
    sb.from('acc_company_members').select('user_id, role').eq('company_id', id),
  ]);
  const profiles = await profilesMap((members || []).map((m: any) => m.user_id));
  // tokenu KSeF NIGDY nie zwracamy — tylko flagę, że jest skonfigurowany
  const { ksef_token_enc, ...companySafe } = company || {};
  return NextResponse.json({
    company: { ...companySafe, ksef_configured: !!ksef_token_enc },
    my_role: role,
    members: (members || []).map((m: any) => ({ user_id: m.user_id, role: m.role, name: profiles.get(m.user_id)?.full_name || '—' })),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const role = await companyAccess(auth, id, true);
  if (!role || (role !== 'owner' && role !== 'admin')) return NextResponse.json({ error: 'Tylko właściciel firmy może edytować jej dane' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const patch: any = {};
  for (const f of ['name', 'nip', 'regon', 'address', 'city', 'postal_code', 'email', 'phone', 'bank_account', 'invoice_prefix'] as const) {
    if (f in b) patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  }
  if (patch.name !== undefined && !patch.name) return NextResponse.json({ error: 'Nazwa wymagana' }, { status: 400 });
  // KSeF: EBS nie ma własnego wystawiania/KSeF (Fakturownia) — pola tokenu/env nieobsługiwane
  const { data, error } = await (admin() as any).from('acc_companies').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const role = await companyAccess(auth, id, true);
  if (!role || (role !== 'owner' && role !== 'admin')) return NextResponse.json({ error: 'Tylko właściciel zarządza członkami' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.action || !b?.user_id) return NextResponse.json({ error: 'Brak akcji/użytkownika' }, { status: 400 });
  const sb = admin() as any;
  const memberRole = ['owner', 'ksiegowa', 'podglad'].includes(b.member_role) ? b.member_role : 'ksiegowa';

  if (b.action === 'add' || b.action === 'set_role') {
    const { error } = await sb.from('acc_company_members').upsert({ company_id: id, user_id: b.user_id, role: memberRole }, { onConflict: 'company_id,user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (b.action === 'remove') {
    if (b.user_id === auth.id) return NextResponse.json({ error: 'Nie możesz usunąć samego siebie' }, { status: 400 });
    await sb.from('acc_company_members').delete().eq('company_id', id).eq('user_id', b.user_id);
  } else {
    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
