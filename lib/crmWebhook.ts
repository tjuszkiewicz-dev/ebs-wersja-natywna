// Outbound webhook EBS → CRM (kierunek B): po naliczeniu prowizji z opłaconej
// faktury wysyłamy informację do CRM, który SAM rozbija prowizję po swojej
// strukturze i pokazuje w dziale Rozliczenia.
//
// GATED: aktywne tylko gdy ustawione CRM_WEBHOOK_URL i CRM_WEBHOOK_SECRET.
// Puste = no-op (zero ruchu do CRM). Fire-and-log, nieblokujące (błąd nie
// wywraca płatności/faktury).
//
// Kontrakt zgodny z CRM `POST /api/ebs/webhook` (nagłówek X-EBS-Secret):
//   { ebs_invoice_id, period, fee_amount, handlowiec_email }
// Przedstawiciel matchowany po EMAILU (EBS to inny projekt Supabase niż CRM).

export interface CrmCommissionPayload {
  ebsInvoiceId: string;
  feeAmount: number;
  handlowiecEmail: string | null;
  period?: string; // "YYYY-MM"; domyślnie bieżący miesiąc
}

export async function notifyCrmCommission(p: CrmCommissionPayload): Promise<void> {
  const url = (process.env.CRM_WEBHOOK_URL ?? '').trim();
  const secret = (process.env.CRM_WEBHOOK_SECRET ?? '').trim();

  if (!url || !secret) return; // integracja wyłączona
  if (!p.handlowiecEmail) {
    console.warn('[crmWebhook] brak email przedstawiciela, pomijam', { ebsInvoiceId: p.ebsInvoiceId });
    return;
  }

  const period = p.period ?? new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-EBS-Secret': secret,
      },
      body: JSON.stringify({
        ebs_invoice_id: p.ebsInvoiceId,
        period,
        fee_amount: Number(p.feeAmount.toFixed(2)),
        handlowiec_email: p.handlowiecEmail,
      }),
    });
    if (!res.ok) {
      console.warn('[crmWebhook] CRM zwrócił błąd', { status: res.status, ebsInvoiceId: p.ebsInvoiceId });
    }
  } catch (e) {
    console.warn('[crmWebhook] wyjątek', { error: (e as Error).message, ebsInvoiceId: p.ebsInvoiceId });
  }
}
