import { describe, it, expect } from 'vitest';
import { bokOrderMail, employeeOrderMail, bokInquiryMail, employeeInquiryMail, escapeHtml } from './mails';
import { BOK_SLA_TEXT } from './constants';

const when = new Date('2026-09-15T10:30:00Z');
const order = { productName: 'Multikino (Bilet) <b>x</b>', partner: 'Multikino', pricePoints: 25, employeeName: 'Jan Testowy', employeeEmail: 'jan@example.com', companyName: 'Firma Testowa', transactionId: 'abc-123', when, fulfillment: 'bok' as const };
const inquiry = { productName: 'PZU — NNW', partner: 'Profitowi', employeeName: 'Jan Testowy', employeeEmail: 'jan@example.com', companyName: 'Firma Testowa', when };

describe('escapeHtml', () => {
  it('neutralizuje znaczniki', () => expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;'));
});

describe('e-maile zamówienia', () => {
  it('BOK: temat z partnerem i produktem, treść z ceną, pracownikiem, firmą i id transakcji; HTML escapowany', () => {
    const m = bokOrderMail(order);
    expect(m.subject).toBe('[EBS Sklep] Zamówienie: Multikino: Multikino (Bilet) <b>x</b>');
    expect(m.html).toContain('25 pkt');
    expect(m.html).toContain('Jan Testowy');
    expect(m.html).toContain('Firma Testowa');
    expect(m.html).toContain('abc-123');
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(m.text).toContain('jan@example.com');
  });
  it('pracownik (bok): obietnica SLA i punkty', () => {
    const m = employeeOrderMail(order);
    expect(m.subject).toContain('Potwierdzenie zamówienia');
    expect(m.html).toContain(BOK_SLA_TEXT);
    expect(m.html).toContain('25 pkt');
  });
  it('pracownik (auto): „Aplikacja aktywna", bez SLA', () => {
    const m = employeeOrderMail({ ...order, productName: 'Wellbeing', fulfillment: 'auto' });
    expect(m.subject).toContain('Aplikacja aktywna');
    expect(m.html).not.toContain(BOK_SLA_TEXT);
  });
});

describe('e-maile zapytania', () => {
  it('BOK: temat i dane pracownika', () => {
    const m = bokInquiryMail(inquiry);
    expect(m.subject).toBe('[EBS Sklep] Zapytanie o ofertę: Profitowi: PZU — NNW');
    expect(m.html).toContain('jan@example.com');
  });
  it('pracownik: SLA', () => {
    const m = employeeInquiryMail(inquiry);
    expect(m.subject).toContain('Przyjęliśmy zapytanie');
    expect(m.html).toContain(BOK_SLA_TEXT);
  });
});
