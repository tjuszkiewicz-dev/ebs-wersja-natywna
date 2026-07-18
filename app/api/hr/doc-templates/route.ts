// GET /api/hr/doc-templates — lista szablonów dokumentów (z treścią)
// POST — nowy szablon
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.generator'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = await (admin() as any).from('hr_doc_templates')
    .select('*').order('sort').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.generator'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!b?.name?.trim()) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 });
  const category = ['pracownicze', 'umowy', 'benefitowe', 'koscielne'].includes(b.category) ? b.category : 'pracownicze';
  const { data, error } = await (admin() as any).from('hr_doc_templates').insert({
    name: b.name.trim(),
    content_html: b.content_html || '<p>Treść dokumentu…</p>',
    has_letterhead: !!b.has_letterhead,
    category,
    created_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
