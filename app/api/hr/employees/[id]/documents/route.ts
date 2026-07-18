// GET — lista dokumentów (signed URL) · POST — upload pliku (multipart)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data, error } = await sb.from('hr_documents').select('*').eq('employee_id', id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const documents = await Promise.all((data || []).map(async (d: any) => {
    const { data: s } = await sb.storage.from('hr-documents').createSignedUrl(d.path, 60 * 60);
    return { ...d, url: s?.signedUrl ?? null };
  }));
  // koordynator może tylko dodawać — UI chowa przyciski usuwania
  return NextResponse.json({ documents, can_delete: auth.role !== 'koordynator' });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: 'Brak pliku' }, { status: 400 }); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
  if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: 'Plik za duży (max 30 MB)' }, { status: 400 });
  // teczka: skany dokumentów i PDF-y (bez plików wykonywalnych)
  const okType = /^(image\/|application\/pdf|application\/vnd\.openxmlformats|application\/msword|application\/octet-stream)/i.test(file.type || '');
  if (!okType) return NextResponse.json({ error: `Nieobsługiwany typ pliku (${file.type || 'brak'}) — dozwolone: zdjęcia, PDF, DOC` }, { status: 400 });

  const sb = admin() as any;
  const buf = Buffer.from(await file.arrayBuffer());
  const safe = (file.name || 'plik').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  const path = `${id}/${Date.now()}-${safe}`;
  const up = await sb.storage.from('hr-documents').upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (up.error) return NextResponse.json({ error: `Upload: ${up.error.message}` }, { status: 500 });

  const { data, error } = await sb.from('hr_documents').insert({
    employee_id: id, filename: file.name || safe, path,
    content_type: file.type || null, size: file.size || null, uploaded_by: auth.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
