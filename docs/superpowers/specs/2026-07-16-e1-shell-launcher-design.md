# Migracja modułów BBS-Unified → EBS — Etap 1: Shell/Launcher + Uprawnienia + Org

**Data:** 2026-07-16
**Status:** spec do akceptacji
**Źródło kodu:** `C:\Users\Użytkownik\Desktop\BBS-Unified` (super-app BBS, aktywnie rozwijany)
**Cel:** `ebs-wersja-natywna` (EBS / Stratton Prime)

---

## 1. Kontekst i cel programu migracji

BBS-Unified wyewoluował z appki benefitowej w **super-app z launcherem** („shell"): ekran
startowy z kafelkami aplikacji, system uprawnień per użytkownik/moduł oraz komplet modułów
biznesowych. EBS (osobna firma: Stratton Prime) ma otrzymać tę samą architekturę i moduły —
**z wyjątkiem CRM**, bo Stratton Prime ma osobny CRM (spec integracji:
`2026-06-17-ebs-crm-integration-design.md`).

Oba projekty to forki tej samej bazy, mocno rozjechane (~101 wspólnych katalogów o różnej
zawartości). Dlatego **nie kopiujemy plików hurtem** — portujemy moduły do dedykowanych
katalogów, nie nadpisując dorobku EBS (Fakturownia, SMTP, SP1–SP6).

## 2. Decyzje kierunkowe (wywiad 2026-07-16)

| Decyzja | Wybór |
|---|---|
| Kierunek | BBS-Unified → EBS, **bez CRM** (`api/crm`, `components/crm`, `lib/crm`, `DashboardSales`, migracje CRM — wykluczone na stałe) |
| Tryb | **Etapami** (każdy etap: spec → plan → wdrożenie → deploy) |
| Architektura | **Shell/launcher przejęty 1:1** — EBS staje się super-appem; obecne dashboardy EBS = aplikacja „Benefity" |
| Kolejność | **E1** shell+uprawnienia+org → **E2** agencja+HR agencyjny+generator dokumentów → **E3** komunikacja (czat, poczta, AI, notatki, zadania, kalendarz) → **E4** księgowość/KSeF |
| Baza | Struktura do Supabase EBS (`ramedybmybcpqvelsmxd`), migracje przenumerowane na **044+**; dane kopiowane wybiórczo: **szablony dokumentów HR, definicje ról/uprawnień, słowniki modułów** |
| UX logowania | **Auto**: 1 dostępna appka → prosto do niej (zero zmiany dla obecnych userów), >1 → launcher |
| Podejście E1 | **A — port 1:1** (odrzucone: własny launcher „B", big-bang „C") |

## 3. Mapa etapów (przegląd)

- **E1 (ten spec):** shell/launcher, system uprawnień, panel org — fundament.
- **E2:** agencja pracy (`api/agencja/*`), HR agencyjny (noclegi, transport/pojazdy, BHP,
  kandydaci, kontrakty, koordynatorzy+stawki, legalizacja, mapa, OCR „Poczekalnia",
  tłumaczenia, rozliczenia, pulpit), generator dokumentów (`hr/doc-templates` +
  `hr/doc-generate`). Wymaga rozszerzenia ról (`koordynator`, `pracownik_tymczasowy`…)
  i migracji `040_agencja_pracy` (przenumerowanej).
- **E3:** czat, klient poczty (konta mail — uwaga na crony), AI-asystent, notatki, zadania,
  kalendarz, push.
- **E4:** księgowość (KPiR, VAT, faktury, kontrahenci, środki trwałe) + KSeF. **Otwarte
  zderzenie do rozstrzygnięcia w specu E4:** własny KSeF BBS vs Fakturownia (EBS wystawia
  faktury przychodowe przez FA z auto-KSeF; moduł BBS obsługuje m.in. koszty). Limity
  cronów Vercel Hobby (max 2, raz/dobę) — decyzja hostingowa przy E3/E4.

## 4. Etap 1 — zakres kodu (port z BBS-Unified)

Wszystko wchodzi w **nowe** katalogi — zero nadpisywania istniejących plików EBS.

| Źródło (BBS-Unified) | Zawartość |
|---|---|
| `app/(shell)/` | `launcher/page.tsx`, `app/[appId]/page.tsx` (host), `admin/uprawnienia/page.tsx`, `layout.tsx` |
| `components/shell/` | `AppTile`, `EntitlementsPanel`, `TopBar` |
| `lib/apps/` | `registry.ts` (rejestr aplikacji), `access.ts`, `getEntitlements.ts`, `getViewerApps.ts`, `setEntitlement.ts`, `appTargets.ts` **+ testy** (`access.test.ts`, `setEntitlement.test.ts`) |
| `lib/permissions/` | `registry.ts` (klucze `tab`/`action` per moduł), `server.ts` (egzekwowanie; superadmin zawsze wszystko) |
| `lib/auth/postLoginRedirect.ts` (+test) | 1 appka → jej route; inaczej `/launcher` |
| API | `api/me/permissions`, `api/admin/entitlements`, `api/admin/view-config`, `api/permissions/{roles,sync,user-overrides}`, `api/org/users` |
| `components/adminNew/org/` | panel org (użytkownicy organizacji) |

**Pominięte z `app/(shell)`:** `app/agencja/page.tsx` (wejdzie w E2).

### Adaptacje przy porcie

1. `lib/apps/registry.ts` — rejestr EBS: na start tylko `benefity`
   (`defaultRoles: [EMPLOYEE, HR, SUPERADMIN]`). **Bez** `crm`/`siec` (wykluczone),
   `agencja` dojdzie w E2. Typ `AppId` przygotowany na przyszłe: `'benefity' | 'agencja' | 'dokumenty' | 'komunikacja' | 'ksiegowosc'`.
2. `lib/apps/appTargets.ts` — „Benefity" mapuje na istniejące dashboardy EBS per rola:
   `pracownik → /dashboard/employee`, `pracodawca → /dashboard/employer`,
   `superadmin → /dashboard/admin`.
3. `lib/permissions/registry.ts` — `PERMISSION_GROUPS` przycięte do EBS: „Panel systemowy"
   + „Benefity" (klucze zmapowane na faktyczne zakładki adminNew EBS: pulpit, klienci,
   płatności, archiwum, vouchery, szablony, logi). Grupy CRM/Księgowość — usunięte
   (Księgowość wróci w E4).
