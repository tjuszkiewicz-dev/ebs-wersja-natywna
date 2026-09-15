// POST /api/vouchers/purchase — zakup za punkty w sklepie benefitów (pracownik).
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §6.2.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { sendEmail } from '@/lib/mailer';
import { validatePurchase } from '@/lib/benefits/purchaseValidation';
import { bokOrderMail, employeeOrderMail } from '@/lib/benefits/mails';
import { BOK_EMAIL } from '@/lib/benefits/constants';

const Schema = z.object({
  serviceId:   z.string().min(1).max(100),
  serviceName: z.string().min(1).max(200),
  amount:      z.number().int().positive().max(10_000),
});

const ERROR_TEXT: Record<string, string> = {
  invalid_id:      'Nieprawidłowy identyfikator usługi.',
  unknown_service: 'Ta usługa nie istnieje w katalogu.',
  not_purchasable: 'Tej usługi nie kupuje się za punkty — użyj „Zapytaj o ofertę".',
  price_mismatch:  'Cena usługi zmieniła się — odśwież stronę i spróbuj ponownie.',
};

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'pracownik') return NextResponse.json({ error: 'Zakupy w sklepie są dostępne tylko dla pracowników.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 });
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { serviceId, amount } = parsed.data;

  const validation = validatePurchase(serviceId, amount);
  // Uwaga: `validation.ok === false` (nie `!validation.ok`) — przy strict:false w tsconfig
  // TS nie zawęża unii po odwróconej wartości boolowskiej, tylko po porównaniu z literałem.
  if (validation.ok === false) return NextResponse.json({ error: ERROR_TEXT[validation.error], code: validation.error }, { status: 400 });
  // Nazwa z katalogu, nie z przeglądarki — trafia do ledgera i do BOK.
  const serviceName = validation.kind === 'catalog' ? validation.item.name : parsed.data.serviceName;

  const supabase = supabaseServer();
  const { data, error } = await (supabase as any).rpc('redeem_vouchers_for_service', {
    p_user_id: auth.id, p_amount: amount, p_service_id: serviceId, p_service_name: serviceName,
  });
  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('INSUFFICIENT_VOUCHERS') || msg.includes('INSUFFICIENT_BALANCE')) {
      return NextResponse.json({ error: `Niewystarczające środki (wymagane: ${amount} pkt). Jeśli saldo się zgadza, spróbuj ponownie za chwilę.`, code: 'insufficient' }, { status: 400 });
    }
    console.error('[purchase] rpc failed', msg);
    return NextResponse.json({ error: 'Nie udało się zrealizować zakupu.' }, { status: 500 });
  }
  const transactionId: string = data?.transaction_id ?? '';
  if (!transactionId) {
    console.error('[purchase] RPC returned no transaction_id', { serviceId, userId: auth.id, data });
  }

  // E-maile — awaria poczty NIE cofa zakupu (vouchery już umorzone).
  if (validation.kind === 'catalog') {
    try {
      const { data: profile } = await supabase.from('user_profiles').select('full_name, company_id').eq('id', auth.id).single();
      let companyName: string | undefined;
      if (profile?.company_id) {
        const { data: c } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
        companyName = c?.name ?? undefined;
      }
      const input = {
        productName: validation.item.name, partner: validation.item.partner, pricePoints: amount,
        employeeName: profile?.full_name ?? 'Pracownik', employeeEmail: auth.email, companyName,
        transactionId, when: new Date(), fulfillment: validation.item.fulfillment ?? 'bok' as const,
      };
      if (input.fulfillment === 'bok') {
        const m = bokOrderMail(input);
        const rBok = await sendEmail({ to: BOK_EMAIL, replyTo: auth.email, subject: m.subject, html: m.html, text: m.text });
        if (!rBok.ok) console.error('[purchase] mail not sent', { to: 'bok', transactionId, serviceId, userId: auth.id, reason: rBok.error ?? 'skipped' });
      }
      const e = employeeOrderMail(input);
      const rEmployee = await sendEmail({ to: auth.email, subject: e.subject, html: e.html, text: e.text });
      if (!rEmployee.ok) console.error('[purchase] mail not sent', { to: 'employee', transactionId, serviceId, userId: auth.id, reason: rEmployee.error ?? 'skipped' });
    } catch (e: any) {
      console.error('[purchase] mail failed', e?.message ?? e);
    }
  }

  return NextResponse.json({ redeemed: amount, serviceName, transactionId });
}
