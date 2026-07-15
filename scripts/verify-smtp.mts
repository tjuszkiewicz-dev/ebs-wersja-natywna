/**
 * Weryfikacja połączenia SMTP (poczta Stratton / home.pl).
 * Domyślnie tylko sprawdza logowanie (transporter.verify()) — NIC nie wysyła.
 * Podaj adres jako argument, aby wysłać testowy mail.
 *
 * Uruchom:
 *   npx tsx --env-file=.env.local scripts/verify-smtp.mts                 # tylko test połączenia
 *   npx tsx --env-file=.env.local scripts/verify-smtp.mts ty@twojadres.pl # + testowy mail
 *
 * Wymaga w .env.local: SMTP_USER, SMTP_PASS (+ opcjonalnie SMTP_HOST/PORT/SECURE/FROM).
 */
import nodemailer from 'nodemailer';

const HOST = process.env.SMTP_HOST ?? 'serwer2690202.home.pl';
const PORT = Number(process.env.SMTP_PORT ?? 465);
const SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : PORT === 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!user || !pass) {
  console.error('❌ Brak SMTP_USER/SMTP_PASS w .env.local');
  process.exit(1);
}

console.log(`→ Łączę: ${HOST}:${PORT} (secure=${SECURE}) jako ${user}`);
const t = nodemailer.createTransport({ host: HOST, port: PORT, secure: SECURE, auth: { user, pass } });

try {
  await t.verify();
  console.log('✅ SMTP OK — serwer przyjął uwierzytelnienie.');
} catch (e: any) {
  console.error('❌ SMTP błąd:', e?.message);
  console.error('   Podpowiedź: jeśli 465 nie działa, spróbuj SMTP_PORT=587 + SMTP_SECURE=false (STARTTLS).');
  process.exit(1);
}

const to = process.argv[2];
if (to) {
  const from = process.env.SMTP_FROM ?? `EBS Stratton Prime <${user}>`;
  const info = await t.sendMail({
    from, to,
    subject: 'EBS — test SMTP',
    html: '<p>Testowa wiadomość z EBS (nodemailer/SMTP). Jeśli ją widzisz — wysyłka działa.</p>',
  });
  console.log(`✅ Wysłano testowy mail do ${to} (messageId: ${info.messageId})`);
} else {
  console.log('ℹ️  Aby wysłać testowy mail, dodaj adres jako argument.');
}
