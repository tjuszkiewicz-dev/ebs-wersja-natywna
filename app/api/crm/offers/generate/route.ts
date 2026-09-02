// POST /api/crm/offers/generate
// Body: { firma, pracownicyCount, provisionPct, podsumowanie, leadId? }
//  1. Renderuje HTML oferty (`lib/crm/offer/offerTemplate`)
//  2. HTML → PDF (`lib/pdf/renderer`)
//  3. PDF → Storage (bucket `crm-offers`)
//  4. Rekord w `crm_offers` + podpisany link
//
// Port z BBS-Unified (E7c). Adaptacje:
//  - PDF renderuje **`lib/pdf/renderer.ts` (EBS)**, nie CRM-owy `lib/crm/offer/pdfRenderer.ts`
//    — decyzja ze specu E7; oba pliki miały identyczny kontrakt `renderOfferPdf(html)`,
//    więc port sprowadza się do zmiany importu.
//  - bucket `offers` → `crm-offers` (nazwa z migracji 054).
//  - logo: `public/ebs-neon-no-bg.png` (49 KB) wczytywane wprost. BBS przepuszczał
//    swoje 4,5 MB logo przez `sharp`; EBS nie ma tej zależności i nie potrzebuje jej,
//    bo plik jest już mały. Brak pliku → oferta renderuje się z tekstowym „EBS".
//  - bramka: `can(auth, 'crm.kalkulator')` zamiast listy ról zaszytej w kodzie.
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';
import { renderOfferHtml, type OfferData } from '@/lib/crm/offer/offerTemplate';
import { renderOfferPdf } from '@/lib/pdf/renderer';

// Vercel: Chromium potrzebuje więcej czasu niż domyślne 10 s
export const runtime = 'nodejs';
export const maxDuration = 60;

let cachedLogo: string | null = null;
async function readLogoDataUri(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'ebs-neon-no-bg.png'));
    cachedLogo = `data:image/png;base64,${buf.toString('base64')}`;
    return cachedLogo;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.kalkulator'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { firma, pracownicyCount, provisionPct, podsumowanie, leadId } = body ?? {};

  if (!firma?.nazwa || typeof pracownicyCount !== 'number' || !podsumowanie) {
    return NextResponse.json({ error: 'Niekompletne dane oferty' }, { status: 400 });
  }

  const sb = admin() as any;

  const { data: profile } = await sb
    .from('user_profiles')
    .select('full_name')
    .eq('id', auth.id)
    .single();

  const advisorName = profile?.full_name ?? auth.email ?? 'Doradca Eliton Benefits';
  const logoDataUri = await readLogoDataUri();

  const offerData: OfferData = {
    firma,
    pracownicyCount,
    provisionPct: Number(provisionPct) || 0,
    podsumowanie,
    advisor: { name: advisorName, email: auth.email ?? undefined },
    logoDataUri: logoDataUri ?? undefined,
  };

  const html = renderOfferHtml(offerData);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderOfferPdf(html);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Nieznany błąd';
    return NextResponse.json(
      { error: `Generowanie PDF nie powiodło się: ${msg}` },
      { status: 500 }
    );
  }

  const slug =
    (firma.nazwa as string)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // znaki diakrytyczne rozbite przez NFD
      // (BBS trzymał tu te znaki DOSŁOWNIE w źródle — łatwo je zgubić przy kopiowaniu)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'oferta';
  const ts = Date.now();
  const path = `oferty/${slug}-${ts}.pdf`;

  const { error: uploadErr } = await sb.storage
    .from('crm-offers')
    .upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: `Błąd zapisu pliku: ${uploadErr.message}` }, { status: 500 });
  }

  const { data: signed, error: signErr } = await sb.storage
    .from('crm-offers')
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 rok

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Nie udało się wygenerować linku' }, { status: 500 });
  }

  const { data: offerRow, error: insertErr } = await sb
    .from('crm_offers')
    .insert({
      lead_id:               leadId ?? null,
      created_by:            auth.id,
      company_name:          firma.nazwa,
      company_nip:           firma.nip ?? null,
      employees_count:       pracownicyCount,
      provision_pct:         offerData.provisionPct,
      total_savings_monthly: podsumowanie.oszczednoscBrutto,
      total_savings_yearly:  podsumowanie.oszczednoscRoczna,
      net_savings_monthly:   podsumowanie.oszczednoscNetto,
      pdf_url:               signed.signedUrl,
      pdf_path:              path,
      snapshot:              offerData,
    })
    .select('id, created_at, pdf_url')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id:        offerRow.id,
      pdfUrl:    offerRow.pdf_url,
      createdAt: offerRow.created_at,
      fileName:  `oferta-${slug}-${ts}.pdf`,
    },
    { status: 201 }
  );
}
