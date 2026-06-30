import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getFakturowniaClient } from '@/lib/fakturownia/factory';
import { issueFakturaForOrder } from '@/lib/fakturownia/invoiceService';

// Reconcyliacja: odpytaj FA o status niezapłaconych dokumentów. Vercel Cron wywołuje GET.
export async function GET(req: Request) {
  // Weryfikacja wywołania przez Vercel Cron (nagłówek Authorization: Bearer CRON_SECRET).
  // Egzekwowane tylko gdy CRON_SECRET ustawiony — brak env zachowuje dotychczasowe zachowanie.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fa = getFakturowniaClient();
  if (!fa) return NextResponse.json({ skipped: 'integration disabled' });

  const supabase = supabaseServer();
  const { data: docs } = await supabase
    .from('financial_documents')
    .select('id, type, linked_order_id, fakturownia_invoice_id')
    .eq('status', 'pending')
    .not('fakturownia_invoice_id', 'is', null);

  let updated = 0;
  for (const doc of docs ?? []) {
    try {
      const inv = await fa.getInvoice(doc.fakturownia_invoice_id as number);
      if (inv.status === 'paid') {
        await supabase.from('financial_documents').update({
          status: 'paid',
          payment_confirmed_at: new Date().toISOString(),
        }).eq('id', doc.id);
        updated++;

        // Po opłaceniu NOTY → wystaw w FA fakturę VAT (KSeF po stronie konta FA).
        if (doc.type === 'nota' && doc.linked_order_id) {
          try {
            await issueFakturaForOrder(supabase, fa, doc.linked_order_id as string);
          } catch (err) {
            console.error('[fakturownia] sync-cron: wystawienie faktury VAT po opłacie noty nie powiodło się', doc.linked_order_id, err);
          }
        }
      }
    } catch (err) {
      // pojedyncza faktura nie wywraca całej reconcyliacji
      console.error('[fakturownia] sync-cron: błąd dla faktury', doc.fakturownia_invoice_id, err);
    }
  }
  return NextResponse.json({ checked: docs?.length ?? 0, updated });
}
