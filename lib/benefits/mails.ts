// Treści e-maili sklepu — czyste funkcje, szablon spójny z app/api/contact-bok.
import { BOK_QUEUE_URL, BOK_SLA_TEXT, bokContactText } from './constants';

export interface MailContent { subject: string; html: string; text: string }

export interface OrderMailInput {
  productName: string; partner?: string; pricePoints: number;
  employeeName: string; employeeEmail: string; companyName?: string;
  transactionId: string; when: Date; fulfillment: 'auto' | 'bok';
}
export interface InquiryMailInput {
  productName: string; partner?: string;
  employeeName: string; employeeEmail: string; companyName?: string; when: Date;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const fmtDate = (d: Date) => d.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' });

function layout(title: string, rows: [string, string][], note: string): string {
  const tr = rows.map(([k, v]) =>
    `<tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:160px;">${escapeHtml(k)}</td><td style="padding:8px;">${escapeHtml(v)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#30df6a;">${escapeHtml(title)}</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${tr}</table>
  <div style="padding:16px;background:#f9f9f9;border-left:4px solid #30df6a;">${escapeHtml(note)}</div>
  <p style="color:#999;font-size:12px;margin-top:24px;">Wygenerowano automatycznie przez EBS — Eliton Benefits System</p>
</div>`;
}
const textOf = (title: string, rows: [string, string][], note: string) =>
  [title, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', note].join('\n');

const label = (i: { partner?: string; productName: string }) => (i.partner ? `${i.partner}: ${i.productName}` : i.productName);

export function bokOrderMail(i: OrderMailInput): MailContent {
  const rows: [string, string][] = [
    ['Produkt', i.productName], ['Partner', i.partner ?? '—'], ['Cena', `${i.pricePoints} pkt`],
    ['Pracownik', i.employeeName], ['E-mail', i.employeeEmail], ['Firma', i.companyName ?? '—'],
    ['Id transakcji', i.transactionId], ['Data', fmtDate(i.when)],
  ];
  const note = `Punkty zostały pobrane z konta pracownika. Prosimy o realizację zamówienia i wysłanie kodu/aktywacji na e-mail pracownika. Status obsługi: ${BOK_QUEUE_URL}`;
  const title = 'Nowe zamówienie ze sklepu benefitów';
  return { subject: `[EBS Sklep] Zamówienie: ${label(i)}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}

export function employeeOrderMail(i: OrderMailInput): MailContent {
  const rows: [string, string][] = [['Produkt', i.productName], ['Pobrano', `${i.pricePoints} pkt`], ['Data', fmtDate(i.when)]];
  if (i.fulfillment === 'auto') {
    const title = 'Aplikacja aktywna';
    const note = `Aplikacja „${i.productName}" jest już odblokowana w Twoim portalu EBS — znajdziesz ją w sekcji „Twoje Aplikacje".`;
    return { subject: `Aplikacja aktywna — ${i.productName}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
  }
  const title = 'Przyjęliśmy Twoje zamówienie';
  const note = `Biuro Obsługi Klienta prześle kod lub aktywację na ten adres w ciągu ${BOK_SLA_TEXT}. Pytania: ${bokContactText()}.`;
  return { subject: `Potwierdzenie zamówienia — ${i.productName}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}

export function bokInquiryMail(i: InquiryMailInput): MailContent {
  const rows: [string, string][] = [
    ['Produkt', i.productName], ['Partner', i.partner ?? '—'],
    ['Pracownik', i.employeeName], ['E-mail', i.employeeEmail], ['Firma', i.companyName ?? '—'], ['Data', fmtDate(i.when)],
  ];
  const note = `Pracownik prosi o ofertę. Prosimy o kontakt z pracownikiem lub przekazanie zapytania do brokera. Status obsługi: ${BOK_QUEUE_URL}`;
  const title = 'Zapytanie o ofertę ze sklepu benefitów';
  return { subject: `[EBS Sklep] Zapytanie o ofertę: ${label(i)}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}

export function employeeInquiryMail(i: InquiryMailInput): MailContent {
  const rows: [string, string][] = [['Produkt', i.productName], ['Partner', i.partner ?? '—'], ['Data', fmtDate(i.when)]];
  const title = 'Przyjęliśmy zapytanie o ofertę';
  const note = `Biuro Obsługi Klienta skontaktuje się z Tobą w ciągu ${BOK_SLA_TEXT}. Pytania: ${bokContactText()}.`;
  return { subject: `Przyjęliśmy zapytanie — ${i.productName}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}
