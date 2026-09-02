// POST /api/notes/transcribe — nagranie głosowe → tekst (Whisper), E7e.
// Multipart: file. Zwraca { ok, text }. Nic nie zapisuje — tekst wraca do UI,
// użytkownik go poprawia i dopiero wysyła do /api/notes/from-text.
//
// Świadomie NIE korzystamy z `/api/hr/translate/voice`: tamten route jest bramkowany
// uprawnieniami agencji i zjada dzienny limit tłumacza (`translatorLimit`), który
// z notatkami CRM nie ma nic wspólnego.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // limit Whispera

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.notatki'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // AI-guard E2d: bez klucza nagrywanie jest wyłączone, ale wpisywanie tekstu działa dalej.
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: false,
      disabled: true,
      error: 'Dyktowanie wyłączone — brak OPENAI_API_KEY. Wpisz notatkę tekstem.',
    });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Brak pliku nagrania' }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Nagranie za duże (limit 25 MB)' }, { status: 413 });
  }

  const contentType = file.type || 'audio/webm';
  const ext = /mpeg|mp3/.test(contentType) ? 'mp3'
    : /ogg/.test(contentType) ? 'ogg'
    : /wav/.test(contentType) ? 'wav'
    : /mp4|m4a/.test(contentType) ? 'mp4'
    : 'webm';

  const fd = new FormData();
  fd.append('file', new Blob([await file.arrayBuffer()], { type: contentType }), `notatka.${ext}`);
  fd.append('model', 'whisper-1');
  fd.append('language', 'pl');

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  const d = await r.json().catch(() => ({} as any));
  if (!r.ok) {
    return NextResponse.json(
      { error: `Transkrypcja nie powiodła się: ${d?.error?.message || r.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, text: String(d.text || '').trim() });
}