4. Importy/typy — dostosowanie do EBS (`@/types` EBS ma enum `Role` bez ról BBS-owych;
   używamy wyłącznie ról EBS).
5. `middleware.ts` EBS — `/launcher`, `/app/*` jako ścieżki chronione (EBS ma już
   middleware Supabase SSR — zszycie to dopisanie ścieżek, nie zmiana architektury).
6. Login: `app/(auth)/login` po zalogowaniu pobiera listę appek widocznych dla usera —
   **rozszerzamy istniejący `/api/auth/role` o pole `apps`** (jedno wywołanie, bez zmiany
   flow) — i używa `postLoginRedirect`.
7. Sidebar admina EBS — nowa pozycja **„Uprawnienia"** (`admin-uprawnienia`) prowadząca do
   panelu entitlements; reszta sidebara bez zmian.

## 5. Etap 1 — baza danych (Supabase EBS)

- **`044_shell_entitlements.sql`**: `user_app_entitlements(user_id, app_id, effect
  grant|revoke, granted_by, created_at, PK(user_id, app_id))` + RLS (odczyt własnych
  wierszy; zapis wyłącznie `service_role`). Wzór: BBS `037` + `039`.
- **`045_permissions_overrides.sql`**: tabele szczegółowych uprawnień i view-config —
  dokładny zestaw do zmapowania w planie z BBS `037–041` (endpointy
  `permissions/user-overrides` i `admin/view-config` wskazują na istnienie tabel
  nadpisań per user i konfiguracji widoków).
