# E2d: Agencja — AI (OCR, tłumacz, mapa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Moduły AI agencji: OCR dokumentów (Claude Vision), tłumacz tekst+głos (Claude + OpenAI), mapa pracowników (Leaflet + Nominatim); odstubowanie `vehicles/license`/`candidates/from-passport` z E2b i realne geokodowanie (`lib/hr/geo`). Wszystko z **łagodną degradacją**: brak `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` = funkcja zwraca czytelny komunikat „AI wyłączone", zero crashy. Klucze wpisuje użytkownik po wdrożeniu.

**Architecture:** Port `app/api/hr/{ocr,translate/*,map,candidates/from-passport}`, `vehicles/[id]/license` (re-port z OCR), `lib/{anthropic,hr/ocr,hr/translateCore,hr/translatorLimit}`, `lib/hr/geo` (REAL — zastępuje stub z E2b), UI `HrTlumacz`+`HrMapa` → EBS wg GLOBALNYCH REGUŁ PORTU (jak E2b/c) + REGUŁA AI-GUARD. Spec: `docs/superpowers/specs/2026-07-17-e2-agencja-design.md` §2 E2d.

**Tech Stack:** Next.js 15, Supabase, vitest, `@anthropic-ai/sdk` (Claude), `leaflet`+`leaflet.markercluster` (mapa, client-only `ssr:false`), Nominatim (geo, bez klucza), OpenAI przez `fetch` (bez pakietu npm).

## Global Constraints
- Supabase EBS `ramedybmybcpqvelsmxd`. Źródło portu: `C:\Users\Użytkownik\Desktop\BBS-Unified` (read-only).
- Po każdym tasku `npx tsc --noEmit` = 0; przy route'ach TAKŻE `npx next build`. Commit tylko plików taska; brudne pliki repo — nie dotykać.
- Gałąź `feat/e2d-ai` (Task 1 z `main`). Komunikaty/komentarze PL. Commit + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Nowe deps: `@anthropic-ai/sdk`, `leaflet`, `leaflet.markercluster`, `@types/leaflet`, `@types/leaflet.markercluster`. ZERO migracji, ZERO cronów.
- **tracking.ts + me/location + portal pracownika = E2e** (worker GPS). W E2d mapa czyta `/api/hr/map` (odczyt hr_locations); żywe pingi pracownika dojdą w E2e.

### GLOBALNE REGUŁY PORTU
1. `admin` z `@/lib/crm/visibility` → `@/lib/supabaseAdmin`.
2. `renderOfferPdfBatch` (jeśli) → `@/lib/pdf/renderer`.
3. Usuń `@/lib/audit` + każde `logEvent(...)`.
4. UI `components/adminNew/hr/X` → `components/agencja/X`; `@/components/ui/Hint`, `@/lib/hr/*`, `@/lib/anthropic` zostają.
5. Untyped `hr_*` → `(admin() as any).from('hr_...')`.
6. Non-route `export const` w route.ts → bare const.
7. font-display → font-sans.
8. Bez zmian logiki poza 1–7 + REGUŁA AI-GUARD.

### REGUŁA AI-GUARD (łagodna degradacja) — KAŻDY route wołający Claude/OpenAI
Na początku handlera (po `getAuthUserWithRole`/`can`), przed pierwszym użyciem klucza, dodaj strażnika:
- routes używające Claude (`ocr`, `translate` tekst, `candidates/from-passport`, `vehicles/[id]/license` gałąź OCR): jeśli `!process.env.ANTHROPIC_API_KEY` → zwróć **200** z `{ ok: false, disabled: true, error: 'Funkcja AI wyłączona — brak ANTHROPIC_API_KEY' }` (dla `license` i `from-passport`, gdzie E2b zwracał `ocr:null`, zwróć `{ ok: true, ocr: null, disabled: true }` żeby UI działało jak w E2b).
- routes używające OpenAI (`translate/voice`, `translate/tts`, `translate/rt-session`): jeśli `!process.env.OPENAI_API_KEY` → **200** `{ ok: false, disabled: true, error: 'Tłumacz głosowy wyłączony — brak OPENAI_API_KEY' }`.
- **map** i **geo** (Nominatim) NIE mają guardu — działają bez klucza.
Guard = kilka linii; nie zmienia dalszej logiki (która zostaje 1:1 z BBS). Komentarz `// AI-guard E2d: łagodna degradacja bez klucza`.

