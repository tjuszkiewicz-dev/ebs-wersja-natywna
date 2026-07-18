// POST /api/hr/translate — automatyczny tłumacz Agencji Pracy (komunikacja z pracownikami).
// Body: { text, target } — target: pl|en|es|ru|uk|lt|de. Wykrywa język źródłowy,
// tłumaczy przez Claude; zwraca { translation, detected, detected_name }.
// Endpoint nie zapisuje danych (brak mutacji, brak audytu). Rdzeń: lib/hr/translateCore.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { LANGS, translateWithClaude } from '@/lib/hr/translateCore';
import { consumeTranslator, TEXT_COST_S } from '@/lib/hr/translatorLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  // dostęp: role agencji ORAZ pracownik tymczasowy (z dziennym limitem płatnego użycia)
  if (!auth || (auth.role !== 'pracownik_tymczasowy' && !(await canAny(auth, AGENCJA_TABS)))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // AI-guard E2d: łagodna degradacja bez klucza
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, disabled: true, error: 'Funkcja AI wyłączona — brak ANTHROPIC_API_KEY' });
  const limit = await consumeTranslator(auth, TEXT_COST_S);
  if (!limit.ok) return NextResponse.json({ error: 'Dzienny limit tłumacza wyczerpany — spróbuj jutro', remaining_s: 0 }, { status: 429 });

  const b = await request.json().catch(() => ({}));
  const text = String(b.text || '').trim();
  const target = String(b.target || 'pl');
  if (!text) return NextResponse.json({ error: 'Wpisz tekst do przetłumaczenia' }, { status: 400 });
  if (text.length > 8000) return NextResponse.json({ error: 'Tekst za długi (max 8000 znaków)' }, { status: 400 });
  if (!LANGS[target]) return NextResponse.json({ error: 'Nieobsługiwany język docelowy' }, { status: 400 });

  try {
    const { detected, translation } = await translateWithClaude(text, target);
    if (!translation) return NextResponse.json({ error: 'Tłumacz zwrócił pustą odpowiedź — spróbuj ponownie' }, { status: 502 });
    return NextResponse.json({ translation, detected, detected_name: LANGS[detected] || detected || 'nieznany', target, remaining_s: limit.limited ? limit.remaining : null });
  } catch (e) {
    console.error('[translate]', e);
    return NextResponse.json({ error: 'Błąd tłumaczenia — spróbuj ponownie' }, { status: 502 });
  }
}
