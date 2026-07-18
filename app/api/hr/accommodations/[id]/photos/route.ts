// GET  /api/hr/accommodations/[id]/photos — zdjęcia stanu lokalu (signed URLs)
// POST — multipart: file (WSZYSTKIE formaty graficzne; HEIC z iPhone'a → auto-JPEG), caption?
// DELETE ?photo_id= — usunięcie (autor zdjęcia lub rola z agencja.delete)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { looksLikeImage, normalizeImage } from '@/lib/images';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // HEIC bywają większe od JPG

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin();
  const { data, error } = await (sb as any).from('hr_accommodation_photos').select('*').eq('accommodation_id', id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const photos = await Promise.all((data ?? []).map(async (p: any) => {
    const { data: s } = await sb.storage.from('accommodation-photos').createSignedUrl(p.path, 3600);
    return { id: p.id, url: s?.signedUrl ?? null, filename: p.filename, caption: p.caption, created_at: p.created_at, mine: p.uploaded_by === auth.id };
  }));
  return NextResponse.json({ photos, can_delete_all: await can(auth, 'agencja.delete') });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const sb = admin();
  const { data: acc } = await (sb as any).from('hr_accommodations').select('name').eq('id', id).single();
  if (!acc) return NextResponse.json({ error: 'Brak lokalu' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Zdjęcie za duże (max 25 MB)' }, { status: 400 });
  if (!looksLikeImage(file.type, file.name)) {
    return NextResponse.json({ error: `To nie jest plik graficzny (${file.type || 'brak typu'})` }, { status: 400 });
  }
  const caption = String(form?.get('caption') || '').trim().slice(0, 300) || null;

  // akceptuj każdy format graficzny; HEIC/HEIF (iPhone) → JPEG, by galeria go wyświetliła
  let img;
  try { img = await normalizeImage(Buffer.from(await file.arrayBuffer()), file.type, file.name); }
  catch { return NextResponse.json({ error: 'Nie udało się przetworzyć zdjęcia — spróbuj innym plikiem' }, { status: 400 }); }

  const baseName = (file.name || 'zdjecie').replace(/\.[^.]+$/, '').replace(/[^\w.\-() ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/g, '_').slice(0, 80);
  const safe = `${baseName}.${img.ext}`;
  const path = `${id}/${crypto.randomUUID()}-${safe}`;
  const up = await sb.storage.from('accommodation-photos').upload(path, img.buf, { contentType: img.contentType });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const { data: row, error } = await (sb as any).from('hr_accommodation_photos')
    .insert({ accommodation_id: id, path, filename: safe, caption, uploaded_by: isUuid(auth.id) ? auth.id : null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: s } = await sb.storage.from('accommodation-photos').createSignedUrl(path, 3600);
  return NextResponse.json({ id: row.id, url: s?.signedUrl ?? null, caption, created_at: row.created_at }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const photoId = new URL(request.url).searchParams.get('photo_id');
  if (!photoId) return NextResponse.json({ error: 'Brak zdjęcia' }, { status: 400 });
  const sb = admin();
  const { data: photo } = await (sb as any).from('hr_accommodation_photos').select('*').eq('id', photoId).eq('accommodation_id', id).single();
  if (!photo) return NextResponse.json({ error: 'Brak zdjęcia' }, { status: 404 });
  // usuwać może autor zdjęcia albo rola z prawem usuwania w Agencji
  if (photo.uploaded_by !== auth.id && !(await can(auth, 'agencja.delete'))) {
    return NextResponse.json({ error: 'Usunąć może autor zdjęcia lub administrator' }, { status: 403 });
  }
  await sb.storage.from('accommodation-photos').remove([photo.path]);
  const { error } = await (sb as any).from('hr_accommodation_photos').delete().eq('id', photoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
