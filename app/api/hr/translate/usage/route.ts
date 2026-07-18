// GET  /api/hr/translate/usage — stan dziennego limitu tłumacza (pracownik tymczasowy)
// POST — heartbeat rozmowy na żywo: {seconds} (max 60/call) dosypuje zużycie;
//        gdy limit padnie, klient kończy sesję.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { consumeTranslator } from '@/lib/hr/translatorLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || (auth.role !== 'pracownik_tymczasowy' && !(await canAny(auth, AGENCJA_TABS)))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const s = await consumeTranslator(auth, 0);
  return NextResponse.json(s);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || (auth.role !== 'pracownik_tymczasowy' && !(await canAny(auth, AGENCJA_TABS)))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const seconds = Math.min(60, Math.max(0, Math.round(Number(b.seconds) || 0)));
  const s = await consumeTranslator(auth, seconds);
  return NextResponse.json(s, { status: s.ok ? 200 : 429 });
}
