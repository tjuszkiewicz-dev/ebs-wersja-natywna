// POST /api/hr/translate/tts — lektor serwerowy (OpenAI TTS) dla Tłumacza.
// Fallback, gdy urządzenie nie ma głosu systemowego dla języka docelowego
// (speechSynthesis bez zainstalowanego pakietu głosu = cisza, np. ru/de na
// telefonach bez tych pakietów). Body: { text, lang } → audio/mpeg.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { LANGS } from '@/lib/hr/translateCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // AI-guard E2d: łagodna degradacja bez klucza
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, disabled: true, error: 'Tłumacz głosowy wyłączony — brak OPENAI_API_KEY' });

  const b = await request.json().catch(() => ({}));
  const text = String(b.text || '').trim().slice(0, 1200);
  const lang = String(b.lang || 'pl');
  if (!text) return NextResponse.json({ error: 'Brak tekstu' }, { status: 400 });

  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: text,
      instructions: `Przeczytaj tekst naturalnie i wyraźnie w języku: ${LANGS[lang] || 'polskim'}. Czytaj wyłącznie podany tekst, bez żadnych komentarzy.`,
      response_format: 'mp3',
    }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    console.error('[tts]', d);
    return NextResponse.json({ error: d?.error?.message || 'Błąd syntezy mowy' }, { status: 502 });
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return new NextResponse(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}
