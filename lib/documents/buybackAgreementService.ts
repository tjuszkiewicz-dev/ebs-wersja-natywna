import { supabaseServer } from '@/lib/supabase';
import { generatePdfBuffer, uploadPdf } from '@/lib/documents/pdfUtils';
import { renderTemplate } from '@/lib/documents/templateEngine';

const PDF_OPTIONS: Record<string, unknown> = {
  margin: { top: '16mm', bottom: '14mm', left: '20mm', right: '20mm' },
};

function fmtPln(n: number): string { return (Number(n) || 0).toFixed(2).replace('.', ',') + ' PLN'; }
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Generuje PDF umowy odkupu dla rekordu buyback_agreements, zapisuje pdf_url i zwraca URL (lub null). */
export async function createBuybackAgreementPdf(agreementId: string): Promise<string | null> {
  const supabase = supabaseServer();

  const { data: agr } = await supabase
    .from('buyback_agreements')
    .select('id, user_id, voucher_count, total_value_pln, date_generated, snapshot')
    .eq('id', agreementId)
    .single();
  if (!agr) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, pesel, iban, contact_email, address_street, address_city, address_zip')
    .eq('id', (agr as any).user_id)
    .single();

  const { data: tpl } = await (supabase as any)
    .from('document_templates').select('html').eq('key', 'buyback_agreement').single();
  if (!tpl?.html) return null;

  const snap = ((agr as any).snapshot ?? {}) as Record<string, any>;
  const p = (profile as any) ?? {};
  const address = [p.address_street, p.address_zip, p.address_city].filter(Boolean).join(', ');

  const vars = {
    imie_nazwisko:    snap.name  ?? p.full_name    ?? '',
    pesel_nip:        snap.pesel ?? p.pesel         ?? '',
    adres:            snap.address ?? address       ?? '',
    nr_ilustracji:    String((agr as any).id).slice(-8).toUpperCase(),
    liczba_voucherow: String((agr as any).voucher_count ?? 0),
    wartosc_pln:      fmtPln(Number((agr as any).total_value_pln ?? 0)),
    iban_zbywajacego: snap.iban  ?? p.iban          ?? '',
    email_zbywajacego: snap.email ?? p.contact_email ?? '',
    data:             fmtDate((agr as any).date_generated ?? new Date().toISOString()),
  };

  const html = renderTemplate(tpl.html as string, vars);
  const buffer = await generatePdfBuffer(html, PDF_OPTIONS);
  if (!buffer) return null;

  const dateSlug = new Date((agr as any).date_generated ?? Date.now()).toISOString().slice(0, 10);
  const url = await uploadPdf(supabase, `buyback/${dateSlug}_${String((agr as any).id).slice(-8).toUpperCase()}.pdf`, buffer);
  if (!url) return null;

  await (supabase as any).from('buyback_agreements').update({ pdf_url: url }).eq('id', agreementId);
  return url;
}
