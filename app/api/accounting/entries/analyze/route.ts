// POST /api/accounting/entries/analyze — AI czyta zdjęcie/PDF faktury kosztowej
// i zwraca gotowe pola wpisu (kategoria, kwota, data, kontrahent, numer).
// Wzorzec: TaxHacker (LLM analiza paragonów/faktur). Multipart: file.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = getAnthropic;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const PROMPT = `Czytasz fakturę kosztową / paragon polskiej firmy. Wyodrębnij dane i zwróć WYŁĄCZNIE poprawny JSON:
{
 "kind": "cost",
 "category": "czynsz_najmu|media|transport|wynagrodzenia|zus_podatki|paliwo|biuro|sprzet|inne",
 "amount": kwota BRUTTO do zapłaty (liczba),
 "entry_date": "YYYY-MM-DD (data wystawienia)",
 "contractor": "nazwa sprzedawcy",
 "invoice_number": "numer faktury lub null",
 "description": "krótko czego dotyczy (po polsku)"
}
Kategorię dobierz z listy po treści pozycji (np. paliwo na stacji → paliwo, energia/woda/gaz → media, najem → czynsz_najmu, leasing/materiały biurowe → biuro, narzędzia/komputery → sprzet). Nie zgaduj kwot — bierz „do zapłaty"/„razem brutto".`;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, ['ksiegowosc.faktury', 'ksiegowosc.bilans']))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // AI-guard E2d
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, disabled: true, error: 'Odczyt AI wyłączony — brak ANTHROPIC_API_KEY' });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Plik za duży (max 15 MB)' }, { status: 400 });

  const ct = (file.type || '').toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const data = buf.toString('base64');
  let block: any;
  if (IMAGE_TYPES.includes(ct)) block = { type: 'image', source: { type: 'base64', media_type: ct, data } };
  else if (ct === 'application/pdf' || /\.pdf$/i.test(file.name || '')) block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
  else return NextResponse.json({ error: `Nieobsługiwany format (${ct || 'brak typu'}) — użyj JPG/PNG/PDF` }, { status: 400 });

  try {
    const resp = await anthropic().messages.create({
      model: AI_MODEL, max_tokens: 800,
      messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }],
    });
    const text = resp.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return NextResponse.json({ error: 'AI nie odczytało faktury' }, { status: 422 });
    const parsed = JSON.parse(jsonStr);
    return NextResponse.json({
      kind: 'cost',
      category: ['czynsz_najmu', 'media', 'transport', 'wynagrodzenia', 'zus_podatki', 'paliwo', 'biuro', 'sprzet', 'inne'].includes(parsed.category) ? parsed.category : 'inne',
      amount: Number(parsed.amount) > 0 ? Number(parsed.amount) : null,
      entry_date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.entry_date || '') ? parsed.entry_date : null,
      contractor: parsed.contractor || null,
      invoice_number: parsed.invoice_number || null,
      description: parsed.description || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Błąd analizy AI' }, { status: 500 });
  }
}
