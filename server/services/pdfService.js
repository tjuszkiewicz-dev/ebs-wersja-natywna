
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const hbs = require('handlebars');

let browserInstance = null;

// Helpery Handlebars
hbs.registerHelper('formatDate', (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pl-PL') + ' ' + new Date(dateString).toLocaleTimeString('pl-PL');
});

hbs.registerHelper('formatCurrency', (amount) => {
    if (typeof amount !== 'number') return '0.00 PLN';
    return amount.toFixed(2) + ' PLN';
});

hbs.registerHelper('getDueDate', (dateString, days = 7) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('pl-PL');
});

hbs.registerHelper('eq', (a, b) => a === b);

hbs.registerHelper('calculateNet', (gross) => (gross / 1.23).toFixed(2));
hbs.registerHelper('calculateVat', (gross) => (gross - (gross / 1.23)).toFixed(2));
hbs.registerHelper('multiply', (a, b) => (a * b).toFixed(2));

// Singleton Browser Launcher
const getBrowser = async () => {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browserInstance;
};

const compileTemplate = (templateName, data) => {
    const filePath = path.join(__dirname, '..', 'templates', `${templateName}.hbs`);
    const html = fs.readFileSync(filePath, 'utf-8');
    const template = hbs.compile(html);
    return template(data);
};

const generatePdf = async (docType, data, company, user) => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    let templateName = 'invoice'; 
    let context = { data, company, user };

    // Mapping Logic
    if (docType === 'DEBIT_NOTE') {
        templateName = 'invoice';
        context.isDebitNote = true;
        context.docId = data.docVoucherId;
        context.docTitle = 'NOTA KSIĘGOWA / FAKTURA';
        context.docSubtitle = 'Sprzedaż Znaków Legitymacyjnych (Vouchery)';
        context.sellerLabel = 'WYDAWCA VOUCHERÓW';
        context.buyerLabel = 'ZAMAWIAJĄCY';
    } else if (docType === 'VAT_INVOICE') {
        templateName = 'invoice';
        context.isDebitNote = false;
        context.docId = data.docFeeId;
        context.docTitle = 'FAKTURA VAT';
        context.docSubtitle = 'Obsługa Systemowa (Service Fee)';
        context.sellerLabel = 'SPRZEDAWCA USŁUGI';
        context.buyerLabel = 'NABYWCA USŁUGI';
    } else if (docType === 'BUYBACK_AGREEMENT') {
        templateName = 'buyback'; // Use dedicated template
        context.docTitle = 'UMOWA ODKUPU VOUCHERÓW';
    } else if (docType === 'IMPORT_REPORT') {
        templateName = 'import_report';
    }

    const content = compileTemplate(templateName, context);

    await page.setContent(content, { waitUntil: 'networkidle0' });

    // CSS @page handles margins now for pixel-perfect control
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true 
    });

    await page.close();
    return pdfBuffer;
};

module.exports = { generatePdf };
