// POST /api/hr/translate/voice — rozmowa na żywo w Tłumaczu Agencji Pracy.
// Multipart: file (webm z jednej wypowiedzi), other (kod języka rozmówcy, np. es).
// Whisper transkrybuje i WYKRYWA język → kierunek: polski → język rozmówcy,
// wszystko inne → polski. Zwraca { transcript, detected, direction, target, translation }.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { LANGS, WHISPER_LANG, translateWithClaude } from '@/lib/hr/translateCore';
import { consumeTranslator, VOICE_UTTER_COST_S } from '@/lib/hr/translatorLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // pojedyncza wypowiedź — 10 MB aż nadto

async function whisperVerbose(buf: Buffer, contentType: string): Promise<{ text: string; language: string }> {
  const ext = /mpeg|mp3/.test(contentType) ? 'mp3' : /ogg/.test(contentType) ? 'ogg' : /wav/.test(contentType) ? 'wav' : /mp4|m4a/.test(contentType) ? 'mp4' : 'webm';
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: contentType }), `wypowiedz.${ext}`);
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'verbose_json');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Whisper: ${d?.error?.message || r.status}`);
  return { text: String(d.text || '').trim(), language: String(d.language || '').toLowerCase() };
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || (auth.role !== 'pracownik_tymczasowy' && !(await canAny(auth, AGENCJA_TABS)))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // AI-guard E2d: łagodna degradacja bez klucza
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, disabled: true, error: 'Tłumacz głosowy wyłączony — brak OPENAI_API_KEY' });
  const limit = await consumeTranslator(auth, VOICE_UTTER_COST_S);
  if (!limit.ok) return NextResponse.json({ error: 'Dzienny limit tłumacza wyczerpany — spróbuj jutro' }, { status: 429 });
  // AI-guard E2d: łagodna degradacja bez klucza
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, disabled: true, error: 'Funkcja AI wyłączona — brak ANTHROPIC_API_KEY' });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  const other = String(form?.get('other') || 'es');
  if (!file || file.size === 0) return NextResponse.json({ error: 'Brak nagrania' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Wypowiedź za długa' }, { status: 400 });
  if (!LANGS[other] || other === 'pl') return NextResponse.json({ error: 'Nieobsługiwany język rozmówcy' }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { text, language } = await whisperVerbose(buf, file.type || 'audio/webm');
    // cisza / sam szum — Whisper zwraca pusty tekst albo pojedyncze znaki
    if (!text || text.replace(/[.,!?\s-]+/g, '').length < 2) return NextResponse.json({ skip: true });

    const detected = WHISPER_LANG[language] || language.slice(0, 2);
    // kierunek rozmowy: mówię po polsku → tłumacz na język rozmówcy; on mówi → na polski
    const direction = detected === 'pl' ? 'me' : 'other';
    const target = direction === 'me' ? other : 'pl';
    const { translation } = await translateWithClaude(text, target);
    if (!translation) return NextResponse.json({ error: 'Puste tłumaczenie — powtórz wypowiedź' }, { status: 502 });

    return NextResponse.json({ transcript: text, detected, direction, target, translation });
  } catch (e) {
    console.error('[translate/voice]', e);
    return NextResponse.json({ error: 'Błąd tłumaczenia głosu — spróbuj ponownie' }, { status: 502 });
  }
}
