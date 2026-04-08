/**
 * Serwis generowania Umowy Zlecenia Nabycia Voucherów.
 * Generuje HTML → PDF przez Puppeteer (server/app.js).
 * Zapisuje PDF w Supabase Storage bucket "financial-documents".
 */

import { supabaseServer } from '@/lib/supabase';
import { generatePdfBuffer, uploadPdf } from '@/lib/documents/pdfUtils';

export interface UmowaContext {
  orderId:         string;
  companyId:       string;
  companyName:     string;
  companyNip:      string;
  companyKrs:      string | null;
  companyRegon:    string | null;
  companyCity:     string | null;
  companyAddress:  string | null;
  companyEmail:    string | null;  // email Kupującego do doręczeń
  representative:  string | null;  // imię/nazwisko osoby reprezentującej
  /** Nr Ilustracji = doc_voucher_id z zamówienia */
  docVoucherId:    string;
  voucherCount:    number;
  voucherValueNet: number;   // wartość netto voucherów (nota)
  feePercent:      number;   // opłata serwisowa w %
  feeNet:          number;   // wartość faktury netto za obsługę
  realizationDays: number;   // termin realizacji (dni robocze)
  contractDate:    string;   // ISO date
}

const blank = '____________________________';

function buildUmowaHtml(ctx: UmowaContext): string {
  const fmt = (n: number) =>
    n.toFixed(2).replace('.', ',') + ' PLN';
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

  const date = fmtDate(ctx.contractDate);
  const buyerName = ctx.companyName || blank;
  const buyerCity = ctx.companyCity || blank;
  const buyerAddress = ctx.companyAddress || blank;
  const buyerKrs = ctx.companyKrs || blank;
  const buyerRegon = ctx.companyRegon || blank;
  const buyerNip = ctx.companyNip || blank;
  const buyerRep = ctx.representative || blank;
  const buyerEmail = ctx.companyEmail || blank;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.55; }
  .main-title {
    font-size: 17pt; font-weight: 900; text-align: center;
    color: #1a1a2e; letter-spacing: 0.5pt; margin-bottom: 4pt;
  }
  .sub-title {
    font-size: 9.5pt; text-align: center; color: #555; margin-bottom: 18pt;
    font-style: italic;
  }
  .preamble { margin-bottom: 12pt; text-align: justify; page-break-inside: avoid; }
  .preamble p { margin-bottom: 6pt; }
  .separator { text-align: center; font-weight: 700; font-size: 11pt; margin: 8pt 0; }
  .section-title {
    font-weight: 700; font-size: 10.5pt; margin: 14pt 0 5pt 0;
    color: #1a1a2e; page-break-after: avoid;
  }
  .section-body { text-align: justify; }
  .section-body p { margin-bottom: 5pt; }
  .section-body ol { padding-left: 18pt; }
  .section-body ol li { margin-bottom: 5pt; }
  .section-body ul { padding-left: 18pt; }
  .section-body ul li { margin-bottom: 4pt; }
  .params-table { width: 100%; border-collapse: collapse; margin: 8pt 0 6pt 0; page-break-inside: avoid; }
  .params-table th {
    background: #1a1a2e; color: #fff; padding: 6pt 10pt;
    font-size: 9pt; text-align: left;
  }
  .params-table td { padding: 5pt 10pt; border-bottom: 1px solid #ddd; font-size: 9.5pt; }
  .params-table tr:nth-child(even) td { background: #f7f7fa; }
  .params-table td:last-child { font-weight: 600; }
  .signatures {
    display: flex; justify-content: space-between; margin-top: 30pt;
    page-break-inside: avoid;
  }
  .sign-block { width: 45%; text-align: center; }
  .sign-block .sign-line {
    border-bottom: 1px solid #111; margin-bottom: 4pt; height: 30pt;
  }
  .sign-block .sign-label { font-size: 8.5pt; color: #555; }
  b { font-weight: 700; }
</style>
</head>
<body>

<div class="main-title">UMOWA ZLECENIA NABYCIA<br/>VOUCHERÓW</div>
<div class="sub-title">Nr Ilustracji: ${ctx.docVoucherId}</div>

<div class="preamble">
  <p>Zawarta w dniu <b>${date}</b> w Gdańsku pomiędzy:</p>

  <p><b>Stratton Prime Sp. z o.o.</b> z siedzibą przy ul. Junony 23/11, 80-299 Gdańsk, wpisaną do rejestru
  przedsiębiorców KRS pod numerem: <b>0001169520</b>, NIP: <b>5842867357</b>, REGON: <b>541537557</b>,
  reprezentowaną przez: Natalię Juszkiewicz – Prezesa Zarządu, zwaną dalej <b>„Sprzedawcą"</b></p>

  <div class="separator">a</div>

  <p><b>${buyerName}</b> z siedzibą w ${buyerCity}, adres: ${buyerAddress},
  wpisaną do rejestru KRS pod numerem ${buyerKrs},
  REGON ${buyerRegon}, NIP <b>${buyerNip}</b>, reprezentowaną przez:
  ${buyerRep}, zwaną dalej <b>„Kupującym"</b></p>
</div>

<div class="section-title">§ 1 Przedmiot Umowy</div>
<div class="section-body">
  <ol>
    <li>Przedmiotem niniejszej umowy zlecenia jest jednorazowy zakup voucherów cyfrowych (znaków
    legitymacyjnych) uprawniających do korzystania z usług i towarów dostępnych w zamkniętym katalogu
    platformy Eliton Benefits System (EBS), od Sprzedawcy przez Kupującego.</li>
    <li>Niniejsza umowa stanowi Załącznik nr 1 do Umowy Ramowej Współpracy Eliton Prime™ i wykonywana jest
    w ramach tej umowy.</li>
    <li>Wartość voucherów będących przedmiotem transakcji jest każdorazowo ustalana na podstawie
    indywidualnej Ilustracji (kalkulacji przygotowanej przez Sprzedawcę na podstawie dostarczonych przez
    Kupującego danych z listy płac), gdzie 1 voucher = 1 PLN. Parametry zamówienia określa tabela w §2
    niniejszej umowy.</li>
    <li>Vouchery są znakami legitymacyjnymi w rozumieniu art. 921<sup>15</sup> Kodeksu cywilnego. Spełniają warunki
    zwolnienia z podstawy wymiaru składek ZUS na podstawie §2 ust. 1 pkt 26 rozporządzenia MPiPS z dnia
    18.12.1998 r. (Dz.U.1998.161.1106).</li>
  </ol>
</div>

<div class="section-title">§ 2 Parametry Zamówienia</div>
<div class="section-body">
  <p>Strony zgodnie ustalają następujące parametry niniejszego zlecenia:</p>
  <table class="params-table">
    <thead><tr><th>Parametr zamówienia</th><th>Wartość</th></tr></thead>
    <tbody>
      <tr><td>Nr Ilustracji</td><td>${ctx.docVoucherId}</td></tr>
      <tr><td>Liczba voucherów</td><td>${ctx.voucherCount.toLocaleString('pl-PL')} szt.</td></tr>
      <tr><td>Wartość jednostkowa</td><td>1 voucher = 1,00 PLN</td></tr>
      <tr><td>Wartość netto voucherów, nota księgowa</td><td>${fmt(ctx.voucherValueNet)}</td></tr>
      <tr><td>Opłata serwisowa (${ctx.feePercent}%)</td><td>${fmt(ctx.feeNet)}</td></tr>
      <tr><td>Wartość faktury netto za obsługę</td><td>${fmt(ctx.feeNet)}</td></tr>
    </tbody>
  </table>
  <p>Szczegółowy wykaz pracowników/zleceniobiorców wraz z przypisanymi wartościami voucherów stanowi
  Ilustrację nr wskazaną powyżej, która jest integralną częścią niniejszej umowy.</p>
</div>

<div class="section-title">§ 3 Wykonanie zobowiązania</div>
<div class="section-body">
  <ol>
    <li>Sprzedawca zobowiązany jest przekazać Kupującemu informację o liczbie voucherów obliczonych na
    podstawie indywidualnej Ilustracji o nr wskazanym w §2.</li>
    <li>Sprzedawca przeniesie vouchery bezpośrednio na wygenerowane indywidualne konto Kupującego na
    platformie EBS, skąd są następnie przydzielane na imienne konta uczestników programu (pracowników /
    zleceniobiorców Kupującego).</li>
    <li>Przeniesienie voucherów następuje nie później niż w terminie wskazanym w §2, liczonym od dnia
    zaakceptowania Ilustracji przez Kupującego i zaksięgowania płatności.</li>
    <li>W razie problemów technicznych związanych z przeniesieniem voucherów na konto indywidualne na
    platformie EBS, trwających dłużej niż 3 dni robocze od przekazania Ilustracji zamówienia, Kupujący ma prawo
    odstąpienia od umowy bezkosztowo.</li>
    <li>Wszelkie procedury związane z ewentualną rezygnacją uczestnika z programu EBS prowadzone są
    wyłącznie przez operatora platformy EBS bezpośrednio z uczestnikiem. Kupujący nie jest stroną tych procedur
    i nie uczestniczy w żadnych rozliczeniach z nimi związanych.</li>
  </ol>
</div>

<div class="section-title">§ 4 Płatność</div>
<div class="section-body">
  <ol>
    <li>Płatność za vouchery zostanie dokonana jednorazowo na podstawie faktury VAT wystawionej przez
    Sprzedawcę do niniejszego zlecenia.</li>
    <li>Wysokość faktury stanowi iloczyn liczby zakupionych voucherów i ich wartości jednostkowej (1 voucher = 1 PLN),
    powiększony o koszt realizacji usługi w wysokości ${ctx.feePercent}% wartości netto zamówienia.</li>
    <li>Vouchery kwalifikują się jako bony wieloprzeznaczeniowe (MPV) w rozumieniu art. 8b ustawy o VAT oraz
    Dyrektywy 2016/1065/UE. VAT naliczany jest w chwili realizacji vouchera przez uczestnika u dostawcy usługi
    – nie w chwili emisji ani przekazania.</li>
    <li>Strony wyrażają zgodę na przesyłanie faktur VAT w formie elektronicznej na adresy e-mail:<br/>
    Sprzedawca: <b>faktury@stratton-prime.pl</b><br/>
    Kupujący: ${buyerEmail}</li>
    <li>Płatność za fakturę dokonywana jest przelewem na konto Sprzedawcy w Millennium Bank:<br/>
    <b>IBAN PL 66 1160 2202 0000 0006 6619 4064</b><br/>
    w terminie 7 dni od daty otrzymania przez Sprzedawcę prawidłowo wystawionej faktury VAT.</li>
    <li>Wynagrodzenie obejmuje wszystkie koszty umowy leżące po stronie Sprzedawcy.</li>
  </ol>
</div>

<div class="section-title">§ 5 Zawiadomienia</div>
<div class="section-body">
  <ol>
    <li>Wszystkie zawiadomienia wymagane przez niniejszą Umowę będą pisemne i doręczone:
      <ul style="list-style-type:lower-alpha">
        <li>do rąk własnych (z poświadczeniem odbioru),</li>
        <li>pocztą kurierską (za zwrotnym potwierdzeniem odbioru),</li>
        <li>pocztą elektroniczną – z potwierdzeniem odbioru wiadomości przez adresata,</li>
        <li>listem poleconym na adresy wskazane w niniejszej Umowie.</li>
      </ul>
      Sprzedawca: <b>biuro@stratton-prime.pl</b><br/>
      Kupujący: ${buyerEmail}
    </li>
  </ol>
</div>

<div class="section-title">§ 6 Oświadczenia i gwarancje</div>
<div class="section-body">
  <ol>
    <li>Kupujący oświadcza, że przeczytał, rozumie i akceptuje postanowienia niniejszej umowy w całości, bez zastrzeżeń.</li>
    <li>Kupujący oświadcza, że posiada wystarczającą wiedzę na temat funkcjonalności, zasad korzystania i
    przechowywania voucherów na platformie EBS, aby świadomie zawrzeć niniejszą umowę.</li>
    <li>Kupujący otrzymał wystarczającą ilość informacji o voucherach i platformie EBS, aby podjąć świadomą
    decyzję o zakupie.</li>
    <li>Kupujący zobowiązuje się przestrzegać wszelkich obowiązujących zobowiązań podatkowych (PIT, ZUS)
    wynikających z nabycia i dystrybucji voucherów wśród uczestników programu.</li>
    <li>Kupujący przyjmuje do wiadomości i akceptuje, że voucher nie jest:
      <ul style="list-style-type:lower-alpha">
        <li>detalicznym produktem zbiorowego inwestowania (PRIIP) w rozumieniu Rozporządzenia UE nr 1286/2014,</li>
        <li>jednostką uczestnictwa ani certyfikatem inwestycyjnym w rozumieniu ustawy z 27.05.2004 r. o funduszach inwestycyjnych,</li>
        <li>dokumentem osobistym na żądanie ani na okaziciela w rozumieniu art. 174 KSH,</li>
        <li>instrumentem finansowym w rozumieniu art. 2 pkt 1 ustawy z 29.07.2005 r. o obrocie instrumentami finansowymi,</li>
        <li>walutą wirtualną w rozumieniu art. 2 ust. 2 pkt 26 ustawy AML (Dz.U.2023.1124).</li>
      </ul>
    </li>
    <li>Kupujący przyjmuje do wiadomości i akceptuje, że proces dystrybucji voucherów nie stanowi działalności
    regulowanej, w tym m.in.: zarządzania funduszami inwestycyjnymi, oferty publicznej, usług płatniczych,
    działalności bankowej, ubezpieczeniowej ani żadnej innej działalności wymagającej licencji, zezwolenia lub
    wpisu do rejestru działalności regulowanej.<br/>
    Voucher jest przypisany imiennie do uczestnika programu; nie może być przekazany osobie trzeciej ani
    wymieniony na środki płatnicze. Architektura platformy EBS technicznie wyklucza cesję, sprzedaż i
    wymianę vouchera na gotówkę – co stanowi warunek kwalifikacji AML/KNF oraz ZUS.</li>
  </ol>
</div>

<div class="section-title">§ 7 Obowiązywanie Umowy</div>
<div class="section-body">
  <ol>
    <li>Niniejsza Umowa wchodzi w życie z dniem jej podpisania.</li>
    <li>Umowa zostaje zawarta na czas realizacji niniejszego zlecenia i wygasa z chwilą jego zakończenia.</li>
    <li>Stronom przysługuje prawo odstąpienia od Umowy ze skutkiem natychmiastowym w przypadku naruszenia
    jej postanowień przez którąkolwiek ze Stron, w terminie 7 dni od uzyskania informacji o naruszeniu.</li>
  </ol>
</div>

<div class="section-title">§ 8 Postanowienia końcowe</div>
<div class="section-body">
  <ol>
    <li>Wszelkie zmiany niniejszej Umowy wymagają formy pisemnej pod rygorem nieważności. W sprawach
    nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności ustawy z 23.04.1964 r. –
    Kodeks cywilny (t.j. Dz.U. z 2024 r. poz. 1061).</li>
    <li>Wszelkie spory wynikłe z niniejszej Umowy rozstrzygane będą przez sąd powszechny właściwy ze względu
    na siedzibę Sprzedawcy.</li>
    <li>Ilustracja wskazana w §2 stanowi integralną część niniejszej Umowy.</li>
    <li>Umowa sporządzona została w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.</li>
  </ol>
</div>

<div class="signatures">
  <div class="sign-block">
    <div class="sign-line"></div>
    <div class="sign-label">
      <b>SPRZEDAWCA</b><br/>
      Stratton Prime Sp. z o.o.<br/>
      Natalia Juszkiewicz – Prezes Zarządu
    </div>
  </div>
  <div class="sign-block">
    <div class="sign-line"></div>
    <div class="sign-label">
      <b>KUPUJĄCY</b><br/>
      ${buyerName}<br/>
      imię, nazwisko, stanowisko
    </div>
  </div>
</div>

</body>
</html>`;
}

const UMOWA_PDF_OPTIONS: Record<string, unknown> = {
  displayHeaderFooter: true,
  headerTemplate: [
    '<div style="width:100%;display:flex;justify-content:space-between;align-items:center;',
    'font-size:8px;font-family:Arial,sans-serif;color:#555;',
    'border-bottom:1px solid #ccc;padding:0 83px 4px 83px;box-sizing:border-box;">',
    '<span><b>ELITON PRIME™</b> | UMOWA ZLECENIA NABYCIA VOUCHERÓW</span>',
    '<span>Stratton Prime Sp. z o.o. | stratton-prime.pl</span>',
    '</div>',
  ].join(''),
  footerTemplate: [
    '<div style="width:100%;text-align:center;',
    'font-size:7px;font-family:Arial,sans-serif;color:#888;',
    'border-top:1px solid #ddd;padding:4px 83px 0 83px;box-sizing:border-box;">',
    'Dokument poufny – przeznaczony dla klienta Stratton Prime. Wersja marzec 2026',
    ' &nbsp;|  Strona <span class="pageNumber"></span> z <span class="totalPages"></span>',
    '</div>',
  ].join(''),
  margin: { top: '16mm', bottom: '14mm', left: '22mm', right: '22mm' },
};

/**
 * Generuje PDF Umowy Zlecenia Nabycia Voucherów,
 * zapisuje w Supabase Storage i zwraca podpisany URL.
 */
export async function createUmowaDocument(ctx: UmowaContext): Promise<string | null> {
  const html = buildUmowaHtml(ctx);
  const buffer = await generatePdfBuffer(html, UMOWA_PDF_OPTIONS);
  if (!buffer) return null;

  const supabase = supabaseServer();
  const dateSlug = new Date(ctx.contractDate).toISOString().slice(0, 10);
  const safeOrderId = ctx.orderId.slice(-8).toUpperCase();

  return uploadPdf(supabase, `umowa/${dateSlug}_${safeOrderId}.pdf`, buffer);
}
