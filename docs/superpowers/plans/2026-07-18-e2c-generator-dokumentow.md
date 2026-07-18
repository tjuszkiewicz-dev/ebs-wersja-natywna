# E2c: Agencja — Generator dokumentów + PDF list płac (port z BBS-Unified) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Działający generator dokumentów agencji: edytor szablonów (`hr_doc_templates`), podstawianie 39 placeholderów `{{…}}`, generowanie PDF (HTML→Puppeteer + urzędowy druk PESEL przez pdf-lib) do bucketu `hr-documents`; plus PDF list płac (un-defer z E2b).

**Architecture:** Port `app/api/hr/doc-generate`, `doc-templates`, `settlements/pdf`, `lib/hr/peselForm`, `lib/hr/docRules`, `components/adminNew/hr/HrGeneratorDokumentow` → EBS wg GLOBALNYCH REGUŁ PORTU (jak E2b). Nagłówek dokumentów: EBS `ebs-neon-no-bg.png` (zamiast BBS-owego `znmp-logo`). Spec: `docs/superpowers/specs/2026-07-17-e2-agencja-design.md` §2 E2c.

**Tech Stack:** Next.js 15, Supabase, vitest, `lib/pdf/renderer` (E2a, puppeteer), **`pdf-lib`** (nowa dep — druk PESEL).

## Global Constraints
- Supabase EBS `ramedybmybcpqvelsmxd`. Źródło portu: `C:\Users\Użytkownik\Desktop\BBS-Unified` (read-only).
- Po każdym tasku `npx tsc --noEmit` = 0; przy taskach z route'ami TAKŻE `npx next build` (bramka typów tras). Commit tylko plików taska; niezwiązane brudne pliki repo — nie dotykać.
- Gałąź `feat/e2c-generator` (Task 1 z `main`). Komunikaty/komentarze PL. Commit + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Nowa dep TYLKO `pdf-lib`. Zero nowych migracji (tabela `hr_doc_templates` gotowa z E2a). Zero nowych cronów.

### GLOBALNE REGUŁY PORTU (każdy plik z BBS)
1. `import { admin } from '@/lib/crm/visibility'` → `@/lib/supabaseAdmin`.
2. `import { renderOfferPdfBatch } from '@/lib/crm/offer/pdfRenderer'` → `@/lib/pdf/renderer` (E2a).
3. Usuń `@/lib/audit` + każde `logEvent(...)` (całe statementy; bez pustych try).
4. UI `components/adminNew/hr/X` → `components/agencja/X`; importy `@/components/ui/Hint`, `@/lib/hr/*` zostają.
5. Untyped `hr_*` → `(admin() as any).from('hr_...')` gdzie tsc wymaga.
6. Non-route `export const` w route.ts → bare const (klasa buga T4/E2b).
7. **Logo nagłówka**: w `doc-generate` podmień odwołania `znmp-logo.png`/`znmp-logo.jpg` → `ebs-neon-no-bg.png` (istnieje w EBS `public/`, 49 KB). Dotyczy: argumentów `logoDataUri(...)` ORAZ `.replaceAll('src="/znmp-logo.png"', ...)` / `.replaceAll('src="/znmp-logo.jpg"', ...)` (oba na `/ebs-neon-no-bg.png`).
8. Bez zmian logiki poza 1–7. Wątpliwość → DONE_WITH_CONCERNS.

---

### Task 1: Gałąź + pdf-lib + assety + peselForm + docRules (TDD)
**Files:** Create `lib/hr/peselForm.ts`, `lib/hr/docRules.ts` (kopie z BBS), `public/templates/pesel-elw1.pdf`, `public/fonts/noto-deva.woff2` (kopie binarne z BBS); Modify `package.json`; Test `lib/hr/docRules.test.ts`.
**Interfaces:** Produces `fillPeselForm`, `peselMissingFields` (peselForm); `docCopies`, `pelnomocnictwoFooter` (docRules) — dokładne nazwy z BBS. Konsumowane przez T3/T5.

- [ ] **Step 1:** `git checkout main && git checkout -b feat/e2c-generator`
- [ ] **Step 2:** `npm install pdf-lib`
- [ ] **Step 3:** Skopiuj binarnie assety:
```bash
mkdir -p public/templates public/fonts
cp "C:/Users/Użytkownik/Desktop/BBS-Unified/public/templates/pesel-elw1.pdf" public/templates/
cp "C:/Users/Użytkownik/Desktop/BBS-Unified/public/fonts/noto-deva.woff2" public/fonts/
```
Weryfikacja rozmiarów: `pesel-elw1.pdf` ~918 KB, `noto-deva.woff2` ~50 KB (jeśli 0 B → błąd kopiowania, STOP).
- [ ] **Step 4:** Skopiuj `lib/hr/peselForm.ts`, `lib/hr/docRules.ts` z BBS 1:1 (żadne z nich nie importuje crm/audit — potwierdź `grep -n "lib/crm\|lib/audit\|logEvent" lib/hr/peselForm.ts lib/hr/docRules.ts` → 0). peselForm używa `pdf-lib` + `fs/promises`/`path` — zostają.
- [ ] **Step 5 (TDD):** `lib/hr/docRules.test.ts` — odczytaj faktyczne eksporty docRules; test na `docCopies`/`pelnomocnictwoFooter` (np. nazwa szablonu z „umowa" → docCopies 2; „oświadczenie" → 1; `pelnomocnictwoFooter` zwraca string/null wg reguł BBS). Bez `as any` — realne typy.
- [ ] **Step 6:** `npx vitest run lib/hr` PASS; `npx tsc --noEmit` 0.
```bash
git add lib/hr/peselForm.ts lib/hr/docRules.ts lib/hr/docRules.test.ts public/templates/pesel-elw1.pdf public/fonts/noto-deva.woff2 package.json package-lock.json
git commit -m "feat(e2c): pdf-lib + assety (pesel-elw1, noto-deva) + peselForm + docRules"
```

