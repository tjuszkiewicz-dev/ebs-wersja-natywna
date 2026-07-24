// PUT    /api/permissions/roles/[role] — zapisz zestaw uprawnień roli (zastępuje całość)
// DELETE — usuń rolę własną (tylko nie-systemową i bez użytkowników)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';
import { ALL_PERMISSIONS } from '@/lib/permissions/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !auth.isOwner) return NextResponse.json({ error: 'Tylko właściciel (owner) zarządza uprawnieniami' }, { status: 403 });
  const { role } = await params;
  if (role === 'superadmin' || role === 'owner') return NextResponse.json({ error: 'Administrator i Super Admin mają zawsze pełne uprawnienia — nie podlegają edycji (widok admina ustaw w panelu „Widok Admina")' }, { status: 400 });

  const b = await request.json().catch(() => ({}));
  const perms: string[] = Array.isArray(b.permissions) ? b.permissions.filter((p: any) => ALL_PERMISSIONS.includes(p)) : [];

  const sb = admin();
  const { data: roleRow } = await (sb as any).from('app_roles').select('role').eq('role', role).maybeSingle();
  if (!roleRow) return NextResponse.json({ error: 'Nie ma takiej roli' }, { status: 404 });

  const del = await (sb as any).from('role_permissions').delete().eq('role', role);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  if (perms.length) {
    const ins = await (sb as any).from('role_permissions').insert(perms.map(p => ({ role, permission: p })));
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }
  await (sb as any).from('app_roles').update({ customized: true }).eq('role', role);
  return NextResponse.json({ ok: true, role, permissions: perms });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !auth.isOwner) return NextResponse.json({ error: 'Tylko właściciel (owner) zarządza uprawnieniami' }, { status: 403 });
  const { role } = await params;
  const sb = admin();
  const { data: roleRow } = await (sb as any).from('app_roles').select('is_system').eq('role', role).maybeSingle();
  if (!roleRow) return NextResponse.json({ error: 'Nie ma takiej roli' }, { status: 404 });
  if (roleRow.is_system) return NextResponse.json({ error: 'Ról systemowych nie można usuwać' }, { status: 400 });
  const { count } = await (sb as any).from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', role);
  if ((count ?? 0) > 0) return NextResponse.json({ error: `Rola ma ${count} użytkowników — najpierw zmień im rolę` }, { status: 400 });
  const { error } = await (sb as any).from('app_roles').delete().eq('role', role);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
