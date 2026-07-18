// POST /api/hr/employees/[id]/account — konto systemowe pracownika tymczasowego.
// Koordynator/administrator generuje login (e-mail z kartoteki albo wygenerowany)
// i hasło startowe — przekazuje je pracownikowi. Ponowne wywołanie = reset hasła.
// GET — status konta (czy istnieje, login).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// hasło startowe: 10 znaków bez mylących 0/O/l/1
function genPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join('');
}

const slug = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '').slice(0, 20);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data: e } = await sb.from('hr_employees').select('user_id').eq('id', id).single();
  if (!e?.user_id) return NextResponse.json({ exists: false });
  const { data: u } = await (sb.auth as any).admin.getUserById(e.user_id);
  return NextResponse.json({ exists: true, login: u?.user?.email ?? null });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data: e } = await sb.from('hr_employees').select('id, first_name, last_name, email, user_id, candidate, archived').eq('id', id).single();
  if (!e) return NextResponse.json({ error: 'Nie ma takiego pracownika' }, { status: 404 });
  if (e.candidate) return NextResponse.json({ error: 'Kandydat z Poczekalni — konto załóż po przydzieleniu do kontraktu' }, { status: 400 });
  if (e.archived) return NextResponse.json({ error: 'Pracownik zarchiwizowany' }, { status: 400 });

  const fullName = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim();
  const password = genPassword();

  // istniejące konto → reset hasła
  if (e.user_id) {
    const { data: u } = await (sb.auth as any).admin.getUserById(e.user_id);
    const { error } = await (sb.auth as any).admin.updateUserById(e.user_id, { password, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ login: u?.user?.email ?? null, password, reset: true });
  }

  // login: e-mail z kartoteki albo wygenerowany w naszej domenie roboczej
  const email = (e.email && /\S+@\S+\.\S+/.test(e.email))
    ? e.email.trim().toLowerCase()
    : `${slug(e.first_name)}.${slug(e.last_name)}.${id.slice(0, 4)}@workers.balticbenefits.pl`;

  const { data: created, error: createErr } = await (sb.auth as any).admin.createUser({ email, password, email_confirm: true });
  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || 'Nie udało się utworzyć konta' }, { status: 400 });
  }
  const userId = created.user.id;
  const { error: profErr } = await sb.from('user_profiles').upsert({
    id: userId, role: 'pracownik_tymczasowy', full_name: fullName || email,
    status: 'active', terms_accepted: true, terms_accepted_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profErr) {
    await (sb.auth as any).admin.deleteUser(userId);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }
  const { error: linkErr } = await sb.from('hr_employees').update({ user_id: userId, updated_at: new Date().toISOString() }).eq('id', id);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  return NextResponse.json({ login: email, password, reset: false }, { status: 201 });
}