- **Bez rozszerzania** constraintu ról `user_profiles` — E1 działa na obecnych rolach EBS
  (`pracodawca`, `pracownik`, `superadmin`). Rozszerzenie (koordynator itd.) świadomie
  odłożone do E2.
- **Dane**: jednorazowy skrypt `scripts/import-bbs-permissions.mts` — kopiuje z bazy BBS
  (`vogyfffzlucppmddqsqw`) definicje ról/uprawnień i view-config **z pominięciem kluczy
  CRM**, mapując na strukturę EBS. Szablony dokumentów HR i słowniki modułów — analogiczne
  skrypty w E2 (tam powstaną ich tabele).

## 6. Etap 1 — przepływ logowania

1. Użytkownik loguje się jak dziś (client-side `signInWithPassword`).
2. Frontend pobiera z `/api/auth/role` rolę **+ listę appek** (`getViewerApps`:
   defaultRoles ∪ granty − revoke).
3. `postLoginRedirect(apps)`: jedna appka → jej cel per rola (`appTargets`); więcej →
   `/launcher`.
4. Superadmin: zawsze wszystkie appki → launcher.
5. Wejście bezpośrednie na URL appki bez dostępu → redirect do `/launcher` (guard w
   `app/[appId]`/hostach — jak w BBS).

**Efekt dla obecnych userów:** pracownik i pracodawca mają wyłącznie „Benefity" → trafiają
prosto do swoich dashboardów, **zero widocznej zmiany**.

## 7. Etap 1 — model uprawnień

- **Poziom appek:** `defaultRoles` per appka + wyjątki per użytkownik
  (`user_app_entitlements`, grant/revoke).
- **Poziom funkcji:** klucze `tab`/`action` (`PERMISSION_GROUPS`) z nadpisaniami per
  użytkownik; egzekwowanie server-side (`lib/permissions/server.ts`).
- **Superadmin zawsze ma wszystko** — wymuszone w kodzie serwera, nieobchodzalne z panelu.
- Zarządzanie: **Admin → „Uprawnienia"** (EntitlementsPanel przeniesiony 1:1).

## 8. Weryfikacja

- Port testów jednostkowych (`lib/apps/*.test.ts`, `postLoginRedirect.test.ts`) — vitest
  już skonfigurowany w EBS.
- `npx tsc --noEmit` — 0 błędów (build EBS nie pilnuje typów; pilnujemy ręcznie).
- Smoke po deployu: (a) pracownik loguje się bez zmiany zachowania, (b) superadmin widzi
  launcher i panel Uprawnienia, (c) grant appki koniecznie zmienia widok usera po
  ponownym zalogowaniu, (d) revoke działa, (e) `/launcher` bez sesji → `/login`.

## 9. Ryzyka i świadome decyzje

| Ryzyko | Mitygacja |
|---|---|
| Enum `Role` BBS ma role nieistniejące w EBS | Port przycina do ról EBS; rozszerzenie w E2 razem z migracją ról |
| Kolizje nazw plików między forkami | Wszystko wchodzi w nowe katalogi; żaden istniejący plik EBS nie jest nadpisywany (wyjątki: sidebar admina + login — edycje punktowe) |
| Rozjazd auth (BBS: server actions; EBS: client + `/api/auth/role`) | Zostaje flow EBS; shell dostaje dane z `getViewerApps` — jedno miejsce zszycia |
| Numeracja migracji koliduje (BBS 037+ vs EBS 038+) | Wszystkie migracje BBS przenumerowane do wolnych numerów EBS (044+) |
| Vercel Hobby | E1: zero nowych cronów, zero ciężkich zależności |

## 10. Poza zakresem E1

- Moduły E2–E4 (osobne specy).
- CRM — wykluczony **na stałe** (osobny CRM Stratton Prime; integracja wg specu z 2026-06-17).
- Zmiany w istniejących dashboardach EBS poza dodaniem zakładki „Uprawnienia".
- Migracja danych innych niż definicje uprawnień/view-config.
