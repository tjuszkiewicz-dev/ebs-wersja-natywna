import { describe, it, expect, beforeEach } from 'vitest';
import { sendEmail } from './mailer';

describe('sendEmail (graceful bez klucza)', () => {
  beforeEach(() => { delete process.env.RESEND_API_KEY; });
  it('zwraca skipped gdy brak RESEND_API_KEY (nie rzuca)', async () => {
    const res = await sendEmail({ to: 'a@b.pl', subject: 'x', html: '<p>x</p>' });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
  });
});
