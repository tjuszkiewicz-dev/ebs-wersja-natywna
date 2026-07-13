-- 041: edytowalne szablony dokumentów + pdf_url na buyback_agreements (SP3)
CREATE TABLE IF NOT EXISTS document_templates (
  key        TEXT PRIMARY KEY,
  html       TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY; -- dostęp tylko service_role (server)

ALTER TABLE buyback_agreements ADD COLUMN IF NOT EXISTS pdf_url TEXT;

INSERT INTO document_templates (key, html) VALUES ('buyback_agreement',
$html$
<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/><style>
  @page { size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }
  .title { font-size: 16pt; font-weight: 900; text-align: center; margin-bottom: 12pt; color:#1a1a2e; }
  .p { margin-bottom: 7pt; text-align: justify; }
  .sec { font-weight: 700; margin: 12pt 0 5pt; color:#1a1a2e; }
  table { width:100%; border-collapse: collapse; margin: 6pt 0; }
  th { background:#1a1a2e; color:#fff; padding:5pt 8pt; font-size:9pt; text-align:left; }
  td { padding:5pt 8pt; border-bottom:1px solid #ddd; font-size:9.5pt; }
  .sign { display:flex; justify-content:space-between; margin-top:28pt; }
  .sign div { width:45%; text-align:center; }
  .sign .line { border-bottom:1px solid #111; height:30pt; margin-bottom:4pt; }
  b { font-weight:700; }
</style></head><body>
<div class="title">UMOWA ZBYCIA VOUCHERÓW</div>
<p class="p">Zawarta w dniu <b>{{data}}</b> w Gdańsku pomiędzy:</p>
<p class="p">Uczestnik programu Eliton Benefits System: <b>{{imie_nazwisko}}</b>, PESEL / NIP: <b>{{pesel_nip}}</b>,
adres zamieszkania / siedziby: {{adres}}, zwany/a dalej „Zbywającym" lub „Uczestnikiem"</p>
<p class="p" style="text-align:center"><b>a</b></p>
<p class="p"><b>Stratton Prime Sp. z o.o.</b> z siedzibą przy ul. Junony 23/11, 80-299 Gdańsk, wpisaną do rejestru
przedsiębiorców KRS pod numerem: <b>0001169520</b>, NIP: <b>5842867357</b>, REGON: <b>541537557</b>,
reprezentowaną przez: Natalię Juszkiewicz – Prezesa Zarządu, zwaną dalej „Nabywcą" lub „Stratton Prime".</p>
<p class="p">Niniejsza umowa zawierana jest wyłącznie w przypadku rezygnacji Uczestnika z udziału w programie
benefitowym Eliton Benefits System (EBS) i dotyczy zwrotu niezrealizowanych voucherów na rzecz Stratton Prime
Sp. z o.o. Procedura rezygnacji prowadzona jest wyłącznie przez operatora platformy EBS bezpośrednio z
Uczestnikiem – Pracodawca/Zleceniodawca nie jest stroną niniejszej umowy.</p>
<div class="sec">§ 1 Przedmiot Umowy</div>
<p class="p">1. Zbywający przenosi na Nabywcę własność niezrealizowanych voucherów cyfrowych (znaków legitymacyjnych)
zgromadzonych na swoim indywidualnym koncie na platformie EBS, a Nabywca te vouchery nabywa.</p>
<p class="p">2. Vouchery stanowią znaki legitymacyjne w rozumieniu art. 921¹⁵ KC. Przeniesienie własności następuje na
podstawie art. 155 §1 KC – z chwilą podpisania umowy i rozliczenia przez platformę EBS.</p>
<p class="p">3. Przedmiot umowy (zgodnie z Ilustracją nr: <b>{{nr_ilustracji}}</b>):</p>
<table><thead><tr><th>Lp.</th><th>Nazwa</th><th>Liczba (szt.)</th><th>Cena jedn. (PLN)</th><th>Wartość (PLN)</th></tr></thead>
<tbody><tr><td>1</td><td>Voucher EBS (znak legitymacyjny)</td><td>{{liczba_voucherow}}</td><td>1,00</td><td>{{wartosc_pln}}</td></tr>
<tr><td colspan="4" style="text-align:right"><b>RAZEM NETTO (PLN):</b></td><td><b>{{wartosc_pln}}</b></td></tr></tbody></table>
<div class="sec">§ 2 Cena i Warunki Odkupu</div>
<p class="p">1. Cena odkupu = iloczyn liczby voucherów i wartości jednostkowej (1 voucher = 1,00 PLN); identyczna z ceną
zakupu przez Pracodawcę.</p>
<p class="p">2. Transakcja ma charakter zamknięty; cena z góry określona i niezmienna.</p>
<p class="p">3. Zapłata przelewem na numer konta bankowego Zbywającego: <b>{{iban_zbywajacego}}</b></p>
<p class="p">4. Termin zapłaty: 7 dni.</p>
<div class="sec">§ 3 Skutki Zbycia i Utrata Dostępu</div>
<p class="p">1. Z chwilą zawarcia umowy i uiszczenia ceny odkupu Zbywający traci prawa do zbywanych voucherów, w tym prawo
dostępu i korzystania z usług katalogu EBS w tym zakresie.</p>
<p class="p">2. Platforma EBS blokuje zbyte vouchery niezwłocznie po zatwierdzeniu, nie później niż w 2 dni robocze.</p>
<div class="sec">§ 4 Status podatkowy i składkowy</div>
<p class="p">1. Zbycie voucherów nie stanowi przychodu z kapitałów pieniężnych ani praw majątkowych w rozumieniu ustawy o PIT.</p>
<p class="p">2. Transakcja to zwrot świadczenia niepieniężnego (znaku legitymacyjnego) do emitenta. Dla podatnika VAT stosuje
się art. 8b ustawy o VAT (MPV).</p>
<div class="sec">§ 5 Oświadczenia Zbywającego</div>
<p class="p">1. Zbywający oświadcza, że jest jedynym uprawnionym do voucherów i nie są one obciążone prawami osób trzecich.</p>
<p class="p">2. Dobrowolnie rezygnuje z udziału w EBS i zbywa vouchery z własnej woli, bez nacisku Pracodawcy.</p>
<div class="sec">§ 6 Zawiadomienia</div>
<p class="p">Nabywca (Stratton Prime): bok@stratton-prime.pl &nbsp;|&nbsp; Zbywający: {{email_zbywajacego}}</p>
<div class="sec">§ 7 Postanowienia końcowe</div>
<p class="p">1. Zmiany umowy wymagają formy pisemnej. W sprawach nieuregulowanych – Kodeks cywilny.</p>
<p class="p">2. Spory rozstrzyga sąd właściwy dla siedziby Nabywcy. Umowę sporządzono w dwóch egzemplarzach.</p>
<div class="sign"><div><div class="line"></div>ZBYWAJĄCY (UCZESTNIK)<br/>{{imie_nazwisko}}</div>
<div><div class="line"></div>NABYWCA<br/>Stratton Prime Sp. z o.o.<br/>Natalia Juszkiewicz – Prezes Zarządu</div></div>
</body></html>
$html$
) ON CONFLICT (key) DO NOTHING;
