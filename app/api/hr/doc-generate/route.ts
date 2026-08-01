// POST /api/hr/doc-generate — generuje PDF-y: pracownicy × szablony (max 6 par na wywołanie,
// UI wysyła partiami). Znaczniki {{...}} podstawiane danymi z kartoteki; braki → kropki + raport.
// PDF ląduje w teczce pracownika (bucket hr-documents + hr_documents) i wraca signed URL.
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/supabaseAdmin';
import { renderOfferPdfBatch } from '@/lib/pdf/renderer';
import { buildDocData, fillPlaceholders } from '@/lib/hr/docPlaceholders';
import { fillPeselForm, peselMissingFields } from '@/lib/hr/peselForm';
import { pelnomocnictwoFooter } from '@/lib/hr/docRules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PAIRS = 6;

// oficjalny pusty formularz PESEL (EL/W/1) — czytany z bundla (jak loga)
let peselBlankCache: Uint8Array | null = null;
async function peselBlank(): Promise<Uint8Array> {
  if (!peselBlankCache) peselBlankCache = new Uint8Array(await readFile(path.join(process.cwd(), 'public', 'templates', 'pesel-elw1.pdf')));
  return peselBlankCache;
}

const logoCache = new Map<string, string>();
async function logoDataUri(file: 'ebs-neon-no-bg.png'): Promise<string> {
  if (!logoCache.has(file)) {
    const buf = await readFile(path.join(process.cwd(), 'public', file));
    const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    logoCache.set(file, `data:${mime};base64,${buf.toString('base64')}`);
  }
  return logoCache.get(file)!;
}

// font Devanagari (hindi) — serverless Chromium go nie ma; wbudowujemy, by hindi się renderował
let devaFontCache: string | null = null;
async function devaFontFaceCss(): Promise<string> {
  if (devaFontCache == null) {
    try {
      const buf = await readFile(path.join(process.cwd(), 'public', 'fonts', 'noto-deva.woff2'));
      devaFontCache = `@font-face{font-family:'NotoDeva';src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');font-display:swap;}`;
    } catch { devaFontCache = ''; }
  }
  return devaFontCache;
}

