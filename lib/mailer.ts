import { Resend } from 'resend';

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'EBS Stratton Prime <no-reply@stratton-prime.pl>';

export async function sendEmail(input: {
  to: string; subject: string; html: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[mailer] RESEND_API_KEY nieustawiony — pomijam wysyłkę do', input.to, '|', input.subject);
    return { ok: false, skipped: true };
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL, to: input.to, subject: input.subject, html: input.html,
      attachments: input.attachments?.map(a => ({ filename: a.filename, content: a.content })) as any,
    });
    if (error) { console.error('[mailer] błąd Resend:', error); return { ok: false, error: String(error) }; }
    return { ok: true };
  } catch (e: any) {
    console.error('[mailer] wyjątek:', e?.message); return { ok: false, error: e?.message };
  }
}
