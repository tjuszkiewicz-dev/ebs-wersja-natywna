// POST /api/permissions/sync — ręczne uzupełnienie nowych zakładek agencji dla ról
// customized (zwykle dzieje się automatycznie przy otwarciu listy ról).
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { syncAgencyPermsForCustomizedRoles } from '@/lib/permissions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await getAuthUserWithRole();
  if (!auth || !auth.isOwner) return NextResponse.json({ error: 'Tylko właściciel (owner) zarządza uprawnieniami' }, { status: 403 });
  const synced = await syncAgencyPermsForCustomizedRoles();
  return NextResponse.json({ ok: true, synced });
}
