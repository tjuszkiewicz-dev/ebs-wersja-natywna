# SP3 — Umowa odkupu: edytowalny szablon + serwerowy PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development lub superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Umowa Zbycia (odkupu) Voucherów jest trzymana jako edytowalny w panelu admina szablon HTML z polami-zmiennymi; system generuje z niej serwerowy PDF z danymi konkretnego pracownika i zapisuje jego URL na rekordzie odkupu.

**Architecture:** Nowa tabela `document_templates(key, html, ...)` z ziarnem `buyback_agreement`. Czysty silnik `renderTemplate(html, vars)` podstawia `{{pola}}`. Serwis `buybackAgreementService.createBuybackAgreementPdf(agreementId)` łączy szablon + rekord `buyback_agreements` + dane pracownika z `user_profiles`, renderuje HTML → PDF (Puppeteer `generatePdfBuffer` + `uploadPdf`) → zapisuje `buyback_agreements.pdf_url`. Panel admina: nowa zakładka „Szablony dokumentów" (edytor + lista pól + zapis przez `PATCH /api/admin/document-templates/[key]`).

**Tech Stack:** Next.js 15, Supabase (Postgres + Storage), TypeScript, Vitest, Zod, Puppeteer PDF-serwer (Railway).

## Global Constraints

- Migracje rosnąco/unikalnie; następna wolna: `041_*.sql`.
- Szablon w bazie; **dane Nabywcy (Stratton) — poprawne, zgodne z `ISSUER`** (`lib/documents/pdfUtils.ts`): Stratton Prime **Sp. z o.o.**, ul. Junony 23/11, 80-299 Gdańsk, KRS 0001169520, NIP 5842867357, REGON 541537557 (NIE „S.A. Warszawa" z martwego komponentu React).
- Pola-zmienne (dokładnie te): `{{imie_nazwisko}}`, `{{pesel_nip}}`, `{{adres}}`, `{{nr_ilustracji}}`, `{{liczba_voucherow}}`, `{{wartosc_pln}}`, `{{iban_zbywajacego}}`, `{{email_zbywajacego}}`, `{{data}}`.
- `renderTemplate` zastępuje wszystkie wystąpienia `{{klucz}}`; brak wartości → pusty string; **wynik nie może zawierać nietkniętych `{{...}}`** dla znanych kluczy.
- PDF: bucket `financial-documents`, ścieżka `buyback/YYYY-MM-DD_XXXXXXXX.pdf`, podpisany URL ~10 lat. Awaria PDF-serwera → serwis zwraca `null` (nie wywala flow).
- Edycja szablonu: **tylko superadmin**.
- Testy przez `npx vitest run`; rdzeń (`renderTemplate`) testowany jednostkowo; migracja/API/UI = `tsc`+`build`+weryfikacja manualna.
- `npx tsc --noEmit` = 0, `npm run build` = sukces po zadaniach TS/React.

---

### Task 1: Silnik szablonu `renderTemplate` (+ testy)

**Files:**
- Create: `lib/documents/templateEngine.ts`
- Test: `lib/documents/templateEngine.test.ts`

**Interfaces:**
- Produces: `renderTemplate(html: string, vars: Record<string, string | number | null | undefined>): string` — zamienia `{{klucz}}` (z opcjonalnymi spacjami: `{{ klucz }}`) na `String(vars[klucz] ?? '')`; pozostawia nieznane klucze bez zmian.

- [ ] **Step 1: failing test `lib/documents/templateEngine.test.ts`**
```ts
import { describe, it, expect } from 'vitest';
import { renderTemplate } from './templateEngine';

describe('renderTemplate', () => {
  it('podstawia pola', () => {
    const out = renderTemplate('Cześć {{imie_nazwisko}}, saldo {{liczba_voucherow}} szt.', {
      imie_nazwisko: 'Jan Kowalski', liczba_voucherow: 42,
    });
    expect(out).toBe('Cześć Jan Kowalski, saldo 42 szt.');
  });
  it('toleruje spacje w klamrach i puste wartości', () => {
    expect(renderTemplate('{{ iban_zbywajacego }}|{{email_zbywajacego}}', { iban_zbywajacego: 'PL61', email_zbywajacego: undefined }))
      .toBe('PL61|');
  });
  it('nie rusza nieznanych kluczy', () => {
    expect(renderTemplate('{{znane}} {{obce}}', { znane: 'X' })).toBe('X {{obce}}');
  });
});
```
- [ ] **Step 2: run — FAIL** — `npx vitest run lib/documents/templateEngine.test.ts` (brak modułu).
- [ ] **Step 3: implement `lib/documents/templateEngine.ts`**
```ts
/**
 * Podstawia pola-zmienne postaci {{klucz}} (dopuszcza spacje: {{ klucz }}).
 * Znane klucze zamienia na String(vars[klucz] ?? ''); nieznane pozostawia bez zmian.
 */
export function renderTemplate(
  html: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : match,
  );
}
```
- [ ] **Step 4: run — PASS** — `npx vitest run lib/documents/templateEngine.test.ts` (3 testy).
- [ ] **Step 5: commit**
```bash
git add lib/documents/templateEngine.ts lib/documents/templateEngine.test.ts
git commit -m "feat(docs): renderTemplate - silnik pol-zmiennych {{}} + testy"
```

---

### Task 2: Migracja `041` — `document_templates` + seed + `buyback_agreements.pdf_url`

**Files:**
- Create: `supabase/migrations/041_document_templates.sql`

**Interfaces:**
- Produces: tabela `document_templates(key text PK, html text, updated_by uuid, updated_at timestamptz)`; wiersz `key='buyback_agreement'`; kolumna `buyback_agreements.pdf_url text`.

- [ ] **Step 1: napisz migrację** (pełna treść — seed to HTML umowy odkupu z polami-zmiennymi; dane Nabywcy = Stratton Sp. z o.o. Gdańsk):
```sql
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
```
- [ ] **Step 2: apply** przez Supabase MCP `apply_migration` (name: `document_templates`, project: `ramedybmybcpqvelsmxd`).
- [ ] **Step 3: verify** SQL: `SELECT key, length(html) FROM document_templates;` → `buyback_agreement` z length>1000. `SELECT column_name FROM information_schema.columns WHERE table_name='buyback_agreements' AND column_name='pdf_url';` → 1 wiersz.
- [ ] **Step 4: commit**
```bash
git add supabase/migrations/041_document_templates.sql
git commit -m "feat(db): 041 document_templates + seed buyback_agreement + buyback_agreements.pdf_url"
```

---

### Task 3: `buybackAgreementService.ts` — generacja PDF z szablonu

**Files:**
- Create: `lib/documents/buybackAgreementService.ts`

**Interfaces:**
- Consumes: `renderTemplate` (Task 1); `generatePdfBuffer`, `uploadPdf` z `@/lib/documents/pdfUtils`; `supabaseServer`.
- Produces: `createBuybackAgreementPdf(agreementId: string): Promise<string | null>` — generuje PDF umowy odkupu dla danego rekordu i zapisuje `buyback_agreements.pdf_url`.

- [ ] **Step 1: implement** `lib/documents/buybackAgreementService.ts`
```ts
import { supabaseServer } from '@/lib/supabase';
import { generatePdfBuffer, uploadPdf } from '@/lib/documents/pdfUtils';
import { renderTemplate } from '@/lib/documents/templateEngine';

const PDF_OPTIONS: Record<string, unknown> = {
  margin: { top: '16mm', bottom: '14mm', left: '20mm', right: '20mm' },
};

function fmtPln(n: number): string { return (Number(n) || 0).toFixed(2).replace('.', ',') + ' PLN'; }
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Generuje PDF umowy odkupu dla rekordu buyback_agreements, zapisuje pdf_url i zwraca URL (lub null). */
export async function createBuybackAgreementPdf(agreementId: string): Promise<string | null> {
  const supabase = supabaseServer();

  const { data: agr } = await supabase
    .from('buyback_agreements')
    .select('id, user_id, voucher_count, total_value_pln, date_generated, snapshot')
    .eq('id', agreementId)
    .single();
  if (!agr) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, pesel, iban, contact_email, address_street, address_city, address_zip')
    .eq('id', (agr as any).user_id)
    .single();

  const { data: tpl } = await supabase
    .from('document_templates').select('html').eq('key', 'buyback_agreement').single();
  if (!tpl?.html) return null;

  const snap = ((agr as any).snapshot ?? {}) as Record<string, any>;
  const p = (profile as any) ?? {};
  const address = [p.address_street, p.address_zip, p.address_city].filter(Boolean).join(', ');

  const vars = {
    imie_nazwisko:    snap.name  ?? p.full_name    ?? '',
    pesel_nip:        snap.pesel ?? p.pesel         ?? '',
    adres:            snap.address ?? address       ?? '',
    nr_ilustracji:    String((agr as any).id).slice(-8).toUpperCase(),
    liczba_voucherow: String((agr as any).voucher_count ?? 0),
    wartosc_pln:      fmtPln(Number((agr as any).total_value_pln ?? 0)),
    iban_zbywajacego: snap.iban  ?? p.iban          ?? '',
    email_zbywajacego: snap.email ?? p.contact_email ?? '',
    data:             fmtDate((agr as any).date_generated ?? new Date().toISOString()),
  };

  const html = renderTemplate(tpl.html as string, vars);
  const buffer = await generatePdfBuffer(html, PDF_OPTIONS);
  if (!buffer) return null;

  const dateSlug = new Date((agr as any).date_generated ?? Date.now()).toISOString().slice(0, 10);
  const url = await uploadPdf(supabase, `buyback/${dateSlug}_${String((agr as any).id).slice(-8).toUpperCase()}.pdf`, buffer);
  if (!url) return null;

  await supabase.from('buyback_agreements').update({ pdf_url: url }).eq('id', agreementId);
  return url;
}
```
- [ ] **Step 2: typecheck** `npx tsc --noEmit` → brak błędów w pliku.
- [ ] **Step 3: commit**
```bash
git add lib/documents/buybackAgreementService.ts
git commit -m "feat(docs): buybackAgreementService - serwerowy PDF umowy odkupu z szablonu"
```

---

### Task 4: API `/api/admin/document-templates/[key]` (GET + PATCH, superadmin)

**Files:**
- Create: `app/api/admin/document-templates/[key]/route.ts`

**Interfaces:**
- Produces: `GET` zwraca `{ key, html, updated_at }`; `PATCH` body `{ html }` zapisuje (superadmin).

- [ ] **Step 1: implement**
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

type Params = { params: Promise<{ key: string }> };
const Body = z.object({ html: z.string().min(1) });

export async function GET(_req: NextRequest, { params }: Params) {
  const { key } = await params;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('document_templates').select('key, html, updated_at').eq('key', key).single();
  if (error || !data) return NextResponse.json({ error: 'Nie znaleziono szablonu' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('document_templates')
    .update({ html: parsed.data.html, updated_by: auth.id, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select('key, html, updated_at')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Nie znaleziono szablonu' }, { status: 404 });
  return NextResponse.json(data);
}
```
- [ ] **Step 2: typecheck** `npx tsc --noEmit` → brak błędów.
- [ ] **Step 3: commit**
```bash
git add "app/api/admin/document-templates/[key]/route.ts"
git commit -m "feat(api): admin/document-templates/[key] GET+PATCH (superadmin)"
```

---

### Task 5: Panel admina — zakładka „Szablony dokumentów"

**Files:**
- Create: `components/adminNew/AdminSzablony.tsx`
- Modify: `views/DashboardAdminNew.tsx` (typ `AdminTab`, `VIEW_TO_TAB`, `TAB_TO_VIEW`, `tabs`, switch, import)
- Modify: `components/Sidebar.tsx` (SUPERADMIN menu)

**Interfaces:**
- Consumes: `GET`/`PATCH /api/admin/document-templates/buyback_agreement`.

- [ ] **Step 1: `components/adminNew/AdminSzablony.tsx`**
```tsx
import React, { useEffect, useState } from 'react';
import { Loader2, Save, FileText } from 'lucide-react';

const PLACEHOLDERS = [
  'imie_nazwisko','pesel_nip','adres','nr_ilustracji','liczba_voucherow',
  'wartosc_pln','iban_zbywajacego','email_zbywajacego','data',
];

export default function AdminSzablony() {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/document-templates/buyback_agreement')
      .then(r => r.json()).then(d => { if (d.html) setHtml(d.html); })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/document-templates/buyback_agreement', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `HTTP ${res.status}`); }
      setMsg('Zapisano.');
    } catch (e: any) { setMsg(e.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-slate-400"><Loader2 className="animate-spin inline mr-2" size={16}/>Ładowanie…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-800 font-bold"><FileText size={18}/> Szablon: Umowa odkupu voucherów</div>
      <div className="text-xs text-slate-500">Dostępne pola (wstaw w treści jako <code>{'{{pole}}'}</code>):
        <div className="mt-1 flex flex-wrap gap-1">
          {PLACEHOLDERS.map(p => <span key={p} className="px-2 py-0.5 bg-slate-100 rounded font-mono text-[11px]">{`{{${p}}}`}</span>)}
        </div>
      </div>
      <textarea value={html} onChange={e => setHtml(e.target.value)} spellCheck={false}
        className="w-full h-[520px] p-3 border border-slate-200 rounded-lg font-mono text-xs" />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Zapisz szablon
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
```
- [ ] **Step 2: wire w `views/DashboardAdminNew.tsx`** — 5 edycji:
  1. import: `import AdminSzablony from '../components/adminNew/AdminSzablony';` (dopasuj ścieżkę względną do pozostałych importów adminNew w tym pliku).
  2. `AdminTab` union: dodaj `| 'szablony'`.
  3. `VIEW_TO_TAB`: dodaj `'admin-szablony': 'szablony',`.
  4. `TAB_TO_VIEW`: dodaj `szablony: 'admin-szablony',`.
  5. `tabs` array: dodaj `{ id: 'szablony', label: 'Szablony', icon: <FileText size={16}/> }` (zaimportuj `FileText` z `lucide-react`, jeśli nie ma).
  6. content switch: dodaj `{tab === 'szablony' && <AdminSzablony />}`.
- [ ] **Step 3: wire w `components/Sidebar.tsx`** — do tablicy SUPERADMIN dodaj `{ id: 'admin-szablony', label: 'Szablony dokumentów', icon: <FileText size={20} /> }` (zaimportuj `FileText`, jeśli brak).
- [ ] **Step 4: typecheck + build** — `npx tsc --noEmit` → 0; `npm run build` → sukces.
- [ ] **Step 5: manual verify (dev)** — jako superadmin wejdź „Szablony dokumentów" → edytuj tekst → Zapisz → odśwież → zmiana utrzymana.
- [ ] **Step 6: commit**
```bash
git add components/adminNew/AdminSzablony.tsx views/DashboardAdminNew.tsx components/Sidebar.tsx
git commit -m "feat(ui): admin zakladka 'Szablony dokumentow' - edytor umowy odkupu"
```

---

### Task 6: Dokumentacja + finalna weryfikacja

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: notka CLAUDE.md** — w sekcji dokumentów dopisz: „Umowa odkupu (`buyback_agreement`) — szablon edytowalny w panelu (Admin → Szablony dokumentów, tabela `document_templates`), PDF generowany serwerowo przez `lib/documents/buybackAgreementService.createBuybackAgreementPdf` (pola-zmienne `{{…}}`, `lib/documents/templateEngine`), URL zapisywany w `buyback_agreements.pdf_url`."
- [ ] **Step 2: pełna weryfikacja** — `npx vitest run` → zielone; `npx tsc --noEmit` → 0; `npm run build` → sukces.
- [ ] **Step 3: commit**
```bash
git add CLAUDE.md
git commit -m "docs: umowa odkupu - edytowalny szablon + serwerowy PDF (SP3)"
```

---

## Self-Review
- **Spec coverage:** tabela `document_templates` + seed [Task 2], placeholdery + silnik [Task 1], panel edycji [Task 5], serwis PDF podstawiający dane [Task 3], API zapisu [Task 4], `pdf_url` [Task 2/3]. Pokryte.
- **Placeholder scan:** brak — cały kod i seed HTML podane wprost.
- **Type consistency:** `renderTemplate` (Task 1) używany w Task 3; `document_templates`/`pdf_url` (Task 2) czytane w Task 3/4; zakładka `admin-szablony` spójna w Sidebar+DashboardAdminNew (Task 5).
- **Świadome uproszczenia (poza SP3):** wzbogacenie `snapshot` w funkcji DB `expire_vouchers_and_create_buybacks` o dane pracownika (name/pesel/iban) — należy do SP5 (uruchomienie odkupu); tu serwis czyta dane live z `user_profiles` (fallback do snapshotu). `{{nr_ilustracji}}` = skrót id umowy (do doprecyzowania przy SP5). Wpięcie generacji PDF w automat odkupu = SP5. Zastąpienie klienckiego `window.print()` linkiem do `pdf_url` w UI pracownika/admina = przy SP5.
