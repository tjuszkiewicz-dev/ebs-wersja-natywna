import { describe, it, expect, beforeEach } from 'vitest';
import { sendEmail } from './mailer';

describe('sendEmail (graceful bez konfiguracji SMTP)', () => {
  beforeEach(() => { delete process.env.SMTP_USER; delete process.env.SMTP_PASS; });
  it('zwraca skipped gdy brak SMTP_USER/SMTP_PASS (nie rzuca)', async () => {
    const res = await sendEmail({ to: 'a@b.pl', subject: 'x', html: '<p>x</p>' });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
  });
});
