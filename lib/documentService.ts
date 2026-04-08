/**
 * Serwis generowania dokumentów księgowych (nota obciążeniowa + faktura VAT).
 * Generuje HTML → PDF przez Puppeteer (server/app.js) lub SVG-free inline HTML.
 * Zapisuje PDF w Supabase Storage bucket "financial-documents".
 * 
 * Podstawy prawne:
 *  - Nota obciążeniowa (debetowa): brak podstawy VAT przy emisji MPV
 *    (art. 8b ust. 1 Ustawy o VAT — podatek rozliczany przy realizacji)
 *  - Faktura VAT za obsługę: usługa opodatkowana 23% VAT (art. 5 ust. 1 UoVAT)
 */

import { supabaseServer } from '@/lib/supabase';
import { FINANCIAL_CONSTANTS, calculateOrderTotals } from '@/utils/financialMath';
import { ISSUER, generatePdfBuffer, uploadPdf } from '@/lib/documents/pdfUtils';

// Re-export umowa service for backward compatibility
export type { UmowaContext } from '@/lib/documents/umowaService';
export { createUmowaDocument } from '@/lib/documents/umowaService';

export interface DocumentContext {
  orderId: string;
  companyId: string;
  companyName: string;
  companyNip: string;
  companyAddress: string;
  voucherAmount: number;   // kwota emisji voucherów (nota)
  feeNet: number;          // netto opłaty serwisowej (faktura)
  feeVat: number;          // VAT od opłaty
  feeGross: number;        // brutto opłaty
  issuedAt: string;        // ISO date
  docNotaNumber: string;   // np. NK/2026/04/0001
  docFakturaNumber: string; // np. FV/2026/04/0001
  distributionSummary: string; // np. "Emisja 800 voucherów dla 8 pracowników"
}