---

### Task 1: Gałąź + deps + lib/anthropic + REALNE lib/hr/geo (zastępuje stub)
**Files:** Modify `package.json`; Create `lib/anthropic.ts` (kopia z BBS); Modify `lib/hr/geo.ts` (zastąp E2b-stub realną wersją z BBS); Modify `lib/hr/geo.test.ts` (dostosuj — geo już nie zawsze null).
**Interfaces:** Produces `getAnthropic()`, `AI_MODEL` (anthropic); realne `geocodeAddress`/`driveEstimate`/`haversineKm` (geo — sygnatury BEZ ZMIAN, więc contracts/accommodations działają dalej, ale teraz faktycznie geokodują przez Nominatim).

- [ ] **Step 1:** `git checkout main && git checkout -b feat/e2d-ai`
- [ ] **Step 2:** `npm install @anthropic-ai/sdk leaflet leaflet.markercluster && npm install -D @types/leaflet @types/leaflet.markercluster`
- [ ] **Step 3:** Skopiuj `lib/anthropic.ts` z BBS 1:1 (używa `@anthropic-ai/sdk`, `process.env.ANTHROPIC_API_KEY`, `AI_MODEL`).
- [ ] **Step 4:** Zastąp `lib/hr/geo.ts` realną wersją z BBS (Nominatim + haversine). **Zachowaj identyczne nazwy eksportów** (E2b-stub miał `geocodeAddress`/`haversineKm`/`driveEstimate` — sprawdź że realny BBS ma te same; jeśli różnią się nazwą, dostosuj konsumentów `contracts`/`accommodations` i odnotuj). geo nie wymaga klucza.
- [ ] **Step 5:** Zaktualizuj `lib/hr/geo.test.ts` — realne geokodowanie robi HTTP (Nominatim), więc test NIE może zależeć od sieci: przetestuj CZYSTE funkcje (`haversineKm` z dwóch znanych punktów → znany dystans ±margines) i to, że `geocodeAddress('')`/pusty input zwraca null bez rzucania. Bez testów sieciowych.
- [ ] **Step 6:** `npx vitest run lib/hr` PASS; `npx tsc --noEmit` 0.
```bash
git add package.json package-lock.json lib/anthropic.ts lib/hr/geo.ts lib/hr/geo.test.ts
git commit -m "feat(e2d): deps AI (anthropic-sdk, leaflet) + lib/anthropic + realne lib/hr/geo (Nominatim, zamiast stubu)"
```

---

### Task 2: lib OCR + tłumacz (TDD translatorLimit)
**Files:** Create `lib/hr/ocr.ts`, `lib/hr/translateCore.ts`, `lib/hr/translatorLimit.ts` (kopie z BBS wg REGUŁ); Test `lib/hr/translatorLimit.test.ts`.
**Interfaces:** Produces funkcje OCR (`extract*`/`aggregate*`/`merge*` — faktyczne nazwy z BBS), `translateCore`, `translatorLimit` (limit 10 min/dzień). Consumes `getAnthropic` (T1), `admin` (shim).

- [ ] **Step 1:** Skopiuj 3 pliki wg REGUŁ (1 admin-shim w translatorLimit; 3 strip logEvent jeśli jest). `grep -n "lib/crm\|logEvent\|lib/audit" lib/hr/ocr.ts lib/hr/translateCore.ts lib/hr/translatorLimit.ts` → 0.
- [ ] **Step 2 (TDD):** `lib/hr/translatorLimit.test.ts` — odczytaj faktyczne eksporty; test inwariantu limitu (np. zużycie < limit → dozwolone; ≥ limit → blokada). Jeśli funkcja czyta DB (`hr_translator_usage`) — przetestuj tylko czystą logikę liczenia/porównania jeśli jest wydzielona; jeśli wszystko idzie przez DB, napisz test na eksportowaną czystą funkcję pomocniczą lub pomiń z uzasadnieniem w raporcie (DONE_WITH_CONCERNS).
- [ ] **Step 3:** `npx vitest run lib/hr` PASS; `npx tsc --noEmit` 0.
```bash
git add lib/hr/ocr.ts lib/hr/translateCore.ts lib/hr/translatorLimit.ts lib/hr/translatorLimit.test.ts
git commit -m "feat(e2d): lib OCR (Claude Vision) + translateCore + translatorLimit"
```

