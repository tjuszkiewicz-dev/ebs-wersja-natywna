import { Company, DistributionBatch, User, Voucher } from '../../../types';

export const sanitizeFilename = (str: string): string => {
    if (!str) return 'file';
    return str
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
};

export const generateClientSidePdf = async (
    type: string,
    data: any,
    user: User | undefined,
    company: Company
): Promise<Blob> => {
    if (typeof window === 'undefined' || !(window as any).html2pdf) {
        return new Blob(["Error: PDF library missing."], { type: 'text/plain' });
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.padding = '20mm';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'serif';
    document.body.appendChild(container);

    const item = data.items && data.items.length > 0
        ? data.items[0]
        : { userName: 'Brak Danych', userId: '---', amount: 0, voucherRange: '-' };

    container.innerHTML = `
        <style>
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            h1 { font-size: 22px; text-transform: uppercase; margin: 0; padding: 0; }
            h2 { font-size: 14px; text-transform: uppercase; margin: 5px 0 0 0; color: #555; }
            .meta { margin-bottom: 30px; font-family: sans-serif; font-size: 12px; line-height: 1.6; }
            .content-box { border: 1px solid #000; padding: 20px; margin-bottom: 40px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .label { font-weight: bold; }
            .footer { margin-top: 100px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
            .signature-box { display: flex; justify-content: space-between; margin-top: 80px; }
            .sig-line { border-top: 1px dashed #000; width: 40%; padding-top: 5px; text-align: center; font-size: 10px; }
        </style>
        <div class="header">
            <h1>Potwierdzenie Otrzymania Środków</h1>
            <h2>System Benefitowy EBS</h2>
        </div>
        <div class="meta">
            <p><strong>Podmiot Przekazujący:</strong> ${company.name}</p>
            <p><strong>Data Operacji:</strong> ${new Date(data.date).toLocaleDateString()}</p>
        </div>
        <div class="content-box">
            <div class="row"><span class="label">Beneficjent (Pracownik):</span><span>${item.userName}</span></div>
            <div class="row"><span class="label">Identyfikator Systemowy:</span><span>${item.userId}</span></div>
            <hr style="margin: 15px 0; border: 0; border-top: 1px solid #eee;"/>
            <div class="row"><span class="label">Przedmiot Wydania:</span><span>Voucher Prime (Środki Cyfrowe)</span></div>
            <div class="row"><span class="label">Wartość Nominalna:</span><span><strong>${item.amount.toFixed(2)} PLN</strong></span></div>
            <div class="row"><span class="label">Szczegóły / Zakres:</span><span style="font-family: monospace; font-size: 12px;">${item.voucherRange || 'Automatyczny przydział'}</span></div>
        </div>
        <div class="signature-box">
            <div class="sig-line">Podpis Pracodawcy (HR)<br/>(Wygenerowano Elektronicznie)</div>
            <div class="sig-line">Podpis Pracownika<br/>(Potwierdzenie Odbioru)</div>
        </div>
        <div class="footer">Dokument wygenerowany w systemie EBS. Numer referencyjny operacji: ${data.id}</div>
    `;

    try {
        const opt = {
            margin: 0,
            filename: `Potwierdzenie_${item.userId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await new Promise(r => setTimeout(r, 100));

        // @ts-ignore
        const worker = window.html2pdf().set(opt).from(container).toPdf().get('pdf');
        const pdf = await worker;
        const blob = pdf.output('blob');
        document.body.removeChild(container);
        return blob;
    } catch (e) {
        document.body.removeChild(container);
        return new Blob([`Error generating PDF: ${e}`], { type: 'text/plain' });
    }
};

export const enrichBatchItemWithRange = (
    batch: DistributionBatch,
    item: any,
    vouchers: Voucher[]
): any => {
    const batchTime = new Date(batch.date).getTime();
    const userVouchers = vouchers.filter(v => {
        if (v.ownerId !== item.userId) return false;
        const vTime = new Date(v.issueDate).getTime();
        return Math.abs(vTime - batchTime) < 3600000;
    }).sort((a, b) => a.id.localeCompare(b.id));

    if (userVouchers.length > 0) {
        const first = userVouchers[0].id.split('/').pop();
        const last = userVouchers[userVouchers.length - 1].id.split('/').pop();
        const rangeStr = userVouchers.length > 1 ? `${first}...${last}` : first;
        return { ...item, voucherRange: rangeStr };
    }
    return { ...item, voucherRange: "Generowane w systemie" };
};

export const enrichBatchWithRanges = (batch: DistributionBatch, vouchers: Voucher[]): DistributionBatch => {
    const enrichedItems = (batch.items || []).map(item => enrichBatchItemWithRange(batch, item, vouchers));
    return { ...batch, items: enrichedItems };
};