---

### Task 2: API doc-templates (CRUD)
**Files:** Create `app/api/hr/doc-templates/route.ts`, `app/api/hr/doc-templates/[id]/route.ts` (port z BBS wg REGUŁ).
**Interfaces:** Consumes admin-shim, `can(auth,'agencja.generator')`. Produces REST na `hr_doc_templates` (kolumny `name`, `content_html`, `has_letterhead`, `kind`) — UI T5 konsumuje 1:1.

- [ ] **Step 1:** Port 2 plików wg REGUŁ (1,3,5,6). `grep -rn "lib/crm\|logEvent\|lib/audit" app/api/hr/doc-templates` → 0.
- [ ] **Step 2:** `npx tsc --noEmit` 0; `npx next build 2>&1 | tail -15` clean.
- [ ] **Step 3:** Dev-smoke: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3019/api/hr/doc-templates` (po `next dev :3019` bg) → 403; kill.
```bash
git add app/api/hr/doc-templates
git commit -m "feat(e2c): API doc-templates (CRUD szablonow, gate agencja.generator)"
```

---

### Task 3: API doc-generate (port + podmiana logo)
**Files:** Create `app/api/hr/doc-generate/route.ts` (port wg REGUŁ, w tym REGUŁA 7 — logo).
**Interfaces:** Consumes `renderOfferPdfBatch` (@/lib/pdf/renderer), `buildDocData`/`fillPlaceholders` (docPlaceholders, E2b), `fillPeselForm`/`peselMissingFields` (T1), `pelnomocnictwoFooter` (T1), bucket `hr-documents`. Produces POST generujący PDF-y do storage + wiersze `hr_documents` + signed URL 1 h.

- [ ] **Step 1:** Port `doc-generate/route.ts` wg REGUŁ 1,2,3,5,6,**7**. Po porcie sprawdź:
  - `grep -n "znmp" app/api/hr/doc-generate/route.ts` → 0 (wszystkie podmienione na ebs-neon-no-bg.png).
  - `grep -n "lib/crm\|logEvent\|lib/audit\|renderOfferPdfBatch" app/api/hr/doc-generate/route.ts` → tylko import z `@/lib/pdf/renderer` (renderOfferPdfBatch to nazwa eksportu tam — zostaje), zero `lib/crm`/`logEvent`.
  - readFile assetów: `pesel-elw1.pdf` (public/templates), `noto-deva.woff2` (public/fonts), `ebs-neon-no-bg.png` (public/) — wszystkie istnieją po T1.
- [ ] **Step 2:** `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 3:** Dev-smoke: `/api/hr/doc-generate` GET (jeśli tylko POST → 405; bez sesji POST → 403) — odnotuj faktyczny kod.
```bash
git add app/api/hr/doc-generate
git commit -m "feat(e2c): API doc-generate (HTML->PDF + druk PESEL; naglowek EBS zamiast znmp)"
```

---

### Task 4: API settlements/pdf (un-defer z E2b) + re-enable przycisku PDF
**Files:** Create `app/api/hr/settlements/pdf/route.ts` (port); Modify `components/agencja/HrRozliczenia.tsx` (odblokuj przycisk PDF wyłączony w E2b T7).
**Interfaces:** Consumes `renderOfferPdfBatch` (@/lib/pdf/renderer), `rentShare`, `docPlaceholders` (E2b). Produces PDF list płac dla okresu.

