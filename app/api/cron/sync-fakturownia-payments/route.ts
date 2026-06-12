import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getFakturowniaClient } from '@/lib/fakturownia/factory';

// Reconcyliacja: odpytaj FA o status niezapłaconych dokumentów. Vercel Cron wywołuje GET.
export async function GET() {
  const fa = getFakturowniaClient();
  if (!fa) return NextResponse.json({ skipped: 'integration disabled' });

  const supabase = supabaseServer();
  const { data: docs } = await supabase
    .from('financial_documents')
    .select('id, fakturownia_invoice_id')
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
      }
    } catch {
      // pojedyncza faktura nie wywraca całej reconcyliacji
    }
  }
  return NextResponse.json({ checked: docs?.length ?? 0, updated });
}
