/**
 * Generator HTML oferty Eliton Benefits System — 5-stronicowa wersja sprzedażowa.
 * Wykorzystywany przez API `/api/crm/offers/generate`, HTML wysyłany do
 * PDF servera (Puppeteer) → /api/generate-pdf-raw.
 *
 * Sales psychology — zastosowane chwyty:
 *   • Cover: personalizacja ("Oferta dla [Klient]") = poczucie unikalności
 *   • Strona 2 (bóle): pre-suasion przez identyfikację problemu
 *   • Strona 3 (wynik): liczbowy hook "anchor" — pokazuje ROCZNĄ oszczędność
 *     na samej górze (efekt zakotwiczenia) + porównawcze paski (loss aversion)
 *   • Strona 4 (legal): authority via 6 filarów (social proof prawny)
 *   • Strona 5: scarcity ("48h decyzji") + CTA + niskie ryzyko ("bez zobowiązań")
 */

export interface OfferData {
  firma: {
    nazwa: string;
    nip?: string;
    adres?: string;
    miasto?: string;
    kodPocztowy?: string;
    osobaKontaktowa?: string;
    email?: string;
    telefon?: string;
    okres?: string;
  };
  pracownicyCount: number;
  provisionPct: number;
  podsumowanie: {
    sumaKosztStandard: number;
    sumaKosztSplit: number;
    oszczednoscBrutto: number;
    oszczednoscNetto: number;
    oszczednoscRoczna: number;
    prowizja: number;
    sredniaOszczednoscNaEtat: number;
  };
  advisor: {
    name: string;
    email?: string;
  };
  logoDataUri?: string;
}

const TEAL   = '#4a95a9';
const GOLD   = '#f0a500';
const NAVY   = '#1e3448';
const GREEN  = '#16a34a';
const RED    = '#dc2626';
const PAPER  = '#f8fafc';
const INK    = '#1e293b';

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
}

