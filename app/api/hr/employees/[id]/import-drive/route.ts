// POST /api/hr/employees/[id]/import-drive
// Body: { files: [{ driveId, filename, contentType? }] }
// Serwer pobiera pliki z publicznych linków Drive (uc?export=download) i wrzuca
// do bucketu hr-documents (bajty nie przechodzą przez kontekst agenta). Idempotentne.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const files = body?.files;
  if (!Array.isArray(files) || !files.length) return NextResponse.json({ error: 'Brak plików' }, { status: 400 });

  const sb = admin() as any;
  const { data: existing } = await sb.from('hr_documents').select('path').eq('employee_id', id);
  const existingPaths = new Set((existing || []).map((d: any) => d.path));

  let imported = 0, skipped = 0;
  const errors: string[] = [];
  for (const f of files.slice(0, 50)) {
    const path = `${id}/drive-${f.driveId}`;
    if (existingPaths.has(path)) { skipped++; continue; }
    try {
      const res = await fetch(`https://drive.google.com/uc?export=download&id=${f.driveId}`, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || ct.includes('text/html')) { errors.push(`${f.filename}: niedostępny (${res.status}${ct.includes('html') ? ' html' : ''})`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const up = await sb.storage.from('hr-documents').upload(path, buf, { contentType: f.contentType || ct || 'application/octet-stream', upsert: true });
      if (up.error) { errors.push(`${f.filename}: ${up.error.message}`); continue; }
      await sb.from('hr_documents').insert({ employee_id: id, filename: f.filename, path, content_type: f.contentType || ct, size: buf.length, uploaded_by: auth.id });
      imported++;
    } catch (e: any) { errors.push(`${f.filename}: ${e?.message || e}`); }
  }
  return NextResponse.json({ imported, skipped, errors });
}
