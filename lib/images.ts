// Normalizacja przesyłanych obrazów: akceptuje WSZYSTKIE popularne formaty graficzne,
// a formaty, których przeglądarki nie wyświetlają (HEIC/HEIF z iPhone'a) konwertuje
// serwerowo do JPEG. Dzięki temu galeria (zdjęcia lokali/pojazdów) pokazuje każde zdjęcie.

// Rozpoznanie „to jest obraz": po content-type image/* albo po rozszerzeniu nazwy.
const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|svg)$/i;
export function looksLikeImage(contentType?: string | null, filename?: string | null): boolean {
  const ct = (contentType || '').toLowerCase();
  if (ct.startsWith('image/')) return true;
  // telefony często wysyłają HEIC jako application/octet-stream — sprawdź rozszerzenie
  if ((!ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream') && filename && IMG_EXT.test(filename)) return true;
  return false;
}

const isHeic = (ct: string, filename?: string | null) =>
  /heic|heif/.test(ct) || /\.(heic|heif)$/i.test(filename || '');

export interface NormalizedImage { buf: Buffer; contentType: string; ext: string }

// zwraca gotowy do zapisu bufor + typ + rozszerzenie; HEIC/HEIF → JPEG
export async function normalizeImage(buf: Buffer, contentType?: string | null, filename?: string | null): Promise<NormalizedImage> {
  const ct = (contentType || '').toLowerCase();
  if (isHeic(ct, filename)) {
    const convert = (await import('heic-convert')).default as any;
    const out: ArrayBuffer = await convert({ buffer: buf, format: 'JPEG', quality: 0.9 });
    return { buf: Buffer.from(out), contentType: 'image/jpeg', ext: 'jpg' };
  }
  // pozostałe formaty zapisujemy bez zmian
  const extFromName = (filename?.match(IMG_EXT)?.[1] || '').toLowerCase();
  const ext = extFromName
    || (ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif'
      : ct.includes('bmp') ? 'bmp' : ct.includes('tif') ? 'tiff' : ct.includes('avif') ? 'avif'
      : ct.includes('svg') ? 'svg' : 'jpg');
  return { buf, contentType: ct.startsWith('image/') ? ct : `image/${ext === 'jpg' ? 'jpeg' : ext}`, ext };
}