function fmtMoneyDec(n: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function todayPl(): string {
  return new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function renderOfferHtml(data: OfferData): string {
  const { firma, pracownicyCount, provisionPct, podsumowanie: p, advisor, logoDataUri } = data;

  // Skala pasków porównawczych
  const standardPct = 100;
  const ofertowyPct = (p.sumaKosztSplit / p.sumaKosztStandard) * 100;
  const savingsPct  = ((p.oszczednoscBrutto / p.sumaKosztStandard) * 100).toFixed(1);

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Oferta Eliton Benefits System — ${escape(firma.nazwa)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  html, body { width: 210mm; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: ${INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .page {
    width: 210mm;
    height: 297mm;
    padding: 18mm 16mm;
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  /* ── COVER (page 1) ───────────────────────────────────────── */
  .cover {
    background: linear-gradient(135deg, ${NAVY} 0%, ${TEAL} 100%);
    color: white;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .cover-header {
    padding: 18mm 16mm 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .cover-logo {
    background: white;
    padding: 24px 42px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    height: 144px;
  }
  .cover-logo img { height: 96px; width: auto; display: block; }
  .cover-logo-text {
    color: ${NAVY};
    font-weight: 800;
    font-size: 14pt;
    letter-spacing: 1px;
  }
  .page-header-logo-img { height: 66px; width: auto; display: block; }
  .cover-meta {
    text-align: right;
    font-size: 9pt;
    opacity: 0.85;
    line-height: 1.5;
  }
  .cover-body {
    flex: 1;
    padding: 0 16mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .cover-eyebrow {
    text-transform: uppercase;
    letter-spacing: 4px;
    font-size: 9pt;
    color: ${GOLD};
    font-weight: 600;
    margin-bottom: 12px;
  }
  .cover-title {
    font-size: 36pt;
    font-weight: 800;
    line-height: 1.05;
    margin-bottom: 10px;
  }
  .cover-subtitle {
    font-size: 14pt;
    font-weight: 300;
    opacity: 0.9;
    line-height: 1.4;
    margin-bottom: 40px;
  }
  .cover-prepared {
    border-left: 3px solid ${GOLD};
    padding: 8px 18px;
    background: rgba(255,255,255,0.06);
    border-radius: 0 8px 8px 0;
  }
  .cover-prepared-label {
    font-size: 8pt;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 4px;
  }
  .cover-prepared-name {
    font-size: 22pt;
    font-weight: 700;
  }
  .cover-prepared-detail {
    font-size: 10pt;
    opacity: 0.8;
    margin-top: 4px;
  }
  .cover-footer {
    padding: 0 16mm 18mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 9pt;
  }
  .cover-footer-block {
    opacity: 0.85;
    line-height: 1.6;
  }
  .cover-tagline {
    font-style: italic;
    opacity: 0.95;
    font-size: 11pt;
  }

  /* ── CONTENT PAGES ───────────────────────────────────────── */
  .content {
    background: ${PAPER};
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 3mm;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 4mm;
  }
  .page-header-logo {
    font-weight: 800;
    color: ${NAVY};
    font-size: 11pt;
    letter-spacing: 1px;
  }
  .page-header-meta {
    font-size: 8pt;
    color: #64748b;
  }
  .page-footer {
    position: absolute;
    bottom: 10mm;
    left: 16mm;
    right: 16mm;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
  }
  h1.section-title {
    font-size: 24pt;
    color: ${NAVY};
    font-weight: 800;
    margin-bottom: 4px;
    line-height: 1.1;
  }
  .section-eyebrow {
    font-size: 9pt;
    color: ${TEAL};
    text-transform: uppercase;
    letter-spacing: 3px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .section-lead {
    font-size: 11pt;
    color: #475569;
    line-height: 1.5;
    margin-bottom: 10mm;
    max-width: 145mm;
  }

  /* ── 3 bóle (page 2) ───────────────────────────────────────── */
  .pain-grid {
    display: flex;
    flex-direction: column;
    gap: 6mm;
  }
  .pain-card {
    background: white;
    border-radius: 12px;
    padding: 5mm 6mm;
    border-left: 4px solid ${RED};
    box-shadow: 0 2px 12px rgba(15,23,42,0.04);
    display: flex;
    gap: 6mm;
    align-items: flex-start;
  }
  .pain-num {
    font-size: 32pt;
    font-weight: 800;
    color: ${RED};
    opacity: 0.25;
    line-height: 1;
    min-width: 50px;
  }
  .pain-body h3 {
    color: ${NAVY};
    font-size: 12pt;
    margin-bottom: 3mm;
    font-weight: 700;
  }
  .pain-body p {
    font-size: 10pt;
    line-height: 1.55;
    color: #475569;
  }
  .pain-conclusion {
    margin-top: 8mm;
    background: linear-gradient(135deg, ${TEAL}10 0%, ${GOLD}10 100%);
    border: 1px solid ${TEAL}40;
    border-radius: 12px;
    padding: 5mm 6mm;
  }
  .pain-conclusion-title {
    color: ${TEAL};
    font-size: 11pt;
    font-weight: 700;
    margin-bottom: 2mm;
  }
  .pain-conclusion-text {
    font-size: 10pt;
    color: ${NAVY};
    line-height: 1.5;
  }

  /* ── Twój wynik (page 3) ───────────────────────────────────── */
  .kpi-hero {
    background: linear-gradient(135deg, ${GREEN} 0%, #15803d 100%);
    color: white;
    border-radius: 16px;
    padding: 16mm;
    text-align: center;
    box-shadow: 0 8px 28px rgba(22,163,74,0.25);
    margin-bottom: 6mm;
  }
  .kpi-hero-label {
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 3px;
    opacity: 0.75;
    margin-bottom: 4mm;
    font-weight: 600;
  }
  .kpi-hero-value {
    font-size: 38pt;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 5mm;
    opacity: 0.9;
  }
  .kpi-hero-sub {
    font-size: 26pt;
    font-weight: 400;
    opacity: 1;
    line-height: 1.2;
  }
  .kpi-row {
    display: flex;
    gap: 4mm;
    margin-bottom: 6mm;
  }
  .kpi-card {
    flex: 1;
    background: white;
    border-radius: 12px;
    padding: 4mm 5mm;
    border: 1px solid #e2e8f0;
  }
  .kpi-card-label {
    font-size: 7.5pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 600;
    margin-bottom: 2mm;
  }
  .kpi-card-value {
    font-size: 16pt;
    font-weight: 800;
    color: ${NAVY};
    line-height: 1.1;
  }
  .kpi-card-value.teal { color: ${TEAL}; }
  .kpi-card-value.gold { color: ${GOLD}; }
  .kpi-card-value.green { color: ${GREEN}; }

  /* Wykres porównawczy */
  .chart-block {
    background: white;
    border-radius: 12px;
    padding: 6mm;
    border: 1px solid #e2e8f0;
  }
  .chart-title {
    font-size: 11pt;
    font-weight: 700;
    color: ${NAVY};
    margin-bottom: 5mm;
  }
  .bar-row {
    margin-bottom: 4mm;
  }
  .bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    margin-bottom: 2mm;
  }
  .bar-label .name { color: #475569; font-weight: 500; }
  .bar-label .value { color: ${NAVY}; font-weight: 700; }
  .bar-track {
    height: 8mm;
    background: #f1f5f9;
    border-radius: 6px;
    overflow: hidden;
    position: relative;
  }
  .bar-fill {
    height: 100%;
    border-radius: 6px;
    display: flex;
    align-items: center;
    padding-left: 3mm;
    color: white;
    font-size: 8pt;
    font-weight: 600;
  }
  .bar-fill.standard { background: linear-gradient(90deg, #64748b 0%, #475569 100%); }
  .bar-fill.ofertowy { background: linear-gradient(90deg, ${TEAL} 0%, #2d7a8a 100%); }
  .savings-callout {
    margin-top: 5mm;
    padding: 4mm 5mm;
    background: ${GREEN}15;
    border-left: 3px solid ${GREEN};
    border-radius: 0 8px 8px 0;
    font-size: 10pt;
    color: ${NAVY};
  }
  .savings-callout strong { color: ${GREEN}; }

  /* ── Filary prawne (page 4) ────────────────────────────────── */
  .pillar-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5mm;
  }
  .pillar {
    background: white;
    border-radius: 10px;
    padding: 4mm 5mm;
    border-top: 3px solid ${TEAL};
    box-shadow: 0 1px 4px rgba(15,23,42,0.04);
  }
  .pillar-num {
    display: inline-block;
    width: 7mm;
    height: 7mm;
    background: ${TEAL};
    color: white;
    border-radius: 50%;
    text-align: center;
    line-height: 7mm;
    font-weight: 800;
    font-size: 9pt;
    margin-bottom: 2mm;
  }
  .pillar-title {
    font-size: 9pt;
    font-weight: 700;
    color: ${NAVY};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2mm;
  }
  .pillar-text {
    font-size: 8.5pt;
    color: #475569;
    line-height: 1.4;
  }
  .pillar-cite {
    font-size: 7.5pt;
    color: #94a3b8;
    margin-top: 2mm;
    font-style: italic;
  }

  /* ── 4 kroki + CTA (page 5) ────────────────────────────────── */
  .steps-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5mm;
    margin-bottom: 8mm;
  }
  .step-card {
    background: white;
    border-radius: 10px;
    padding: 5mm;
    border: 1px solid #e2e8f0;
    position: relative;
    padding-left: 14mm;
  }
  .step-num {
    position: absolute;
    left: 4mm;
    top: 5mm;
    width: 8mm;
    height: 8mm;
    background: ${GOLD};
    color: white;
    border-radius: 50%;
    text-align: center;
    line-height: 8mm;
    font-weight: 800;
    font-size: 11pt;
  }
  .step-title {
    font-weight: 700;
    color: ${NAVY};
    font-size: 10pt;
    margin-bottom: 2mm;
  }
  .step-text {
    font-size: 9pt;
    color: #475569;
    line-height: 1.4;
  }
  .step-meta {
    font-size: 7.5pt;
    color: ${TEAL};
    font-weight: 600;
    margin-top: 2mm;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .cta-block {
    background: linear-gradient(135deg, ${NAVY} 0%, ${TEAL} 100%);
    color: white;
    border-radius: 14px;
    padding: 7mm;
    text-align: center;
    margin-bottom: 6mm;
  }
  .cta-title {
    font-size: 16pt;
    font-weight: 700;
    margin-bottom: 3mm;
  }
  .cta-sub {
    font-size: 10pt;
    opacity: 0.9;
    margin-bottom: 5mm;
    line-height: 1.5;
  }
  .cta-tags {
    display: flex;
    gap: 3mm;
    justify-content: center;
    margin-bottom: 5mm;
    flex-wrap: wrap;
  }
  .cta-tag {
    background: rgba(255,255,255,0.15);
    padding: 2mm 4mm;
    border-radius: 6px;
    font-size: 9pt;
    font-weight: 600;
  }
  .cta-contact {
    border-top: 1px solid rgba(255,255,255,0.2);
    padding-top: 4mm;
    font-size: 10pt;
    line-height: 1.6;
  }
  .cta-contact strong { color: ${GOLD}; }

  .disclaimer {
    margin-top: 4mm;
    font-size: 7pt;
    color: #94a3b8;
    line-height: 1.5;
    text-align: justify;
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  .pill {
    display: inline-block;
    padding: 1mm 3mm;
    border-radius: 4px;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .pill-teal { background: ${TEAL}15; color: ${TEAL}; }
  .pill-gold { background: ${GOLD}15; color: ${GOLD}; }
  .pill-green { background: ${GREEN}15; color: ${GREEN}; }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════
     STRONA 1 — COVER
     ═══════════════════════════════════════════════════════════════════ -->
<section class="page cover">
  <div class="cover-header">
    <div class="cover-logo">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="Eliton Benefits System">` : `<span class="cover-logo-text">EBS</span>`}
    </div>
    <div class="cover-meta">
      Oferta nr ${shortId()}<br>
      ${todayPl()}
    </div>
  </div>

  <div class="cover-body">
    <div class="cover-eyebrow">Indywidualna oferta wdrożenia</div>
    <h1 class="cover-title">Eliton Benefits<br>System</h1>
    <p class="cover-subtitle">Restrukturyzacja kosztów pracowniczych<br>oparta na świadczeniach rzeczowych</p>

    <div class="cover-prepared">
      <div class="cover-prepared-label">Oferta przygotowana dla</div>
      <div class="cover-prepared-name">${escape(firma.nazwa)}</div>
      <div class="cover-prepared-detail">
        ${firma.nip ? 'NIP: ' + escape(firma.nip) : ''}
        ${firma.miasto ? ' · ' + escape(firma.miasto) : ''}
        ${firma.osobaKontaktowa ? ' · Kontakt: ' + escape(firma.osobaKontaktowa) : ''}
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="cover-footer-block">
      <strong>Twój doradca:</strong><br>
      ${escape(advisor.name)}<br>
      ${advisor.email ? escape(advisor.email) : 'biuro@stratton-prime.pl'}
    </div>
    <div class="cover-footer-block cover-tagline">
      „Razem zwiększymy<br>wartość w ludziach"
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════
     STRONA 2 — 3 BÓLE
     ═══════════════════════════════════════════════════════════════════ -->
<section class="page content">
  <div class="page-header">
    <div class="page-header-logo">${logoDataUri ? `<img class="page-header-logo-img" src="${logoDataUri}" alt="EBS">` : 'EBS · Eliton Benefits'}</div>
    <div class="page-header-meta">www.stratton-prime.pl</div>
  </div>

  <div class="section-eyebrow">Diagnoza · 3 bariery rozwoju</div>
  <h1 class="section-title">Czy te wyzwania hamują rozwój Twojej firmy?</h1>
  <p class="section-lead">
    Obecny system i sytuacja rynkowa sprawiają, że przedsiębiorcy każdego dnia mierzą się
    z trzema barierami uderzającymi w rentowność i stabilność biznesu. Zanim porozmawiamy
    o rozwiązaniach — spójrzmy prawdzie w oczy.
  </p>

  <div class="pain-grid">
    <div class="pain-card">
      <div class="pain-num">01</div>
      <div class="pain-body">
        <h3>Stale rosnące koszty płacowe i obciążenia ZUS / PIT</h3>
        <p>Każda złotówka, którą pracownik dostaje „na rękę", kosztuje firmę nieproporcjonalnie więcej.
        Klasyczne koszty zatrudnienia (brutto-brutto) duszą budżety i stają się główną barierą blokującą inwestycje.</p>
      </div>
    </div>

    <div class="pain-card">
      <div class="pain-num">02</div>
      <div class="pain-body">
        <h3>Wysoka rotacja i trudność utrzymania talentów</h3>
        <p>Standardowa umowa i „owocowe czwartki" to dziś za mało. Zespoły odchodzą do konkurencji,
        a koszty rekrutacji, traconego czasu i wdrażania nowych pracowników drastycznie obniżają efektywność.</p>
      </div>
    </div>

    <div class="pain-card">
      <div class="pain-num">03</div>
      <div class="pain-body">
        <h3>Brak realnego zabezpieczenia na przyszłość</h3>
        <p>Pracownicy odczuwają niepewność emerytalną, a pracodawcom brakuje narzędzi, które trwale
        wiążą zespół z firmą. Brak stabilnych perspektyw finansowych niszczy długofalową motywację.</p>
      </div>
    </div>
  </div>

  <div class="pain-conclusion">
    <div class="pain-conclusion-title">Wniosek</div>
    <div class="pain-conclusion-text">
      Tradycyjne modele wynagradzania wymagają aktualizacji. System, w którym obydwie strony tracą potencjał
      — <strong>można legalnie zmienić</strong>. Eliton Benefits System to autorski model wynagradzania oparty na
      świadczeniach rzeczowych — <strong>stabilny, zgodny z prawem polskim, zaprojektowany z myślą o ludziach.</strong>
    </div>
  </div>

  <div class="page-footer">
    <div>EBS · Strona 2 / 5</div>
    <div>Oferta dla ${escape(firma.nazwa)}</div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════
     STRONA 3 — TWÓJ WYNIK (liczby + wykres)
     ═══════════════════════════════════════════════════════════════════ -->
<section class="page content">
  <div class="page-header">
    <div class="page-header-logo">${logoDataUri ? `<img class="page-header-logo-img" src="${logoDataUri}" alt="EBS">` : 'EBS · Eliton Benefits'}</div>
    <div class="page-header-meta">www.stratton-prime.pl</div>
  </div>

  <div class="section-eyebrow">Twoja kalkulacja · indywidualne wyliczenie</div>
  <h1 class="section-title">Tyle zostaje w Twojej firmie</h1>
  <p class="section-lead">
    Symulacja oparta na ${pracownicyCount} pracowniku${pracownicyCount === 1 ? '' : pracownicyCount < 5 ? 'ach' : 'ach'}
    przy prowizji EBS ${provisionPct.toFixed(1)}%. Kalkulacja ma charakter ilustracyjny;
    rzeczywiste wyniki zależą od struktury zatrudnienia.
  </p>

  <!-- HERO: roczna oszczędność (anchor effect) -->
  <div class="kpi-hero">
    <div class="kpi-hero-label">Roczna oszczędność netto</div>
    <div class="kpi-hero-value">${fmtMoney(p.oszczednoscRoczna)} zł</div>
    <div class="kpi-hero-sub">${fmtMoney(p.oszczednoscNetto)} zł miesięcznie · ${fmtMoney(p.sredniaOszczednoscNaEtat)} zł na etat</div>
  </div>

  <!-- 4 KPI -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-card-label">Koszt Standard / mies.</div>
      <div class="kpi-card-value">${fmtMoney(p.sumaKosztStandard)} zł</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card-label">Koszt Ofertowy / mies.</div>
      <div class="kpi-card-value teal">${fmtMoney(p.sumaKosztSplit)} zł</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card-label">Oszczędność całkowita / mies.</div>
      <div class="kpi-card-value green">${fmtMoney(p.oszczednoscBrutto)} zł</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card-label">Prowizja EBS / mies.</div>
      <div class="kpi-card-value gold">${fmtMoney(p.prowizja)} zł</div>
    </div>
  </div>

  <!-- Wykres porównawczy -->
  <div class="chart-block">
    <div class="chart-title">Koszt miesięczny — porównanie modeli</div>

    <div class="bar-row">
      <div class="bar-label"><span class="name">Model Standard (obecny)</span><span class="value">${fmtMoneyDec(p.sumaKosztStandard)} zł</span></div>
      <div class="bar-track">
        <div class="bar-fill standard" style="width: ${standardPct}%">100%</div>
      </div>
    </div>

    <div class="bar-row">
      <div class="bar-label"><span class="name">Model Ofertowy EBS</span><span class="value">${fmtMoneyDec(p.sumaKosztSplit)} zł</span></div>
      <div class="bar-track">
        <div class="bar-fill ofertowy" style="width: ${ofertowyPct.toFixed(1)}%">${ofertowyPct.toFixed(1)}%</div>
      </div>
    </div>

    <div class="savings-callout">
      <strong>Tyle zostaje w Twojej firmie:</strong> ${fmtMoneyDec(p.oszczednoscBrutto)} zł / mies.
      (${savingsPct}% redukcji kosztu) — przy zachowaniu identycznego netto na rękę dla pracownika.
    </div>
  </div>

  <div class="page-footer">
    <div>EBS · Strona 3 / 5</div>
    <div>Wartości ilustracyjne dla ${escape(firma.nazwa)}</div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════
     STRONA 4 — PODSTAWY PRAWNE (3 kluczowe filary)
     ═══════════════════════════════════════════════════════════════════ -->
<section class="page content">
  <div class="page-header">
    <div class="page-header-logo">${logoDataUri ? `<img class="page-header-logo-img" src="${logoDataUri}" alt="EBS">` : 'EBS · Eliton Benefits'}</div>
    <div class="page-header-meta">www.stratton-prime.pl</div>
  </div>

  <div class="section-eyebrow">Podstawy prawne · Ugruntowany przepis · Potwierdzona praktyka</div>
  <h1 class="section-title">Legalność potwierdzona od 28 lat</h1>
  <p class="section-lead">
    Model Eliton Benefits System opiera się na aktach prawnych obowiązujących w polskim systemie prawnym
    <strong>nieprzerwanie od 1998 roku</strong> — uzupełnionych o orzecznictwo Sądu Najwyższego i oficjalne
    interpretacje ZUS.
  </p>

  <div class="pillar-grid">
    <div class="pillar">
      <div class="pillar-num">1</div>
      <div class="pillar-title">Rozp. MPiPS · 1998</div>
      <div class="pillar-text">Korzyści materialne uprawniające do nabycia usług po cenie niższej niż detaliczna są wyłączone z podstawy wymiaru składek ZUS. Kluczowa podstawa modelu EBS.</div>
      <div class="pillar-cite">Dz.U. 1998 nr 161 poz. 1106 · §2 ust. 1 pkt 26</div>
    </div>

    <div class="pillar">
      <div class="pillar-num">2</div>
      <div class="pillar-title">Wyrok SN · 2010</div>
      <div class="pillar-text">Sąd Najwyższy potwierdził, że uchwała Zarządu jest wystarczającą formą „przepisów o wynagradzaniu". Spółki z o.o. i akcyjne mogą wdrożyć model w pełni legalnie aktem korporacyjnym.</div>
      <div class="pillar-cite">SN II UK 337/09 · 6.05.2010</div>
    </div>

    <div class="pillar">
      <div class="pillar-num">3</div>
      <div class="pillar-title">Interpretacja ZUS · 2023</div>
      <div class="pillar-text">ZUS oficjalnie potwierdza, że do zwolnienia ze składek wystarczy prosta wewnętrzna instrukcja współfinansowania. Obejmuje to również zleceniobiorców.</div>
      <div class="pillar-cite">DI/100000/43/620/2023 · 24.08.2023</div>
    </div>

    <div class="pillar">
      <div class="pillar-num">4</div>
      <div class="pillar-title">Ustawa o PIT</div>
      <div class="pillar-text">Różnica między wartością świadczenia a odpłatnością pracownika stanowi jego przychód — legalnie opodatkowany i ujmowany w deklaracji PIT-11. Pełna przejrzystość wobec US.</div>
      <div class="pillar-cite">t.j. Dz.U. 2024 poz. 226 ze zm.</div>
    </div>

    <div class="pillar">
      <div class="pillar-num">5</div>
      <div class="pillar-title">Opinia prawna · 2026</div>
      <div class="pillar-text">Kancelaria <em>[…]</em> wydała opinię potwierdzającą zgodność modelu z przepisami prawa pracy, cywilnego, podatkowego i ubezpieczeniowego — w tym pełną kwalifikację CIT i PIT.</div>
      <div class="pillar-cite">Opinia dotyczy modelu analogicznego do oferowanego</div>
    </div>

    <div class="pillar">
      <div class="pillar-num">6</div>
      <div class="pillar-title">Reforma PIP · 2026</div>
      <div class="pillar-text">Wzmocniona wymiana danych ZUS / PIP / KAS. Model EBS jest zaprojektowany tak, by przejść każdą kontrolę krzyżową — pełna ścieżka audytowa i kompletna dokumentacja.</div>
      <div class="pillar-cite">Rada Ministrów · luty 2026</div>
    </div>
  </div>

  <div class="page-footer">
    <div>EBS · Strona 4 / 5</div>
    <div>6 filarów prawnych</div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════
     STRONA 5 — 4 KROKI + CTA + ZASTRZEŻENIA
     ═══════════════════════════════════════════════════════════════════ -->
<section class="page content">
  <div class="page-header">
    <div class="page-header-logo">${logoDataUri ? `<img class="page-header-logo-img" src="${logoDataUri}" alt="EBS">` : 'EBS · Eliton Benefits'}</div>
    <div class="page-header-meta">www.stratton-prime.pl</div>
  </div>

  <div class="section-eyebrow">Proces współpracy</div>
  <h1 class="section-title">4 kroki do wdrożenia</h1>

  <div class="steps-grid">
    <div class="step-card">
      <div class="step-num">1</div>
      <div class="step-title">Wstępna rozmowa</div>
      <div class="step-text">Doradca weryfikuje kwalifikowalność Twojej firmy. Omawiamy kluczowe założenia modelu.</div>
      <div class="step-meta">15 min · bez zobowiązań</div>
    </div>

    <div class="step-card">
      <div class="step-num">2</div>
      <div class="step-title">Zanonimizowana lista płac</div>
      <div class="step-text">Wysyłamy prosty wzór + projekt umowy ramowej. Dane przetwarzane wyłącznie do kalkulacji.</div>
      <div class="step-meta">RODO · zanonimizowane</div>
    </div>

    <div class="step-card">
      <div class="step-num">3</div>
      <div class="step-title">Kalkulacja i warianty</div>
      <div class="step-text">Doradca prezentuje indywidualnie obliczone wyliczenia i dostępne warianty. Priorytetowe wdrożenie po decyzji.</div>
      <div class="step-meta">max. 48h · Twoja decyzja</div>
    </div>

    <div class="step-card">
      <div class="step-num">4</div>
      <div class="step-title">Wdrożenie + monitoring</div>
      <div class="step-text">Aktualizujemy dokumenty wewnętrzne, szkolimy kadry i księgowość. Bieżący monitoring zgodności prawnej.</div>
      <div class="step-meta">5 dni roboczych · PLUS = 14 dni</div>
    </div>
  </div>

  <div class="cta-block">
    <div class="cta-title">Sprawdźmy razem, co zostaje w Twojej firmie</div>
    <div class="cta-sub">Zarezerwuj 15 minut na niezobowiązującą rozmowę z Doradcą Eliton Benefits.</div>
    <div class="cta-tags">
      <span class="cta-tag">Kalkulacja bezpłatna</span>
      <span class="cta-tag">Dane zanonimizowane</span>
      <span class="cta-tag">Odpowiedź w 48h</span>
    </div>
    <div class="cta-contact">
      <strong>www.stratton-prime.pl</strong> · biuro@stratton-prime.pl<br>
      Doradca: ${escape(advisor.name)}${advisor.email ? ' · ' + escape(advisor.email) : ''}
    </div>
  </div>

  <div class="disclaimer">
    <strong>Zastrzeżenia.</strong> Wszystkie wartości liczbowe mają charakter wyłącznie ilustracyjny.
    Rzeczywiste wyniki zależą od struktury zatrudnienia, form umów, liczby pracowników, wieku, stażu i stawek ZUS.
    Stratton Prime sp. z o.o. nie gwarantuje osiągnięcia konkretnych oszczędności — każdy klient otrzymuje
    indywidualną kalkulację opartą na własnych danych. Skuteczność i legalność wdrożenia uzależniona jest
    od prawidłowego spełnienia wszystkich przesłanek z §2 ust. 1 pkt 26 Rozp. MPiPS z 18.12.1998 r.
    Świadczenia EBS mają charakter wyłącznie rzeczowy, nie są instrumentem płatniczym i nie podlegają
    wymianie na gotówkę. Uczestnictwo pracownika jest dobrowolne; odmowa nie wpływa na warunki zatrudnienia.
    Wynagrodzenie zasadnicze nigdy nie spada poniżej ustawowego minimum.
  </div>

  <div class="page-footer">
    <div>EBS · Strona 5 / 5</div>
    <div>Oferta wygenerowana ${todayPl()}</div>
  </div>
</section>

</body>
</html>`;
}

function escape(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shortId(): string {
  return 'EBS-' + Date.now().toString(36).toUpperCase().slice(-6);
}
