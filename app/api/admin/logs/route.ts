import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const table     = sp.get('table') || undefined;
  const operation = sp.get('operation') || undefined;
  const limit  = Math.min(Math.max(parseInt(sp.get('limit')  || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);

  const supabase = supabaseServer() as any;
  let query = supabase
    .from('audit_log')
    .select('id, table_name, operation, row_id, changed_by, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (table)     query = query.eq('table_name', table);
  if (operation) query = query.eq('operation', operation);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const ids = [...new Set(rows.map(r => r.changed_by).filter(Boolean) as string[])];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('user_profiles').select('id, full_name').in('id', ids);
    for (const p of profiles ?? []) nameById.set(p.id as string, (p as any).full_name ?? '');
  }

  return NextResponse.json({
    rows: rows.map(r => ({ ...r, changed_by_name: r.changed_by ? (nameById.get(r.changed_by) ?? '—') : 'system' })),
    total: count ?? 0,
    limit, offset,
  });
}