- [ ] **Step 1:** Port `settlements/pdf/route.ts` wg REGUŁ 1,2,3,5,6.
- [ ] **Step 2:** W `HrRozliczenia.tsx`: przywróć oryginalne działanie przycisku PDF (z E2b T7 zmieniony na disabled `<button title="…E2c">`). Przywróć wołanie `/api/hr/settlements/pdf` jak w BBS (odczytaj oryginał BBS `HrRozliczenia.tsx` fragment PDF i odtwórz 1:1; usuń tooltip „wkrótce E2c").
- [ ] **Step 3:** `grep -rn "lib/crm\|logEvent" app/api/hr/settlements/pdf` → 0; `grep -n "wkrótce (E2c)\|E2c" components/agencja/HrRozliczenia.tsx` → 0 (przycisk odblokowany).
- [ ] **Step 4:** `npx tsc --noEmit` 0; `npx next build` clean; `npx vitest run` PASS.
```bash
git add app/api/hr/settlements/pdf components/agencja/HrRozliczenia.tsx
git commit -m "feat(e2c): API settlements/pdf (PDF list plac) + odblokowanie przycisku w HrRozliczenia"
```

---

### Task 5: UI HrGeneratorDokumentow + wiring widoku hr-generator
**Files:** Create `components/agencja/HrGeneratorDokumentow.tsx` (port wg REGUŁ 4); Modify `lib/permissions/registry.ts` (PERMISSION_MENU +hr-generator), `components/Sidebar.tsx` (superadmin +Generator), `views/DashboardAdminNew.tsx` (widok hr-generator → `<HrGeneratorDokumentow/>`).
**Interfaces:** Consumes API T2/T3, `agencja.generator`. Produces zakładka „Generator dokumentów".

- [ ] **Step 1:** Port `HrGeneratorDokumentow.tsx` → `components/agencja/` wg REGUŁ (4: importy; 3: logEvent jeśli jest; font-display→font-sans). `grep -rn "adminNew/hr\|lib/crm\|logEvent" components/agencja/HrGeneratorDokumentow.tsx` → 0.
- [ ] **Step 2:** `registry.ts` — do `PERMISSION_MENU` dodaj:
```ts
  { view: 'hr-generator', label: 'Generator dokumentów', section: 'Agencja Pracy', icon: 'file', anyOf: ['agencja.generator'] },
```
- [ ] **Step 3:** `Sidebar.tsx` — w `case Role.SUPERADMIN` po `hr-flota` dodaj `{ id: 'hr-generator', label: 'Agencja — Generator', icon: <FileText size={20} /> }` (+ `FileText` do importu lucide jeśli brak; dynamiczny branch koord/platnik już czyta PERMISSION_MENU — dojdzie automatycznie); mapka ikon dynamicznego menu: dodaj `file: <FileText/>`.
- [ ] **Step 4:** `DashboardAdminNew.tsx` — rozszerz `AdminTab` o `'hr-generator'`, `VIEW_TO_TAB`/`TAB_TO_VIEW`, render branch `<HrGeneratorDokumentow/>` (import; zero props jak BBS).
- [ ] **Step 5:** `npx tsc --noEmit` 0; `npx next build` clean; `npx vitest run lib/permissions` PASS.
```bash
git add components/agencja/HrGeneratorDokumentow.tsx lib/permissions/registry.ts components/Sidebar.tsx views/DashboardAdminNew.tsx
git commit -m "feat(e2c): UI Generator dokumentow + wiring widoku hr-generator (gate agencja.generator)"
```

---

### Task 6: Import szablonów z BBS + weryfikacja + CLAUDE.md + merge + deploy + smoke
**Files:** Create `scripts/import-bbs-doc-templates.mts`; Modify `CLAUDE.md`.

- [ ] **Step 1:** `scripts/import-bbs-doc-templates.mts` — wzór jak `scripts/import-bbs-permissions.mts` (E1): parsuj `BBS-Unified/.env.local`, skopiuj wiersze `hr_doc_templates` (kolumny name/content_html/has_letterhead/kind) z bazy BBS do EBS (upsert; NIE nadpisuj istniejących po id — generuj nowe id lub upsert po name). W `content_html` podmień `znmp-logo` → `ebs-neon-no-bg` (sed-like replace w JS) — szablony BBS mogą odwoływać się do starego logo. Log: ile skopiowano.
- [ ] **Step 2:** Uruchom: `npx tsx --env-file=.env.local scripts/import-bbs-doc-templates.mts` — zanotuj liczbę. Weryfikacja (MCP execute_sql EBS): `SELECT count(*), string_agg(name, ', ') FROM hr_doc_templates;`. (Jeśli BBS ma 0 szablonów → log „brak", też OK — user stworzy w edytorze.)
- [ ] **Step 3:** `npx vitest run` PASS; `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 4:** CLAUDE.md — po akapicie E2b dodaj akapit **E2c** (generator działa: widok `hr-generator` → `HrGeneratorDokumentow`; API doc-templates/doc-generate/settlements/pdf; nagłówek `ebs-neon-no-bg.png`; assety pesel-elw1.pdf/noto-deva.woff2; dep pdf-lib; szablony zaimportowane z BBS — do przeglądu/edycji; gate `agencja.generator`).
```bash
git add scripts/import-bbs-doc-templates.mts CLAUDE.md
git commit -m "feat(e2c): import szablonow z BBS + docs CLAUDE.md E2c"
```
- [ ] **Step 5:** Merge ff + push: `git fetch . feat/e2c-generator:main && git push origin main`.
- [ ] **Step 6:** Deploy `npx vercel --prod --yes` → READY.
- [ ] **Step 7:** Smoke prod:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/api/hr/doc-templates      # 403
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/api/hr/settlements/pdf     # 403 (juz istnieje, nie 404)
```
- [ ] **Step 8:** Raport + następny krok: E2d (AI: OCR/tłumacz/mapa — wymaga kluczy API od użytkownika).
