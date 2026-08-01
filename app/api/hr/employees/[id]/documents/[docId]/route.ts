// DELETE /api/hr/employees/[id]/documents/[docId] — usuń dokument (Storage + rekord)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // koordynator może tylko DODAWAĆ dokumenty — usuwanie zablokowane, chyba że ma nadany wyjątek agencja.dokumenty-usun
  if (auth.role === 'koordynator' && !(await can(auth, 'agencja.dokumenty-usun'))) {
    return NextResponse.json({ error: 'Brak uprawnień do usuwania dokumentów' }, { status: 403 });
  }
  const { id, docId } = await params;
  const sb = admin() as any;
  const { data: doc } = await sb.from('hr_documents').select('path, filename').eq('id', docId).single();
  if (doc?.path) await sb.storage.from('hr-documents').remove([doc.path]);
  const { error } = await sb.from('hr_documents').delete().eq('id', docId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
