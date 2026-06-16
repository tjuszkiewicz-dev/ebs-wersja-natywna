import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getFakturowniaClient } from '@/lib/fakturownia/factory';

// Fakturownia powiadamia o zmianie statusu faktury. Weryfikacja sekretu w query (?secret=).
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.FAKTUROWNIA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { id?: number; status?: string } | null;
  const invoiceId = body?.id;
  if (!invoiceId) return NextResponse.json({ ok: true }); // nic do zrobienia

  // Nie ufamy statusowi z payloadu — potwierdzamy stan bezpośrednio w FA (źródło prawdy).
  // Dzięki temu samo znajomość sekretu nie wystarcza, by oznaczyć dowolną fakturę jako opłaconą.
  const fa = getFakturowniaClient();
  let isPaid: boolean;
  if (fa) {
    try {
      const inv = await fa.getInvoice(invoiceId);
      isPaid = inv.status === 'paid';
    } catch (err) {
      console.error('[fakturownia] webhook: weryfikacja faktury nie powiodła się', invoiceId, err);
      return NextResponse.json({ error: 'verify failed' }, { status: 502 });
    }
  } else {
    // Integracja wyłączona (brak env) — fallback do statusu z payloadu (zachowanie zgodne ze starym).
    isPaid = body?.status === 'paid';
  }

  if (isPaid) {
    const supabase = supabaseServer();
    await supabase.from('financial_documents').update({
      status: 'paid',
      payment_confirmed_at: new Date().toISOString(),
    }).eq('fakturownia_invoice_id', invoiceId);
  }
  return NextResponse.json({ ok: true });
}
