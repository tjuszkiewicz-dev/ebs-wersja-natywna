# E2e: Agencja — Portal pracownika + cron wygasania (port z BBS-Unified) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Portal pracownika tymczasowego (`/dashboard/agencja`, mobile: profil/dokumenty/rozliczenia/grafik+GPS/zmiana konta bankowego), GPS-ping → `hr_locations` (zasila mapę z E2d), oraz codzienny digest e-mail o wygasających dokumentach/najmach/pojazdach (doklejony do crona `expire-vouchers`). Czat pracownik↔koordynator ODŁOŻONY do E3 (panel ukryty, `me/worker/chat` nieportowany).

**Architecture:** Port `app/api/me/worker/{route,bank}`, `app/api/me/location`, `lib/hr/tracking`, `app/dashboard/agencja/page.tsx`, `components/worker/TempWorkerDashboard.tsx` → EBS wg GLOBALNYCH REGUŁ PORTU (jak E2b–d). Cron: logika `app/api/cron/expiry-alerts` wtopiona w istniejący `app/api/cron/expire-vouchers` (EBS `sendEmail`/`lib/mailer`, istniejący `CRON_SECRET`). Naprawa `lib/apps/appTargets` (agencja → cel wg roli). Spec: `docs/superpowers/specs/2026-07-17-e2-agencja-design.md` §2 E2e.

**Tech Stack:** Next.js 15, Supabase, vitest. ZERO nowych deps (tracking czysty; `web-push`/czat = E3). ZERO nowych migracji, ZERO nowych cronów (fold do istniejącego).

## Global Constraints
- Supabase EBS `ramedybmybcpqvelsmxd`. Źródło: `C:\Users\Użytkownik\Desktop\BBS-Unified` (read-only).
- Po każdym tasku `npx tsc --noEmit` = 0; przy route'ach TAKŻE `npx next build`. Commit tylko plików taska; brudne pliki repo — nie dotykać.
- Gałąź `feat/e2e-portal-pracownika` (Task 1 z `main`). Komunikaty/komentarze PL. Commit + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

### GLOBALNE REGUŁY PORTU
1. `admin` z `@/lib/crm/visibility` → `@/lib/supabaseAdmin`.
2. Usuń `@/lib/audit` + `logEvent(...)`.
3. UI `components/adminNew/hr/X`/`components/worker/X` → importy `@/components/...` odpowiednio; `@/lib/hr/*` zostają.
4. Untyped `hr_*` → `(admin() as any).from('hr_...')`.
5. Non-route `export const` w route.ts → bare const.
6. font-display → font-sans.
7. **CZAT = E3:** NIE portuj `me/worker/chat`; w `TempWorkerDashboard` UKRYJ panel/przycisk czatu (usuń sekcję czatu lub owiń `{false && (...)}` z komentarzem `// czat: E3`). Reszta portalu działa.
8. Bez zmian logiki poza 1–7.

---

### Task 1: Gałąź + appTargets (agencja) + lib/hr/tracking + me/location
**Files:** Modify `lib/apps/appTargets.ts`; Create `lib/hr/tracking.ts`, `app/api/me/location/route.ts`.
**Interfaces:** Produces `existingAppTarget('agencja', role)` → `/dashboard/agencja` (TEMP_WORKER) / `/dashboard/admin` (COORDINATOR/PAYROLL/SUPERADMIN); `processPing` (tracking); POST `/api/me/location` (GPS ping → hr_locations).

