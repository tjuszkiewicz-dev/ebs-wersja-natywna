import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import nodemailer from 'nodemailer';

// GET /api/admin/smtp-check — superadmin: sprawdza połączenie SMTP (verify()).
// Nic nie wysyła, NIE zwraca hasła. Diagnostyka konfiguracji poczty Stratton.
export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const host = process.env.SMTP_HOST ?? 'serwer2690202.home.pl';
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return NextResponse.json({ ok: false, configured: false, host, port, secure, error: 'SMTP_USER/SMTP_PASS nieustawione na tym środowisku' });
  }

  try {
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    await transporter.verify();
    return NextResponse.json({ ok: true, configured: true, host, port, secure, user });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, configured: true, host, port, secure, user, error: e?.message ?? String(e) },
      { status: 502 },
    );
  }
}
