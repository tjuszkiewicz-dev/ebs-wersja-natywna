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

// ── Helper: kwota słownie (format polski) ────────────────────────────────────
function kwotaSlownie(amount: number): string {
  const ones  = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
  const teens = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście',
                 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
  const tenths = ['', 'dziesięć', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt',
                  'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
  const hunds  = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset',
                  'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];

  function chunk(n: number): string {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const r = n % 100;
    let mid = '';
    if (r >= 10 && r <= 19) {
      mid = teens[r - 10];
    } else {
      const t = Math.floor(r / 10);
      const o = r % 10;
      mid = [tenths[t], ones[o]].filter(Boolean).join(' ');
    }
    return [hunds[h], mid].filter(Boolean).join(' ');
  }

  function decl(n: number, forms: [string, string, string]): string {
    if (n === 1) return forms[0];
    const m100 = Math.abs(n) % 100;
    const m10  = Math.abs(n) % 10;
    if (m100 >= 12 && m100 <= 14) return forms[2];
    if (m10 >= 2 && m10 <= 4)     return forms[1];
    return forms[2];
  }

  const totalCents = Math.round(amount * 100);
  const int = Math.floor(totalCents / 100);
  const gr  = totalCents % 100;
  if (int === 0) return `zero złotych ${gr}/100 PLN`;

  const mil = Math.floor(int / 1_000_000);
  const tys = Math.floor((int % 1_000_000) / 1_000);
  const rem = int % 1_000;

  const parts: string[] = [];
  if (mil > 0) parts.push(`${chunk(mil)} ${decl(mil, ['milion', 'miliony', 'milionów'])}`);
  if (tys > 0) parts.push(`${chunk(tys)} ${decl(tys, ['tysiąc', 'tysiące', 'tysięcy'])}`);
  if (rem > 0) parts.push(chunk(rem));

  const plnWord = decl(int, ['złoty', 'złote', 'złotych']);
  return `${parts.join(' ')} ${plnWord} ${gr}/100 PLN`;
}

// ── Układ liczby z separatorem tysięcy ───────────────────────────────────────
function fmtPl(n: number): string {
  const [intPart, decPart] = n.toFixed(2).split('.');
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${decPart}`;
}

/** Generuje HTML dokumentu księgowego według polskiego układu faktury (nota lub FV) */
export function buildPolishInvoiceHtml(ctx: DocumentContext, type: 'nota' | 'faktura_vat'): string {
  const isNota    = type === 'nota';
  const docNumber = isNota ? ctx.docNotaNumber : ctx.docFakturaNumber;
  const docTitle  = isNota ? 'Nota Obciążeniowa' : 'Faktura VAT';
  const date      = new Date(ctx.issuedAt).toLocaleDateString('pl-PL');
  const dueDate   = new Date(new Date(ctx.issuedAt).getTime() + 14 * 86_400_000).toLocaleDateString('pl-PL');

  // Miasto z adresu wystawcy: "ul. Junony 23/11, 80-299 Gdańsk" → "Gdańsk"
  const city = ISSUER.address.split(',').pop()?.trim().replace(/^\d{2}-\d{3}\s+/, '') ?? 'Gdańsk';

  const amountGross = isNota ? ctx.voucherAmount : ctx.feeGross;
  const amountNet   = isNota ? ctx.voucherAmount : ctx.feeNet;
  const vatAmount   = isNota ? 0                 : ctx.feeVat;
  const vatRate     = isNota ? '0%'              : '23%';
  const ilosc       = isNota ? Math.round(ctx.voucherAmount) : 1;
  const cenaJedn    = isNota ? 1                 : ctx.feeNet;
  const opis        = isNota
    ? 'Emisja elektronicznych voucherów wielofunkcyjnych (MPV)'
    : 'Obsługa serwisowa — udostępnienie i dystrybucja voucherów pracownikom';

  // QR code: numer dokumentu + kwota (zewnętrzne API, Puppeteer może pobrać)
  const qrData = encodeURIComponent(`${docNumber}|${fmtPl(amountGross)} PLN|${ISSUER.bank}`);
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${qrData}`;

  const slownie = kwotaSlownie(amountGross);

  // Style pomocnicze dla komórek tabeli głównej
  const th = (extra = '') =>
    `style="border:1px solid #ccc;padding:5px 7px;background:#f5f5f5;font-weight:700;font-size:10px;white-space:nowrap;${extra}"`;
  const td = (extra = '') =>
    `style="border:1px solid #ccc;padding:5px 7px;font-size:10px;${extra}"`;
  const tds = (extra = '') =>
    `style="border:1px solid #ccc;padding:4px 7px;font-size:9.5px;background:#fafafa;${extra}"`;
  const tdt = (extra = '') =>
    `style="border:1px solid #ccc;padding:5px 7px;font-size:10px;font-weight:700;background:#f0f0f0;${extra}"`;

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"/><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 28px 36px; line-height: 1.4; }
  p.f { margin-bottom: 2px; font-size: 10.5px; }
</style></head><body>

<!-- ── GÓRA: kod QR (lewo) + tabela informacyjna (prawo) ── -->
<table style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr>
  <td style="vertical-align:top;width:120px;padding-right:12px">
    <img src="${qrUrl}" width="110" height="110" alt="" onerror="this.style.visibility='hidden'"/>
  </td>
  <td style="vertical-align:top;width:auto"></td>
  <td style="vertical-align:top">
    <table style="border-collapse:collapse;float:right;min-width:190px">
      <tr><td style="border:1px solid #bbb;background:#f5f5f5;padding:4px 20px;text-align:center;font-size:9px;color:#555">Miejsce wystawienia</td></tr>
      <tr><td style="border:1px solid #bbb;padding:4px 20px;text-align:center;font-weight:700">${city}</td></tr>
      <tr><td style="border:1px solid #bbb;background:#f5f5f5;padding:4px 20px;text-align:center;font-size:9px;color:#555">Data wystawienia</td></tr>
      <tr><td style="border:1px solid #bbb;padding:4px 20px;text-align:center;font-weight:700">${date}</td></tr>
      <tr><td style="border:1px solid #bbb;background:#f5f5f5;padding:4px 20px;text-align:center;font-size:9px;color:#555">Data sprzedaży</td></tr>
      <tr><td style="border:1px solid #bbb;padding:4px 20px;text-align:center;font-weight:700">${date}</td></tr>
    </table>
  </td>
</tr></table>

<!-- ── STRONY: Sprzedawca | Nabywca ── -->
<table style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr>
  <td style="width:50%;border:1px solid #bbb;padding:10px 14px;vertical-align:top">
    <div style="font-weight:700;font-size:10px;text-align:center;background:#f5f5f5;padding:5px;border-bottom:1px solid #bbb;margin:-10px -14px 9px">Sprzedawca</div>
    <p class="f"><strong>${ISSUER.name}</strong></p>
    <p class="f">NIP: ${ISSUER.nip}</p>
    <p class="f">KRS: ${ISSUER.krs} | REGON: ${ISSUER.regon}</p>
    <p class="f">${ISSUER.address}</p>
    <p class="f">E-mail: ${ISSUER.email}</p>
  </td>
  <td style="width:50%;border:1px solid #bbb;padding:10px 14px;vertical-align:top">
    <div style="font-weight:700;font-size:10px;text-align:center;background:#f5f5f5;padding:5px;border-bottom:1px solid #bbb;margin:-10px -14px 9px">Nabywca</div>
    <p class="f"><strong>${ctx.companyName}</strong></p>
    <p class="f">NIP: ${ctx.companyNip}</p>
    <p class="f">${ctx.companyAddress || ''}</p>
  </td>
</tr></table>

<!-- ── TYTUŁ DOKUMENTU ── -->
<div style="text-align:center;font-size:14px;font-weight:700;margin:14px 0 12px">${docTitle} ${docNumber}</div>

<!-- ── TABELA POZYCJI ── -->
<table style="width:100%;border-collapse:collapse;margin-bottom:14px">
  <thead><tr>
    <th ${th('width:26px;text-align:center')}>Lp.</th>
    <th ${th()}>Nazwa towaru lub usługi</th>
    <th ${th('text-align:center')}>Jm.</th>
    <th ${th('text-align:right')}>Ilość</th>
    <th ${th('text-align:right')}>Cena netto</th>
    <th ${th('text-align:right')}>Wartość netto</th>
    <th ${th('text-align:right')}>Stawka VAT</th>
    <th ${th('text-align:right')}>Kwota VAT</th>
    <th ${th('text-align:right')}>Wartość brutto</th>
  </tr></thead>
  <tbody>
    <tr>
      <td ${td('text-align:center')}>1</td>
      <td ${td()}>${opis}</td>
      <td ${td('text-align:center')}>szt.</td>
      <td ${td('text-align:right')}>${ilosc}</td>
      <td ${td('text-align:right')}>${fmtPl(cenaJedn)}</td>
      <td ${td('text-align:right')}>${fmtPl(amountNet)}</td>
      <td ${td('text-align:right')}>${vatRate}</td>
      <td ${td('text-align:right')}>${fmtPl(vatAmount)}</td>
      <td ${td('text-align:right;font-weight:600')}>${fmtPl(amountGross)}</td>
    </tr>
    <tr>
      <td colspan="5" ${tds('text-align:right')}>W tym</td>
      <td ${tds('text-align:right')}>${fmtPl(amountNet)}</td>
      <td ${tds('text-align:right')}>${vatRate}</td>
      <td ${tds('text-align:right')}>${fmtPl(vatAmount)}</td>
      <td ${tds('text-align:right')}>${fmtPl(amountGross)}</td>
    </tr>
    <tr>
      <td colspan="5" ${tdt('text-align:right')}>Razem</td>
      <td ${tdt('text-align:right')}>${fmtPl(amountNet)}</td>
      <td ${tdt()}></td>
      <td ${tdt('text-align:right')}>${fmtPl(vatAmount)}</td>
      <td ${tdt('text-align:right')}>${fmtPl(amountGross)}</td>
    </tr>
  </tbody>
</table>

<!-- ── PŁATNOŚĆ: dane (lewo) | kwota do zapłaty (prawo) ── -->
<table style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr>
  <td style="width:50%;border:1px solid #bbb;padding:10px 14px;vertical-align:top">
    <p class="f"><span style="color:#555">Sposób płatności:</span> przelew</p>
    <p style="margin-top:5px;margin-bottom:2px;font-size:10.5px"><span style="color:#555">Numer konta:</span></p>
    <p class="f" style="font-family:monospace;font-size:10px;letter-spacing:0.03em">${ISSUER.bank}</p>
    <p style="margin-top:5px" class="f"><span style="color:#555">Tytuł przelewu:</span> ${docNumber} / ${ctx.companyNip}</p>
    <p class="f"><span style="color:#555">Termin płatności:</span> ${dueDate}</p>
  </td>
  <td style="width:50%;border:1px solid #bbb;padding:10px 14px;vertical-align:middle">
    <p style="font-size:16px;font-weight:700;margin-bottom:7px">Do zapłaty&nbsp; ${fmtPl(amountGross)} PLN</p>
    <p style="font-size:10px;color:#333;line-height:1.5">Słownie: ${slownie}</p>
  </td>
</tr></table>

<!-- ── PODPISY ── -->
<table style="width:100%;margin-top:48px"><tr>
  <td style="width:50%;text-align:center;border-top:1px solid #aaa;padding-top:6px;padding-right:48px;font-size:10px;color:#c0392b">
    Podpis osoby upoważnionej do wystawienia
  </td>
  <td style="width:50%;text-align:center;border-top:1px solid #aaa;padding-top:6px;padding-left:48px;font-size:10px;color:#c0392b">
    Podpis osoby upoważnionej do odbioru
  </td>
</tr></table>

${isNota ? `<!-- ── PODSTAWA PRAWNA (tylko nota) ── -->
<div style="margin-top:16px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:3px;font-size:8.5px;color:#555;line-height:1.55">
  <strong>Podstawa prawna VAT 0% przy emisji MPV:</strong>
  Voucher wielofunkcyjny (Multi-Purpose Voucher) zgodny z art. 8b ust. 1 Ustawy z dnia 11 marca 2004 r.
  o podatku od towarów i usług (Dz.U. 2004 nr 54 poz. 535 ze zm.) wdrażającej Dyrektywę UE 2016/1065.
  VAT jest rozliczany przez podmiot realizujący voucher w momencie jego realizacji.
  Nota obciążeniowa nie jest fakturą VAT.
</div>` : ''}

</body></html>`;
}

/** @internal */
function buildNotaHtml(ctx: DocumentContext): string {
  return buildPolishInvoiceHtml(ctx, 'nota');
}

/** @internal */
function buildFakturaHtml(ctx: DocumentContext): string {
  return buildPolishInvoiceHtml(ctx, 'faktura_vat');
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

