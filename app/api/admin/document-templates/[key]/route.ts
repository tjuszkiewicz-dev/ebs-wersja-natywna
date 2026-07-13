import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

type Params = { params: Promise<{ key: string }> };
const Body = z.object({ html: z.string().min(1) });

export async function GET(_req: NextRequest, { params }: Params) {
  const { key } = await params;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer() as any;
  const { data, error } = await supabase
    .from('document_templates').select('key, html, updated_at').eq('key', key).single();
  if (error || !data) return NextResponse.json({ error: 'Nie znaleziono szablonu' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = supabaseServer() as any;
  const { data, error } = await supabase
    .from('document_templates')
    .update({ html: parsed.data.html, updated_by: auth.id, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select('key, html, updated_at')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Nie znaleziono szablonu' }, { status: 404 });
  return NextResponse.json(data);
}
