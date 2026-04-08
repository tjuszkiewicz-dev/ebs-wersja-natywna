import { supabaseServer } from '@/lib/supabase';

export const ISSUER = {
  name:    process.env.ISSUER_NAME    ?? 'Stratton Prime sp. z o.o.',
  nip:     process.env.ISSUER_NIP     ?? '5842867357',
  krs:     process.env.ISSUER_KRS     ?? '0001169520',
  regon:   process.env.ISSUER_REGON   ?? '541537557',
  address: process.env.ISSUER_ADDRESS ?? 'ul. Junony 23/11, 80-299 Gdańsk',
  bank:    process.env.ISSUER_BANK    ?? 'PL00 0000 0000 0000 0000 0000 0000',
  email:   process.env.ISSUER_EMAIL   ?? 'faktury@strattonprime.pl',
};

/** Wysyła HTML do PDF-serwera (Puppeteer), zwraca Buffer lub null jeśli serwer niedostępny */
export async function generatePdfBuffer(html: string, pdfOptions?: Record<string, unknown>): Promise<Buffer | null> {
  try {
    const serverUrl = process.env.PDF_SERVER_URL ?? 'http://localhost:3012';
    const body: Record<string, unknown> = { html };
    if (pdfOptions) body.pdfOptions = pdfOptions;
    const res = await fetch(`${serverUrl}/api/generate-pdf-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch {
    return null;
  }
}

/** Zapisuje buffer PDF w Supabase Storage i zwraca podpisany URL (ważny 10 lat) */
export async function uploadPdf(
  supabase: ReturnType<typeof supabaseServer>,
  fileName: string,
  buffer: Buffer
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('financial-documents')
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error || !data) return null;

  const { data: signedData, error: signErr } = await supabase.storage
    .from('financial-documents')
    .createSignedUrl(data.path, 315_360_000);

  if (signErr || !signedData?.signedUrl) return null;
  return signedData.signedUrl;
}
