// POST /api/hr/vehicles/[id]/license — zdjęcie prawa jazdy głównego użytkownika:
// zapis do bucketa vehicle-photos + odczyt AI (imię i nazwisko, numer, kategorie,
// data ważności) → pola license_* pojazdu uzupełniają się automatycznie
// (AI-guard: bez ANTHROPIC_API_KEY odczyt jest pomijany, zdjęcie i tak się zapisuje).
// GET — podpisany link do aktualnego zdjęcia prawa jazdy.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { getAnthropic, AI_MODEL } from '@/lib/anthropic';
import { looksLikeImage, normalizeImage } from '@/lib/images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const anthropic = getAnthropic;

const MAX_BYTES = 25 * 1024 * 1024;

const PROMPT = `To zdjęcie prawa jazdy (dowolny kraj UE lub spoza UE). Odczytaj dane i zwróć WYŁĄCZNIE JSON:
{"name":"imię i nazwisko posiadacza","license_number":"numer dokumentu (pole 5)","categories":"kategorie oddzielone przecinkami, np. B, B+E (pole 9)","valid_until":"data ważności RRRR-MM-DD (pole 4b; jeśli bezterminowe albo nieczytelne — null)"}
Przepisuj DOKŁADNIE jak w dokumencie (nie poprawiaj pisowni nazwisk). Nieczytelne pola = null.`;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data: v } = await sb.from('hr_vehicles').select('license_photo_path').eq('id', id).single();
  if (!v?.license_photo_path) return NextResponse.json({ url: null });
  const { data: s } = await sb.storage.from('vehicle-photos').createSignedUrl(v.license_photo_path, 3600);
  return NextResponse.json({ url: s?.signedUrl ?? null });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin() as any;
  const { data: v } = await sb.from('hr_vehicles').select('make, registration, license_photo_path').eq('id', id).single();
  if (!v) return NextResponse.json({ error: 'Brak pojazdu' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Zdjęcie za duże (max 25 MB)' }, { status: 400 });
  if (!looksLikeImage(file.type, file.name)) {
    return NextResponse.json({ error: `To nie jest plik graficzny (${file.type || 'brak typu'})` }, { status: 400 });
  }

  // HEIC (iPhone) → JPEG; przeglądarka nie wyświetli HEIC bezpośrednio
  let img;
  try { img = await normalizeImage(Buffer.from(await file.arrayBuffer()), file.type, file.name); }
  catch { return NextResponse.json({ error: 'Nie udało się przetworzyć zdjęcia — spróbuj innym plikiem' }, { status: 400 }); }
  const ct = img.contentType;
  const buf = img.buf;
  const path = `${id}/license-${crypto.randomUUID()}.${img.ext}`;
  const up = await sb.storage.from('vehicle-photos').upload(path, buf, { contentType: ct });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  if (v.license_photo_path) { try { await sb.storage.from('vehicle-photos').remove([v.license_photo_path]); } catch { /* stare zdjęcie mogło już nie istnieć */ } }

  // AI-guard E2d: łagodna degradacja bez klucza — zdjęcie i tak się zapisuje, tylko bez odczytu AI
  if (!process.env.ANTHROPIC_API_KEY) {
    const patch: any = { license_photo_path: path, updated_at: new Date().toISOString() };
    const { error } = await sb.from('hr_vehicles').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ocr: null, disabled: true });
  }

  // Claude vision przyjmuje jpeg/png/webp/gif — jeśli inny format (np. bmp/tiff), pomiń OCR
  const visionOk = /^image\/(jpeg|png|webp|gif)$/.test(ct);
  let parsed: any = {};
  try {
    if (!visionOk) throw new Error('format-bez-ocr');
    const msg = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: ct as any, data: buf.toString('base64') } }, { type: 'text', text: PROMPT }] }],
    });
    const text = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (jsonStr) parsed = JSON.parse(jsonStr);
  } catch (e) { console.error('[license-ocr]', e); }

  const clean = (x: any) => { const s = String(x ?? '').trim(); return s && s.toLowerCase() !== 'null' ? s : null; };
  const patch: any = {
    license_photo_path: path,
    license_name: clean(parsed.name),
    license_number: clean(parsed.license_number),
    license_categories: clean(parsed.categories),
    license_expiry: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.valid_until || '')) ? parsed.valid_until : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('hr_vehicles').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: s } = await sb.storage.from('vehicle-photos').createSignedUrl(path, 3600);
  return NextResponse.json({
    ok: true,
    url: s?.signedUrl ?? null,
    license_name: patch.license_name, license_number: patch.license_number,
    license_categories: patch.license_categories, license_expiry: patch.license_expiry,
  });
}
