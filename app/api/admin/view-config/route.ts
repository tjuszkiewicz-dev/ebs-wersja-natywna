// Konfiguracja WIDOKU per rola — które zakładki panelu widzi dana rola.
//   • GET            — { hidden: string[] } dla ROLI wołającego (superadmin → puste).
//   • GET ?manage=1  — (superadmin) katalog widoków + role + mapa ukrytych per rola.
//   • POST           — (superadmin) { role, hidden: string[] }.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { ADMIN_VIEWS, ADMIN_VIEW_IDS } from '@/lib/adminViews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = supabaseServer() as any;

  if (new URL(request.url).searchParams.get('manage') === '1') {
    if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin' }, { status: 403 });
    const [{ data: cfg }, { data: roles }] = await Promise.all([
      sb.from('admin_view_config').select('role, view_id, hidden'),
      sb.from('app_roles').select('role, label').order('is_system', { ascending: false }).order('label'),
    ]);
    const hiddenByRole: Record<string, string[]> = {};
    for (const r of cfg || []) { if ((r as any).hidden && ADMIN_VIEW_IDS.has((r as any).view_id)) (hiddenByRole[(r as any).role] ||= []).push((r as any).view_id); }
    return NextResponse.json({
      catalog: ADMIN_VIEWS,
      roles: (roles || []).filter((r: any) => r.role !== 'superadmin').map((r: any) => ({ role: r.role, label: r.label || r.role })),
      hidden_by_role: hiddenByRole,
    });
  }

  const hidden = auth.role === 'superadmin' ? [] : ((await sb.from('admin_view_config').select('view_id, hidden').eq('role', auth.role))
    .data?.filter((r: any) => r.hidden).map((r: any) => r.view_id) ?? []);
  return NextResponse.json({ hidden });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza widokiem ról' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const role = String(b.role || '').trim();
  if (!role || role === 'superadmin') return NextResponse.json({ error: 'Wskaż rolę (superadmin nieedytowalny)' }, { status: 400 });
  const hidden: string[] = Array.isArray(b.hidden) ? b.hidden.filter((v: any) => ADMIN_VIEW_IDS.has(v)) : [];
  const sb = supabaseServer() as any;
  const uid = isUuid(auth.id) ? auth.id : null;
  const rows = ADMIN_VIEWS.map(v => ({
    role, view_id: v.id, label: v.label, hidden: hidden.includes(v.id),
    updated_by: uid, updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from('admin_view_config').upsert(rows, { onConflict: 'role,view_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, role, hidden });
}
