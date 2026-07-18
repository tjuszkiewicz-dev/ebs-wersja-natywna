// POST /api/hr/vehicles/[id]/license — zdjęcie prawa jazdy głównego użytkownika:
// zapis do bucketa vehicle-photos. Odczyt AI (imię i nazwisko, numer, kategorie,
// data ważności) → OCR: E2d (odłożone).
// GET — podpisany link do aktualnego zdjęcia prawa jazdy.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { looksLikeImage, normalizeImage } from '@/lib/images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

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

  // OCR: E2d
  const patch: any = {
    license_photo_path: path,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('hr_vehicles').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ocr: null });
}