function wrapDocument(body: string, letterhead: string | null, fontFaceCss = ''): string {
  // puste akapity na końcu potrafią zepchnąć treść na kolejną stronę
  const trimmed = body.replace(/(<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+$/g, '');

  // Papier firmowy ze stopką: dzielimy na sekcje-strony (po hr.page-break) i każdą
  // wkładamy w kontener o wysokości strony — stopka flexem dociśnięta do dołu.
  let content = trimmed;
  const footerMatch = trimmed.match(/<div class="doc-footer"[\s\S]*?<\/div>/);
  if (footerMatch) {
    const footer = footerMatch[0];
    const sections = trimmed.replace(footer, '').split(/<hr class="page-break"\s*\/?>/);
    content = sections.map(s => `<div class="page">${s}${footer}</div>`).join('');
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    ${fontFaceCss}
    @page { size: A4; margin: 13mm 17mm; }
    body { font-family: 'Times New Roman', Georgia, 'NotoDeva', serif; font-size: 11pt; color: #111; line-height: 1.32; }
    p { margin: 0 0 5px; }
    h1 { font-size: 13pt; margin: 10px 0 6px; }
    table { border-collapse: collapse; width: 100%; margin: 6px 0; }
    td, th { border: 1px solid #444; padding: 3px 6px; vertical-align: top; font-size: 10pt; }
    ol, ul { margin: 3px 0 6px 20px; }
    .letterhead { text-align: center; margin-bottom: 10px; }
    .letterhead img { height: 44px; }
    hr.page-break { break-after: page; page-break-after: always; border: none; height: 0; margin: 0; visibility: hidden; }
    .page { height: 269mm; display: flex; flex-direction: column; break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .doc-footer { margin-top: auto !important; font-size: 8.5pt !important; }
    .doc-footer p { margin: 0; }
    /* długie jednostronicowe dokumenty (np. umowy) — ciaśniej, by podpis nie spadał na kolejną stronę */
    .doc-compact { line-height: 1.16; }
    .doc-compact p { margin: 0 0 3px; }
    .doc-compact ol, .doc-compact ul { margin: 2px 0 4px 20px; }
    .doc-compact li { margin-bottom: 1px; }
  </style></head><body>
    ${letterhead ? `<div class="letterhead"><img src="${letterhead}" /></div>` : ''}
    ${content}
  </body></html>`;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.generator'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  const employeeIds: string[] = Array.isArray(b?.employee_ids) ? b.employee_ids : [];
  const templateIds: string[] = Array.isArray(b?.template_ids) ? b.template_ids : [];
  // data drukowana w dokumentach ({{dzis}}) — ustawiana w generatorze; brak → dzisiaj
  const docDate: string | null = typeof b?.doc_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.doc_date) ? b.doc_date : null;
  // miejscowość do pkt 8 (Podpisy) wniosku PESEL — ręczne pole generatora; puste = domyślne zachowanie (z adresu noclegu)
  const peselSignCity: string = typeof b?.pesel_sign_city === 'string' ? b.pesel_sign_city.trim().slice(0, 60) : '';
  if (!employeeIds.length || !templateIds.length) return NextResponse.json({ error: 'Wybierz pracowników i dokumenty' }, { status: 400 });
  if (employeeIds.length * templateIds.length > MAX_PAIRS) {
    return NextResponse.json({ error: `Za dużo dokumentów naraz (max ${MAX_PAIRS} na partię)` }, { status: 400 });
  }

  const sb = admin() as any;
  const [emps, tpls] = await Promise.all([
    sb.from('hr_employees').select('*, contract:hr_contracts(id, name, address), accommodation:hr_accommodations(id, name, address, street, house_no, apartment_no, postal_code, city, voivodeship, county, commune, post_office)').in('id', employeeIds),
    sb.from('hr_doc_templates').select('*').in('id', templateIds),
  ]);
  if (emps.error) return NextResponse.json({ error: emps.error.message }, { status: 500 });
  if (tpls.error) return NextResponse.json({ error: tpls.error.message }, { status: 500 });

  const results: any[] = [];
  const logoPng = await logoDataUri('ebs-neon-no-bg.png');
  const logoJpg = await logoDataUri('ebs-neon-no-bg.png');
  const fontCss = await devaFontFaceCss(); // font hindi wbudowany w każdy dokument

  // 1) zbuduj zadania: szablony HTML → Puppeteer; szablony 'acroform_pesel' → wypełnianie PDF
  const jobs: { emp: any; tpl: any; empName: string; missing: string[]; html?: string; footer?: string | null; acroform?: boolean }[] = [];
  for (const emp of emps.data ?? []) {
    // dzis_plus_miesiac liczony od daty DOKUMENTU (docDate), nie od dzisiaj — inaczej przy
    // datowaniu w przyszłość/przeszłość okres w umowie może wyjść z datą końcową wcześniejszą
    // niż początkowa (patrz test w docPlaceholders.test.ts)
    const data = buildDocData(emp, docDate, docDate ? new Date(docDate) : new Date());
    const empName = [emp.first_name, emp.second_name, emp.last_name, emp.second_last_name].filter(Boolean).join(' ');
    for (const tpl of tpls.data ?? []) {
      if (tpl.kind === 'acroform_pesel') {
        jobs.push({ emp, tpl, empName, missing: peselMissingFields(emp), acroform: true });
        continue;
      }
      const { html: filled, missing } = fillPlaceholders(tpl.content_html || '', data);
      const letterhead = tpl.has_letterhead ? logoPng : null;
      // loga wstawione bezpośrednio w treści szablonu zamieniamy na data URI (Puppeteer offline)
      let bodyHtml = filled
        .replaceAll('src="/ebs-neon-no-bg.png"', `src="${logoPng}"`)
        .replaceAll('src="/ebs-neon-no-bg.png"', `src="${logoJpg}"`);
      // logo powtarzamy na każdej stronie po podziale (jak nagłówek w oryginale WORD)
      if (letterhead) bodyHtml = bodyHtml.replace(/<hr class="page-break"\s*\/?>/g, `<hr class="page-break" /><div class="letterhead"><img src="${letterhead}" /></div>`);
      // pełnomocnictwa dostają stopkę: nazwa + numeracja stron
      jobs.push({ emp, tpl, empName, missing, html: wrapDocument(bodyHtml, letterhead, fontCss), footer: pelnomocnictwoFooter(tpl.name) });
    }
  }

  // 2) render: HTML w JEDNEJ przeglądarce (unik timeoutu), formularze PESEL wypełniane pdf-lib
  const pdfs: (Buffer | undefined)[] = new Array(jobs.length);
  const htmlIdx = jobs.map((j, i) => ({ j, i })).filter(x => !x.j.acroform);
  if (htmlIdx.length) {
    let htmlPdfs: Buffer[];
    try {
      htmlPdfs = await renderOfferPdfBatch(htmlIdx.map(x => ({ html: x.j.html!, footer: x.j.footer ?? null })));
    } catch (e: any) {
      return NextResponse.json({ error: `Render PDF nie powiódł się: ${e?.message || e}` }, { status: 500 });
    }
    htmlIdx.forEach((x, k) => { pdfs[x.i] = htmlPdfs[k]; });
  }
  if (jobs.some(j => j.acroform)) {
    try {
      const blank = await peselBlank();
      for (let i = 0; i < jobs.length; i++) {
        if (jobs[i].acroform) pdfs[i] = Buffer.from(await fillPeselForm(blank, jobs[i].emp, docDate, peselSignCity ? { signCity: peselSignCity } : undefined));
      }
    } catch (e: any) {
      return NextResponse.json({ error: `Wypełnianie wniosku PESEL nie powiodło się: ${e?.message || e}` }, { status: 500 });
    }
  }

  // 3) wgraj i zapisz w teczkach
  for (let i = 0; i < jobs.length; i++) {
    const { emp, tpl, empName, missing } = jobs[i];
    try {
      const pdf = pdfs[i];
      if (!pdf) throw new Error('brak wyniku renderowania');
      const slug = tpl.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 50);
      const storagePath = `${emp.id}/gen-${crypto.randomUUID()}-${slug}.pdf`;
      const up = await sb.storage.from('hr-documents').upload(storagePath, pdf, { contentType: 'application/pdf' });
      if (up.error) throw new Error(up.error.message);
      await sb.from('hr_documents').insert({
        employee_id: emp.id,
        filename: `${tpl.name} — ${empName}.pdf`,
        path: storagePath,
        content_type: 'application/pdf',
        size: pdf.length,
        uploaded_by: auth.id,
      });
      const { data: signed } = await sb.storage.from('hr-documents').createSignedUrl(storagePath, 3600);
      results.push({ employee_id: emp.id, employee_name: empName, template_id: tpl.id, template_name: tpl.name, url: signed?.signedUrl ?? null, missing, ok: true });
    } catch (e: any) {
      results.push({ employee_id: emp.id, employee_name: empName, template_id: tpl.id, template_name: tpl.name, ok: false, error: e?.message || 'Błąd generowania' });
    }
  }
  return NextResponse.json({ results });
}
