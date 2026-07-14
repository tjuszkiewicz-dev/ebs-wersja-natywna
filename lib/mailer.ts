import nodemailer from 'nodemailer';

// Poczta Stratton (hosting home.pl). Host/port/tryb szyfrowania są zaszyte jako domyślne,
// więc w env wystarczy podać login i hasło skrzynki: SMTP_USER + SMTP_PASS.
// Opcjonalnie nadpisz: SMTP_HOST, SMTP_PORT, SMTP_SECURE (true/false), SMTP_FROM.
const HOST = process.env.SMTP_HOST ?? 'serwer2690202.home.pl';
const PORT = Number(process.env.SMTP_PORT ?? 465);
// SSL na 465; STARTTLS na 587. Domyślnie wywnioskowane z portu, można wymusić SMTP_SECURE.
const SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : PORT === 465;

/** Faktyczny nadawca: SMTP_FROM jeśli ustawiony, inaczej zalogowana skrzynka (unika odrzucenia SPF/relay). */
function resolveFrom(user: string): string {
  return process.env.SMTP_FROM ?? `EBS Stratton Prime <${user}>`;
}

/** Domyślna etykieta nadawcy (informacyjnie; realny from wylicza resolveFrom). */
export const FROM_EMAIL =
  process.env.SMTP_FROM ?? 'EBS Stratton Prime <no-reply@stratton-prime.pl>';

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn('[mailer] SMTP_USER/SMTP_PASS nieustawione — pomijam wysyłkę do', input.to, '|', input.subject);
    return { ok: false, skipped: true };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: input.from ?? resolveFrom(user),
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      attachments: input.attachments,
    });
    return { ok: true };
  } catch (e: any) {
    console.error('[mailer] błąd SMTP:', e?.message);
    return { ok: false, error: e?.message };
  }
}
