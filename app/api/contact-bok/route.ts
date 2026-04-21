// POST /api/contact-bok — wyślij wiadomość do Biura Obsługi Klienta

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { Resend } from 'resend';
import { z } from 'zod';

const BodySchema = z.object({
  subject:  z.string().min(3).max(200),
  category: z.enum(['USTERKA', 'PROBLEM_TECHNICZNY', 'PYTANIE', 'INNE']),
  message:  z.string().min(10).max(5000),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { subject, category, message } = parsed.data;

  // Pobierz dane użytkownika
  const supabase = supabaseServer();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, company_id')
    .eq('id', auth.id)
    .single();

  const { data: authUser } = await supabase.auth.admin.getUserById(auth.id);
  const senderEmail = authUser?.user?.email ?? 'nieznany';
  const senderName  = profile?.full_name ?? 'Pracownik';

  const categoryLabels: Record<string, string> = {
    USTERKA:           'Usterka',
    PROBLEM_TECHNICZNY: 'Problem techniczny',
    PYTANIE:           'Pytanie',
    INNE:              'Inne',
  };

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // Fallback — loguj wiadomość, nie blokuj użytkownika
    console.warn('[contact-bok] RESEND_API_KEY not set — message not sent but logged:', {
      from: senderEmail,
      subject,
      category,
      message,
    });
    return NextResponse.json({ ok: true, warning: 'Email provider not configured' });
  }

  const resend = new Resend(resendKey);

  const { error } = await resend.emails.send({
    from: 'EBS System <noreply@elitonbenefits.pl>',
    to:   ['bok@stratton-prime.pl'],
    replyTo: senderEmail,
    subject: `[EBS BOK] ${categoryLabels[category]}: ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #30df6a;">Nowe zgłoszenie BOK — Eliton Benefits System</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px; background: #f5f5f5; font-weight: bold; width: 160px;">Pracownik:</td>
            <td style="padding: 8px;">${senderName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">E-mail:</td>
            <td style="padding: 8px;">${senderEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Kategoria:</td>
            <td style="padding: 8px;">${categoryLabels[category]}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f5f5f5; font-weight: bold;">Temat:</td>
            <td style="padding: 8px;">${subject}</td>
          </tr>
        </table>
        <div style="padding: 16px; background: #f9f9f9; border-left: 4px solid #30df6a; white-space: pre-wrap;">${message}</div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Wygenerowano automatycznie przez EBS | ID użytkownika: ${auth.id}
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('[contact-bok] Resend error:', error);
    return NextResponse.json({ error: 'Nie udało się wysłać wiadomości' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