- [ ] **Step 1:** `git checkout main && git checkout -b feat/e2e-portal-pracownika`
- [ ] **Step 2:** `lib/apps/appTargets.ts` — w `existingAppTarget`, w `switch(appId)` dodaj przed `default`:
```ts
    case 'agencja':
      if (role === Role.TEMP_WORKER) return '/dashboard/agencja';
      // koordynator/płatnik/superadmin → panel admina z zakładkami agencji
      if (role === Role.COORDINATOR || role === Role.PAYROLL || role === Role.SUPERADMIN) return '/dashboard/admin';
      return null;
```
(to naprawia E2a: `/app/agencja` przestaje pokazywać placeholder, kieruje wg roli).
- [ ] **Step 3:** Zaktualizuj `lib/apps/access.test.ts`/`postLoginRedirect.test.ts` jeśli asercje dotyczą `agencja` targetu — dodaj test: `existingAppTarget('agencja', Role.TEMP_WORKER)` = `/dashboard/agencja`; `existingAppTarget('agencja', Role.COORDINATOR)` = `/dashboard/admin`.
- [ ] **Step 4:** Skopiuj `lib/hr/tracking.ts` z BBS 1:1 (czysty, bez importów zewn. — potwierdź grep). Skopiuj `app/api/me/location/route.ts` wg REGUŁ (admin-shim; importuje `processPing` z tracking).
- [ ] **Step 5:** `grep -rn "lib/crm\|logEvent" lib/hr/tracking.ts app/api/me/location` → 0. `npx tsc --noEmit` 0; `npx vitest run lib` PASS; `npx next build` clean.
```bash
git add lib/apps/appTargets.ts lib/apps/access.test.ts lib/auth/postLoginRedirect.test.ts lib/hr/tracking.ts app/api/me/location
git commit -m "feat(e2e): appTargets agencji wg roli + lib/hr/tracking + API me/location (GPS ping)"
```

---

### Task 2: API me/worker + me/worker/bank
**Files:** Create `app/api/me/worker/route.ts`, `app/api/me/worker/bank/route.ts` (port wg REGUŁ). **NIE** twórz `me/worker/chat` (E3).
**Interfaces:** Consumes admin-shim, `rentSharePerPerson`, `consumeTranslator` (E2b/d). Produces GET `/api/me/worker` (dane pracownika: kartoteka, dokumenty signed-url, rozliczenia, grafik, sesja GPS, limit tłumacza) + `bank` (zmiana konta z podwójnym potwierdzeniem). Gate: `auth.role === 'pracownik_tymczasowy'`.