---

### Task 3: API OCR + translate/* (z AI-guard)
**Files:** Create `app/api/hr/ocr/route.ts`, `app/api/hr/translate/route.ts`, `translate/voice/route.ts`, `translate/tts/route.ts`, `translate/rt-session/route.ts` (port wg REGUŁ + AI-GUARD).
**Interfaces:** Consumes T1/T2 (anthropic, ocr, translateCore, translatorLimit). Produces REST OCR + tłumacz z łagodną degradacją.

- [ ] **Step 1:** Port 5 plików. `ocr` + `translate` → ANTHROPIC guard; `voice`/`tts`/`rt-session` → OPENAI guard (REGUŁA AI-GUARD). OpenAI wołane przez `fetch` (bez pakietu). `grep -rn "lib/crm\|logEvent\|lib/audit" app/api/hr/ocr app/api/hr/translate` → 0.
- [ ] **Step 2:** `grep -rn "ANTHROPIC_API_KEY\|OPENAI_API_KEY" app/api/hr/ocr app/api/hr/translate` — każdy route ma swój guard.
- [ ] **Step 3:** `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 4:** Dev-smoke BEZ klucza (env lokalne prawdopodobnie bez ANTHROPIC/OPENAI): `next dev :3019`, `curl` POST na `/api/hr/translate` z sesją niemożliwe bez auth → bez sesji 403 (guard jest PO auth). Odnotuj 403.
```bash
git add app/api/hr/ocr app/api/hr/translate
git commit -m "feat(e2d): API OCR + translate (tekst/glos/tts/rt) z lagodna degradacja bez kluczy AI"
```

---

### Task 4: API map + candidates/from-passport + re-port vehicles/license (odstubowanie E2b)
**Files:** Create `app/api/hr/map/route.ts`, `app/api/hr/candidates/from-passport/route.ts`; Modify `app/api/hr/vehicles/[id]/license/route.ts` (przywróć gałąź OCR z AI-guard).
**Interfaces:** Consumes T1/T2. Produces mapa (odczyt hr_locations, bez klucza), OCR paszportu (z guardem), odczyt prawa jazdy AI (z guardem).

- [ ] **Step 1:** Port `map/route.ts` (bez guardu — czyta hr_locations + geo Nominatim). Port `candidates/from-passport/route.ts` z BBS (ANTHROPIC AI-guard: bez klucza → `{ ok:true, ocr:null, disabled:true }`, reszta jak w E2b import bez OCR? — NIE: from-passport CAŁY zależy od OCR; bez klucza zwróć disabled). 
- [ ] **Step 2:** `vehicles/[id]/license/route.ts`: w E2b zwracał `{ok:true,ocr:null}` (gałąź AI usunięta). Przywróć oryginalną gałąź OCR z BBS OWINIĘTĄ w AI-guard: z kluczem → realny odczyt Claude; bez klucza → `{ok:true, ocr:null, disabled:true}` (jak E2b — UI to znosi). Upload zdjęcia bez zmian.
- [ ] **Step 3:** `grep -rn "lib/crm\|logEvent\|lib/audit" app/api/hr/map app/api/hr/candidates/from-passport app/api/hr/vehicles/[id]/license` → 0. `npx tsc --noEmit` 0; `npx next build` clean.
```bash
git add app/api/hr/map app/api/hr/candidates/from-passport "app/api/hr/vehicles/[id]/license"
git commit -m "feat(e2d): API mapy + OCR paszportu + odblokowanie odczytu prawa jazdy (AI-guard)"
```

---

### Task 5: UI HrTlumacz + HrMapa + wiring widoków
**Files:** Create `components/agencja/HrTlumacz.tsx`, `components/agencja/HrMapa.tsx` (port wg REGUŁ 4,7); Modify `lib/permissions/registry.ts` (PERMISSION_MENU +hr-tlumacz +hr-mapa), `components/Sidebar.tsx` (superadmin +2 + ikony dyn.), `views/DashboardAdminNew.tsx` (widoki hr-tlumacz/hr-mapa).
**Interfaces:** Consumes API T3/T4. Produces zakładki „Tłumacz" (`agencja.tlumacz`) i „Mapa Pracowników" (`agencja.mapa`). **HrMapa używa Leaflet (browser-only) → import przez `next/dynamic` `{ ssr:false }`** w DashboardAdminNew.

- [ ] **Step 1:** Port `HrTlumacz.tsx` + `HrMapa.tsx` → `components/agencja/`. HrMapa importuje `leaflet`+`leaflet.markercluster` + CSS. `grep -rn "adminNew/hr\|lib/crm\|logEvent" components/agencja/HrTlumacz.tsx components/agencja/HrMapa.tsx` → 0.
- [ ] **Step 2:** `registry.ts` PERMISSION_MENU +:
```ts
  { view: 'hr-tlumacz', label: 'Tłumacz', section: 'Agencja Pracy', icon: 'languages', anyOf: ['agencja.tlumacz'] },
  { view: 'hr-mapa', label: 'Mapa Pracowników', section: 'Agencja Pracy', icon: 'mappin', anyOf: ['agencja.mapa'] },
