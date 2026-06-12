import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// Fakturownia powiadamia o zmianie statusu faktury. Weryfikacja sekretu w query (?secret=).
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.FAKTUROWNIA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { id?: number; status?: string } | null;
  const invoiceId = body?.id;
  const status = body?.status;
  if (!invoiceId) return NextResponse.json({ ok: true }); // nic do zrobienia

  if (status === 'paid') {
    const supabase = supabaseServer();
    await supabase.from('financial_documents').update({
      status: 'paid',
      payment_confirmed_at: new Date().toISOString(),
    }).eq('fakturownia_invoice_id', invoiceId);
  }
  return NextResponse.json({ ok: true });
}
