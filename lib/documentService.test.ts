import { describe, it, expect } from 'vitest';
import { buildPolishInvoiceHtml, type DocumentContext } from './documentService';
import { ISSUER } from './documents/pdfUtils';

const baseCtx: DocumentContext = {
  orderId: 'o1', companyId: 'c1', companyName: 'Aneza', companyNip: '7451615606',
  companyAddress: 'ul. Bratnia 11a, 05-091 Ząbki',
  voucherAmount: 3900, feeNet: 585, feeVat: 134.55, feeGross: 719.55,
  issuedAt: '2026-05-10T10:00:00.000Z',
  docNotaNumber: 'NK/2026/TEST/B', docFakturaNumber: 'FV/2026/TEST/S',
  distributionSummary: 'Zamówienie 3900 voucherów',
};

describe('buildPolishInvoiceHtml — konto na nocie', () => {
  it('drukuje konto firmy gdy sellerBankAccount podane', () => {
    const html = buildPolishInvoiceHtml({ ...baseCtx, sellerBankAccount: 'PL61 1090 1014 0000 0712 1981 2874' }, 'nota');
    expect(html).toContain('PL61 1090 1014 0000 0712 1981 2874');
    expect(html).not.toContain(ISSUER.bank);
  });
  it('fallback do ISSUER.bank gdy brak sellerBankAccount', () => {
    const html = buildPolishInvoiceHtml(baseCtx, 'nota');
    expect(html).toContain(ISSUER.bank);
  });
});