```
- [ ] **Step 3:** `Sidebar.tsx` — superadmin +2 pozycje (`Languages`/`MapPin` z lucide); dynamiczna mapka ikon +`languages`/`mappin`.
- [ ] **Step 4:** `DashboardAdminNew.tsx` — `AdminTab` +`'hr-tlumacz'|'hr-mapa'`, mapy, render: `hr-tlumacz` → `<HrTlumacz/>`; `hr-mapa` → dynamiczny `<HrMapa/>` (`const HrMapa = dynamic(() => import('@/components/agencja/HrMapa'), { ssr:false })`).
- [ ] **Step 5:** `npx tsc --noEmit` 0; `npx next build` clean (Leaflet nie może psuć SSR — jeśli build krzyczy o `window`/`document`, upewnij się że HrMapa jest dynamic ssr:false i że żaden import Leaflet nie jest na poziomie modułu w komponencie SSR); `npx vitest run` PASS.
```bash
git add components/agencja/HrTlumacz.tsx components/agencja/HrMapa.tsx lib/permissions/registry.ts components/Sidebar.tsx views/DashboardAdminNew.tsx
git commit -m "feat(e2d): UI Tlumacz + Mapa Pracownikow (Leaflet ssr:false) + wiring widokow"
```

---

### Task 6: Weryfikacja + CLAUDE.md + merge + deploy + smoke (+ instrukcja kluczy)
**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1:** `npx vitest run` PASS; `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 2:** CLAUDE.md — akapit **E2d** po E2c: moduły AI (OCR Claude Vision, tłumacz Claude+OpenAI, mapa Leaflet+Nominatim); widoki `hr-tlumacz`/`hr-mapa`; **łagodna degradacja** — brak `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` = funkcja zwraca `disabled`; `lib/hr/geo` już REALNE (Nominatim, odstubowane — kontrakty/noclegi geokodują); `vehicles/license`+`candidates/from-passport` odblokowane; deps `@anthropic-ai/sdk`+leaflet; **klucze do wpisania w env**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (+ opcj. `AI_MODEL`).
```bash
git add CLAUDE.md && git commit -m "docs(claude): E2d - moduly AI (OCR/tlumacz/mapa) + lagodna degradacja"
```
- [ ] **Step 3:** merge ff + push: `git fetch . feat/e2d-ai:main && git push origin main`.
- [ ] **Step 4:** deploy `npx vercel --prod --yes` → READY.
- [ ] **Step 5:** Smoke: `/login` 200; `/api/hr/ocr` → 403 (bez sesji); `/api/hr/map` → 403; `/api/hr/translate` → 403.
- [ ] **Step 6:** Raport + **instrukcja dla użytkownika**: żeby OCR/tłumacz działały, wpisać `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` w `.env.local` i na Vercel (skopiować z BBS `.env.local`); mapa i geokodowanie działają od razu (bez klucza). Następny krok: E2e (portal pracownika + cron).