/** Generuje HTML dla noty obciążeniowej (emisja voucherów, VAT 0%) */
function buildNotaHtml(ctx: DocumentContext): string {
  const fmt = (n: number) => n.toFixed(2).replace('.', ',') + ' zł';
  const date = new Date(ctx.issuedAt).toLocaleDateString('pl-PL');
  const dueDate = new Date(new Date(ctx.issuedAt).getTime() + 14 * 86400000).toLocaleDateString('pl-PL');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 32px; }
  .logo { font-size: 20px; font-weight: 900; color: #1e3a5f; margin-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .doc-title { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; }
  .doc-number { font-size: 13px; color: #6b7280; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
  .card-title { font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
  .card p { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #1e3a5f; color: #fff; padding: 8px 10px; font-size: 10px; text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
  .tr-total td { font-weight: 700; background: #f9fafb; border-top: 2px solid #1e3a5f; }
  .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
  .legal { margin-top: 20px; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 9.5px; color: #6b7280; line-height: 1.5; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">STRATTON PRIME</div>
    <p style="color:#6b7280;font-size:10px">${ISSUER.name}</p>
    <p style="color:#6b7280;font-size:10px">NIP: ${ISSUER.nip} | KRS: ${ISSUER.krs} | REGON: ${ISSUER.regon}</p>
    <p style="color:#6b7280;font-size:10px">${ISSUER.address}</p>
  </div>
  <div style="text-align:right">
    <div class="doc-title">NOTA OBCIĄŻENIOWA</div>
    <div class="doc-number">${ctx.docNotaNumber}</div>
    <p style="color:#6b7280;margin-top:4px">Data wystawienia: ${date}</p>
    <p style="color:#6b7280">Termin płatności: ${dueDate}</p>
  </div>
</div>

<div class="grid2">
  <div class="card">
    <div class="card-title">Wystawca</div>
    <p><strong>${ISSUER.name}</strong></p>
    <p>NIP: ${ISSUER.nip} | KRS: ${ISSUER.krs}</p>
    <p>REGON: ${ISSUER.regon}</p>
    <p>${ISSUER.address}</p>
    <p>E-mail: ${ISSUER.email}</p>
  </div>
  <div class="card">
    <div class="card-title">Nabywca</div>
    <p><strong>${ctx.companyName}</strong></p>
    <p>NIP: ${ctx.companyNip}</p>
    <p>${ctx.companyAddress || '—'}</p>
  </div>
</div>

<p style="margin-bottom:8px;font-size:10px;color:#6b7280">
  Zamówienie: <strong>${ctx.orderId}</strong> &nbsp;|&nbsp; ${ctx.distributionSummary}
</p>

<table>
  <thead>
    <tr>
      <th>Lp.</th>
      <th>Opis</th>
      <th>Podstawa prawna</th>
      <th style="text-align:right">Kwota</th>
      <th style="text-align:center">VAT</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Emisja voucherów wielofunkcyjnych (MPV) — ${ctx.distributionSummary}</td>
      <td><span class="badge">art. 8b UoVAT</span></td>
      <td style="text-align:right;font-weight:600">${fmt(ctx.voucherAmount)}</td>
      <td style="text-align:center">0% (MPV)</td>
    </tr>
  </tbody>
  <tfoot>
    <tr class="tr-total">
      <td colspan="3"><strong>DO ZAPŁATY</strong></td>
      <td style="text-align:right">${fmt(ctx.voucherAmount)}</td>
      <td style="text-align:center">VAT 0%</td>
    </tr>
  </tfoot>
</table>

<p style="font-size:10px;color:#374151;margin-bottom:4px">
  <strong>Numer konta:</strong> ${ISSUER.bank}
</p>
<p style="font-size:10px;color:#374151">
  <strong>Tytuł przelewu:</strong> ${ctx.docNotaNumber} / ${ctx.companyNip}
</p>

<div class="legal">
  <strong>Podstawa prawna VAT 0% przy emisji MPV:</strong>
  Voucher wielofunkcyjny (Multi-Purpose Voucher) zgodny z art. 8b ust. 1 Ustawy z dnia 11 marca 2004 r.
  o podatku od towarów i usług (Dz.U. 2004 nr 54 poz. 535 ze zm.) wdrażającej Dyrektywę UE 2016/1065.
  VAT jest rozliczany przez podmiot realizujący voucher w momencie jego realizacji.
  Nota obciążeniowa nie jest fakturą VAT.
</div>

<div class="footer">
  Dokument wygenerowany automatycznie przez system EBS — Stratton Prime sp. z o.o. |
  NIP: ${ISSUER.nip} | KRS: ${ISSUER.krs} | ${date} | ${ctx.docNotaNumber}
</div>
</body>
</html>`;
}

/** Generuje HTML dla faktury VAT za obsługę serwisową (23% VAT) */
function buildFakturaHtml(ctx: DocumentContext): string {
  const fmt = (n: number) => n.toFixed(2).replace('.', ',') + ' zł';
  const date = new Date(ctx.issuedAt).toLocaleDateString('pl-PL');
  const dueDate = new Date(new Date(ctx.issuedAt).getTime() + 14 * 86400000).toLocaleDateString('pl-PL');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 32px; }
  .logo { font-size: 20px; font-weight: 900; color: #1e3a5f; margin-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .doc-title { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; }
  .doc-number { font-size: 13px; color: #6b7280; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
  .card-title { font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
  .card p { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #1e3a5f; color: #fff; padding: 8px 10px; font-size: 10px; text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
  .tr-total td { font-weight: 700; background: #f9fafb; }
  .tr-grand td { font-weight: 700; background: #1e3a5f; color: #fff; font-size: 13px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">STRATTON PRIME</div>
    <p style="color:#6b7280;font-size:10px">${ISSUER.name}</p>
    <p style="color:#6b7280;font-size:10px">NIP: ${ISSUER.nip} | KRS: ${ISSUER.krs} | REGON: ${ISSUER.regon}</p>
    <p style="color:#6b7280;font-size:10px">${ISSUER.address}</p>
  </div>
  <div style="text-align:right">
    <div class="doc-title">FAKTURA VAT</div>
    <div class="doc-number">${ctx.docFakturaNumber}</div>
    <p style="color:#6b7280;margin-top:4px">Data wystawienia: ${date}</p>
    <p style="color:#6b7280">Termin płatności: ${dueDate}</p>
  </div>
</div>

<div class="grid2">
  <div class="card">
    <div class="card-title">Sprzedawca</div>
    <p><strong>${ISSUER.name}</strong></p>
    <p>NIP: ${ISSUER.nip} | KRS: ${ISSUER.krs}</p>
    <p>REGON: ${ISSUER.regon}</p>
    <p>${ISSUER.address}</p>
    <p>E-mail: ${ISSUER.email}</p>
  </div>
  <div class="card">
    <div class="card-title">Nabywca</div>
    <p><strong>${ctx.companyName}</strong></p>
    <p>NIP: ${ctx.companyNip}</p>
    <p>${ctx.companyAddress || '—'}</p>
  </div>
</div>

<p style="margin-bottom:8px;font-size:10px;color:#6b7280">
  Zamówienie: <strong>${ctx.orderId}</strong> &nbsp;|&nbsp; ${ctx.distributionSummary}
</p>

<table>
  <thead>
    <tr>
      <th>Lp.</th>
      <th>Opis</th>
      <th style="text-align:right">Netto</th>
      <th style="text-align:right">VAT 23%</th>
      <th style="text-align:right">Brutto</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Obsługa serwisowa — udostępnienie i dystrybucja voucherów pracownikom (${ctx.distributionSummary})</td>
      <td style="text-align:right">${fmt(ctx.feeNet)}</td>
      <td style="text-align:right">${fmt(ctx.feeVat)}</td>
      <td style="text-align:right;font-weight:600">${fmt(ctx.feeGross)}</td>
    </tr>
  </tbody>
  <tfoot>
    <tr class="tr-total">
      <td colspan="2"><strong>Razem netto</strong></td>
      <td style="text-align:right">${fmt(ctx.feeNet)}</td>
      <td style="text-align:right">${fmt(ctx.feeVat)}</td>
      <td style="text-align:right">${fmt(ctx.feeGross)}</td>
    </tr>
    <tr class="tr-grand">
      <td colspan="4"><strong>DO ZAPŁATY BRUTTO</strong></td>
      <td style="text-align:right">${fmt(ctx.feeGross)}</td>
    </tr>
  </tfoot>
</table>

<p style="font-size:10px;color:#374151;margin-bottom:4px">
  <strong>Numer konta:</strong> ${ISSUER.bank}
</p>
<p style="font-size:10px;color:#374151">
  <strong>Tytuł przelewu:</strong> ${ctx.docFakturaNumber} / ${ctx.companyNip}
</p>

<div class="footer">
  Dokument wygenerowany automatycznie przez system EBS — Stratton Prime sp. z o.o. |
  NIP: ${ISSUER.nip} | KRS: ${ISSUER.krs} | ${date} | ${ctx.docFakturaNumber}
</div>
</body>
</html>`;
}

/**
 * Tworzy nota + faktura_vat w tabeli financial_documents,
 * generuje PDFy i zapisuje je w Supabase Storage.
 * Wywoływane z hr-confirm endpoint po potwierdzeniu zamówienia.
 */
export async function createOrderDocuments(ctx: DocumentContext): Promise<{
  notaId: string;
  fakturaId: string;
  notaPdfUrl: string | null;
  fakturaPdfUrl: string | null;
}> {
  const supabase = supabaseServer();
  const now = ctx.issuedAt;

  // 1. Generuj HTML
  const notaHtml = buildNotaHtml(ctx);
  const fakturaHtml = buildFakturaHtml(ctx);

  // 2. Generuj PDFy (opcjonalne — jeśli serwer dostępny)
  const [notaBuf, fakturaBuf] = await Promise.all([
    generatePdfBuffer(notaHtml),
    generatePdfBuffer(fakturaHtml),
  ]);

  // 3. Upload do Storage
  const safeOrderId = ctx.orderId.slice(-8).toUpperCase();
  const dateSlug = new Date(now).toISOString().slice(0, 10);

  const [notaPdfUrl, fakturaPdfUrl] = await Promise.all([
    notaBuf
      ? uploadPdf(supabase, `nota/${dateSlug}_${safeOrderId}.pdf`, notaBuf)
      : null,
    fakturaBuf
      ? uploadPdf(supabase, `faktura/${dateSlug}_${safeOrderId}.pdf`, fakturaBuf)
      : null,
  ]);

  // 4. Zapis w financial_documents — nota
  // Używamy insert (nie upsert) — hr-confirm może się wykonać tylko raz na zamówienie
  // (status zmienia się na 'approved', kolejne wywołanie zwraca 409).
  // Częściowy unique index (WHERE linked_order_id IS NOT NULL) nie jest kompatybilny
  // z ON CONFLICT (col1, col2) w PostgreSQL bez klauzuli WHERE.
  const { data: notaRow, error: notaErr } = await supabase
    .from('financial_documents')
    .insert({
      company_id:      ctx.companyId,
      linked_order_id: ctx.orderId,
      type:            'nota',
      document_number: ctx.docNotaNumber,
      amount_net:      ctx.voucherAmount,
      vat_amount:      0,
      amount_gross:    ctx.voucherAmount,
      status:          'pending',
      issued_at:       now,
      pdf_url:         notaPdfUrl ?? null,
      updated_at:      now,
    })
    .select('id')
    .single();

  if (notaErr || !notaRow) throw new Error(`Błąd zapisu noty: ${notaErr?.message}`);

  // 5. Zapis w financial_documents — faktura_vat
  const { data: fakturaRow, error: fakturaErr } = await supabase
    .from('financial_documents')
    .insert({
      company_id:      ctx.companyId,
      linked_order_id: ctx.orderId,
      type:            'faktura_vat',
      document_number: ctx.docFakturaNumber,
      amount_net:      ctx.feeNet,
      vat_amount:      ctx.feeVat,
      amount_gross:    ctx.feeGross,
      status:          'pending',
      issued_at:       now,
      pdf_url:         fakturaPdfUrl ?? null,
      updated_at:      now,
    })
    .select('id')
    .single();

  if (fakturaErr || !fakturaRow) throw new Error(`Błąd zapisu faktury: ${fakturaErr?.message}`);

  return {
    notaId:       notaRow.id,
    fakturaId:    fakturaRow.id,
    notaPdfUrl,
    fakturaPdfUrl,
  };
}

