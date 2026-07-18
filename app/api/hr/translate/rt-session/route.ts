// POST /api/hr/translate/rt-session — sesja tłumacza symultanicznego (OpenAI Realtime).
// Body: { other } — język rozmówcy. Mintuje KRÓTKOTRWAŁY client secret (klucz OpenAI
// zostaje na serwerze); przeglądarka łączy się przez WebRTC bezpośrednio z OpenAI.
// Model gpt-realtime-2.1-mini jako tłumacz dwukierunkowy (polski ↔ język rozmówcy) —
// gpt-realtime-translate nie ma polskiego wśród języków wyjściowych.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { LANGS } from '@/lib/hr/translateCore';
import { consumeTranslator } from '@/lib/hr/translatorLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const INTERPRETER = (other: string) => `Jesteś tłumaczem symultanicznym w polskiej agencji pracy zatrudniającej cudzoziemców.
W rozmowie uczestniczą: koordynator (mówi po polsku) i pracownik (mówi w języku: ${LANGS[other]}).
TWOJE JEDYNE ZADANIE: po każdej wypowiedzi wypowiedz WYŁĄCZNIE jej tłumaczenie.
— Wypowiedź po polsku → przetłumacz na ${LANGS[other]}.
— Wypowiedź w języku ${LANGS[other]} (lub każdym innym niż polski) → przetłumacz na polski.
Zasady bezwzględne:
— NIGDY nie odpowiadaj na pytania, nie komentuj, nie doradzaj, nie witaj się od siebie — jesteś niewidzialnym tłumaczem, nie uczestnikiem.
— Tłumacz wiernie i naturalnie, w rejestrze mówiącego.
— NIE tłumacz nazwisk, nazw własnych, numerów dokumentów, kwot ani dat — powtarzaj je dokładnie.
— Polskie terminy urzędowe (karta pobytu, zezwolenie na pracę, PESEL, urząd) przy pierwszym użyciu podaj w języku docelowym z polskim oryginałem, np. "tarjeta de residencia (karta pobytu)".
— Jeśli wypowiedź jest niezrozumiała, powiedz krótko w języku docelowym, że nie dosłyszałeś.`;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || (auth.role !== 'pracownik_tymczasowy' && !(await canAny(auth, AGENCJA_TABS)))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // AI-guard E2d: łagodna degradacja bez klucza
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, disabled: true, error: 'Tłumacz głosowy wyłączony — brak OPENAI_API_KEY' });
  // pracownik: sesja rozmowy rusza tylko, gdy został limit; zużycie dosypują heartbeaty (/translate/usage)
  const limit = await consumeTranslator(auth, 0);
  if (!limit.ok) return NextResponse.json({ error: 'Dzienny limit tłumacza wyczerpany — spróbuj jutro' }, { status: 429 });

  const b = await request.json().catch(() => ({}));
  const other = String(b.other || 'es');
  if (!LANGS[other] || other === 'pl') return NextResponse.json({ error: 'Nieobsługiwany język rozmówcy' }, { status: 400 });

  const session = {
    type: 'realtime',
    model: 'gpt-realtime-2.1-mini',
    instructions: INTERPRETER(other),
    audio: {
      input: {
        transcription: { model: 'gpt-realtime-whisper' },
        noise_reduction: { type: 'near_field' },
        turn_detection: { type: 'semantic_vad' },
      },
      output: { voice: 'marin' },
    },
  };

  try {
    const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[rt-session]', d);
      return NextResponse.json({ error: d?.error?.message || 'Nie udało się utworzyć sesji tłumacza' }, { status: 502 });
    }
    return NextResponse.json({ client_secret: d.value || d.client_secret?.value, model: session.model });
  } catch (e) {
    console.error('[rt-session]', e);
    return NextResponse.json({ error: 'Błąd tworzenia sesji tłumacza' }, { status: 502 });
  }
}