- [ ] **Step 1:** Port 2 plików wg REGUŁ. `grep -rn "lib/crm\|logEvent\|lib/audit" app/api/me/worker` → 0.
- [ ] **Step 2:** `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 3:** Dev-smoke: `/api/me/worker` bez sesji → 403.
```bash
git add app/api/me/worker
git commit -m "feat(e2e): API me/worker + bank (portal pracownika, bez czatu - E3)"
```

---

### Task 3: /dashboard/agencja + TempWorkerDashboard (czat ukryty)
**Files:** Create `app/dashboard/agencja/page.tsx`, `components/worker/TempWorkerDashboard.tsx` (port wg REGUŁ + REGUŁA 7 czat ukryty).
**Interfaces:** Consumes API T1/T2. Produces portal pracownika pod `/dashboard/agencja` (gate `pracownik_tymczasowy` + superadmin do testów).

- [ ] **Step 1:** Port `app/dashboard/agencja/page.tsx` (server component: gate roli, renderuje `<TempWorkerDashboard/>`). Sprawdź jak EBS robi inne `app/dashboard/*/page.tsx` (sesja Supabase) i dostosuj wzorzec auth do EBS jeśli BBS różni się (BBS może używać innego helpera sesji — użyj EBS-owego `getAuthUser`/`getViewerApps` lub wzorca z `app/dashboard/employee/page.tsx`). Jeśli wzorce się różnią → dostosuj do EBS i odnotuj.
- [ ] **Step 2:** Port `components/worker/TempWorkerDashboard.tsx` wg REGUŁ; **REGUŁA 7**: ukryj sekcję czatu (fetch `/api/me/worker/chat` + UI czatu) — owiń `{false && (...)}` lub usuń, komentarz `// czat pracownik↔koordynator: E3`. Reszta (profil, dokumenty, rozliczenia, grafik+GPS, zmiana konta, tłumacz) zostaje. `grep -rn "worker/chat" components/worker/TempWorkerDashboard.tsx` → 0 aktywnych wywołań (albo za `{false &&}`).
- [ ] **Step 3:** `grep -rn "lib/crm\|logEvent\|adminNew/hr" components/worker/TempWorkerDashboard.tsx` → 0. `npx tsc --noEmit` 0; `npx next build` clean; `npx vitest run` PASS.
```bash
git add app/dashboard/agencja components/worker/TempWorkerDashboard.tsx
git commit -m "feat(e2e): portal /dashboard/agencja + TempWorkerDashboard (czat ukryty - E3)"
```

---

### Task 4: Cron — digest wygasania doklejony do expire-vouchers
**Files:** Modify `app/api/cron/expire-vouchers/route.ts`.
**Interfaces:** Consumes `sendEmail` (`@/lib/mailer`), admin-shim, `fullName` (docPlaceholders). Produces sekcję „alerty wygasania" w istniejącym cronie (po logice voucherów), wysyłkę do superadmin/dyrektor/szef_koordynatorow.

- [ ] **Step 1:** Odczytaj `BBS/app/api/cron/expiry-alerts/route.ts` (logika: hr_employees doc-expiry ≤30 dni, hr_accommodations lease ≤7 dni, hr_vehicles insurance/inspection/license; buduje HTML; adresaci superadmin/dyrektor/szef_koordynatorow). Odczytaj EBS `app/api/cron/expire-vouchers/route.ts` (ma CRON_SECRET guard + `sendEmail` z `@/lib/mailer`).
- [ ] **Step 2:** Wtop logikę alertów jako OSOBNĄ sekcję na końcu GET expire-vouchers (po dotychczasowym flow voucherów, przed finalnym return): zapytania hr_* przez `admin() as any`, budowa HTML, `sendEmail({to: <emaile superadminów/dyrektorów/szefów koordynatorów>, subject:'⚠️ EBS: … wygasające …', html})`. Adresaci: query `user_profiles` role in ('superadmin','dyrektor','szef_koordynatorow') → ich e-maile (przez `supabase.auth.admin` lub kolumnę email jeśli jest; sprawdź jak EBS pobiera emaile — wzorzec z innego miejsca). Wysyłka tylko gdy są alerty. Owiń w `try/catch` — błąd alertów NIE może wywalić crona voucherów. Komentarz `// E2e: digest wygasania (dawniej osobny cron expiry-alerts w BBS)`.
- [ ] **Step 3:** Bez `sendMail`/`lib/mail`/`app_config` dedupe (cron dzienny + CRON_SECRET wystarcza). `grep -n "lib/mail/server\|expiry_alerts_sent" app/api/cron/expire-vouchers/route.ts` → 0.
- [ ] **Step 4:** `npx tsc --noEmit` 0; `npx next build` clean.
```bash
git add app/api/cron/expire-vouchers/route.ts
git commit -m "feat(e2e): digest wygasania dokumentow/najmow/floty doklejony do crona expire-vouchers"
```

---

### Task 5: Weryfikacja + CLAUDE.md + merge + deploy + smoke
**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1:** `npx vitest run` PASS; `npx tsc --noEmit` 0; `npx next build` clean.
- [ ] **Step 2:** CLAUDE.md — akapit **E2e** po E2d: portal `/dashboard/agencja` (`components/worker/TempWorkerDashboard`, gate `pracownik_tymczasowy`); API `me/worker`(+`bank`), `me/location` (GPS→`hr_locations`, zasila mapę E2d); `lib/hr/tracking` (geofence); `appTargets` agencji → `/dashboard/agencja` (worker) / `/dashboard/admin` (koordynator/płatnik/superadmin); digest wygasania doklejony do crona `expire-vouchers` (EBS `sendEmail`). **Odłożone: czat pracownik↔koordynator (`me/worker/chat` + panel) → E3.**
```bash
git add CLAUDE.md && git commit -m "docs(claude): E2e - portal pracownika + cron wygasania"
```
- [ ] **Step 3:** merge ff + push: `git fetch . feat/e2e-portal-pracownika:main && git push origin main`.
- [ ] **Step 4:** deploy `npx vercel --prod --yes` → READY.
- [ ] **Step 5:** Smoke: `/login` 200; `/dashboard/agencja` bez sesji → 3xx (redirect); `/api/me/worker` → 403; `/api/me/location` → 403 (POST-only → GET 405).
- [ ] **Step 6:** Raport: **E2 (agencja) KOMPLETNE** (E2a–E2e); co odłożone (czat/notatki=E3, KSeF/księgowość=E4); następny krok: E4 (księgowość — WYMAGA decyzji użytkownika: własny KSeF vs Fakturownia).
