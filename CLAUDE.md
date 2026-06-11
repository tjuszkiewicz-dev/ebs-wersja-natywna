# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npx next dev --port 3010   # Start Next.js dev server (PRIMARY - deploys to Vercel)
node server/app.js          # Start PDF generation server on port 3015 (required for document export)

# Build
npm run build   # next build (Vite fully removed — deps + config)
npm start       # next start (production server)
```

> Brak skryptu `preview` i brak `jest` w zależnościach. `services/payrollService.test.ts`
> istnieje, ale jest osierocony (test runner nieskonfigurowany) — patrz „Dead Code / Audit".

## Architecture

**STRATTON PRIME: Eliton Benefits System (EBS)** — enterprise benefits management platform with role-based portals.

### Framework

**Next.js 15 (App Router)** is the sole frontend framework. Vite has been removed entirely — config files (`index.html`, `App.tsx`, `vite.config.ts`) **and** the `vite` / `@vitejs/plugin-react` dev-dependencies (audyt 2026-06-12). The project deploys to **Vercel** on every push to `main`.

- Next.js dev: port `3010`
- PDF server: port `3015` (changed from 3001/3012)
- Animacje: `motion` (Framer Motion) + `ogl` (shader aurora). Usunięto martwe `three`, `@react-three/*`, `gsap` — patrz „Dead Code / Audit".

### Auth

Supabase SSR (`@supabase/ssr`) + cookie-based sessions.
- Supabase project: `ramedybmybcpqvelsmxd.supabase.co`
- **Faktyczny flow logowania**: `app/(auth)/login/page.tsx` loguje przez `supabaseBrowser` (client-side `signInWithPassword`), następnie `GET /api/auth/role` ustala rolę i przekierowanie. Server-side endpoint: `POST /api/auth/login` (oraz `login-v2`).
- ⚠️ `app/actions/auth.ts` (`loginAction`) jest **nieużywany** (martwy kod — patrz „Dead Code / Audit"). Nie polegać na nim.
- Roles: `pracodawca` → `Role.HR`, `pracownik` → `Role.EMPLOYEE`, `superadmin` → `Role.SUPERADMIN`

### Routing (Next.js App Router)

- `/login` → `app/(auth)/login/page.tsx`
- `/dashboard/employee` → `app/dashboard/employee/page.tsx` → `EmployeeDashboardClient`
- `/dashboard/employer` → `app/dashboard/employer/page.tsx` → `EmployerDashboardClient`
- `/dashboard/admin` → `app/dashboard/admin/page.tsx`
- `/dashboard/network` → `app/dashboard/network/page.tsx`

Dashboard clients (`app/dashboard/_components/`) bridge Supabase session ↔ StrattonContext via `DashboardBootstrap`.

### State Management

All application state lives in `context/StrattonContext.tsx` (StrattonProvider). It composes modular hooks:
- `hooks/modules/useUserLogic.ts` — auth, user CRUD
- `hooks/modules/useOrderLogic.ts` — order placement & approval
- `hooks/modules/useVoucherLogic.ts` — voucher lifecycle
- `hooks/modules/useNotificationLogic.ts` — notifications

State is persisted to `localStorage` via `hooks/usePersistedState.ts`. Components access state and actions via the `useStrattonState` / `useStrattonSystem` hooks **exported from `context/StrattonContext.tsx`** (the standalone `hooks/useStrattonSystem.ts` is orphaned — patrz „Dead Code / Audit").

Initial demo data is seeded from `services/mockData.ts`.

### Backend (PDF Server)

`server/app.js` is a separate Express server (port **3015**) using Puppeteer. It handles `POST /api/generate-pdf` for document types: `DEBIT_NOTE`, `VAT_INVOICE`, `BUYBACK_AGREEMENT`, `IMPORT_REPORT`, `PROTOCOL`. Must be running independently alongside the Next.js dev server.

### Employee Dashboard Layout (`EmployeeDashboardClient.tsx`)

`app/dashboard/_components/EmployeeDashboardClient.tsx` — full layout with:
- Black header (`bg-black`) with EBS logo (`/ebs-black.svg` + CSS `brightness(0) invert(1)` for white), search bar, balance widget, expiry widget, notifications, logout
- Hamburger `<Menu>` button (mobile only, `md:hidden`) → opens sidebar drawer (`isMobileSidebarOpen`)
- Desktop sidebar toggle (`hidden md:flex`) → `isDesktopSidebarOpen`
- `Sidebar` component (black theme)
- `SoftAurora` background (WebGL shader from `components/ui/SoftAurora.tsx`, `ssr: false`)
- `<main className="main-zoom">` — zoom 0.9 only on desktop via CSS (see `index.css`)
- Orange popup (`/popup_orange.png`) shown every login — `useState(true)`, no localStorage gate
  - Mobile: slides from bottom (`items-end`, `rounded-t-3xl`), Desktop: centered (`sm:items-center`, `rounded-2xl`)
- 3-column layout on `xl` screens: `240px` banner slots + center content
- Aurora params: `speed=0.4, scale=1.2, brightness=1.6, color1="#30df6a", color2="#4297cd", noiseFrequency=2, noiseAmplitude=3, bandHeight=0.7, bandSpread=1, octaveDecay=0.27, layerOffset=0.25`

### Employee Dashboard Content (`DashboardEmployee.tsx`)

`views/DashboardEmployee.tsx` — 3-column content layout:
- Left bottom banner (h=200): `<img src="/orange.png" className="w-full h-full object-cover" />`
- Right bottom banner (h=200): `<img src="/PZU.png" className="w-full h-full object-cover" />`

### Admin Dashboard Layout (`AdminDashboardClient.tsx`)

`app/dashboard/_components/AdminDashboardClient.tsx` — light-themed layout with:
- `AdminLayout` function: sidebar + white header + `<DashboardAdminNew>`
- Header: `bg-white border-slate-200`, hamburger on mobile, logo, search (Ctrl+K), notifications, logout
- Background: `backgroundColor: '#f1f5f9'`
- `currentView` state synced with `DashboardAdminNew` for tab navigation
- No StrattonContext props for content — `adminNew` components fetch data via API routes directly

### New Admin Panel (`DashboardAdminNew.tsx` + `components/adminNew/`)

`views/DashboardAdminNew.tsx` — tab-based admin UI:
- Tabs: **Pulpit**, **Baza klientów**, **Płatności i faktury**, **Archiwum**, **Vouchery**
- `VIEW_TO_TAB` mapping syncs Sidebar navigation with tab state
- `-m-4 md:-m-8` to compensate parent padding
- Each tab is a standalone component in `components/adminNew/` — fetches own data from API routes (`/api/companies`, `/api/vouchers`, etc.)

### Sidebar (`components/Sidebar.tsx`)

Auto-themes based on role:
- `EMPLOYEE` → black theme (`bg-black`, white text)
- Other roles → white/light theme

**SUPERADMIN menu items**:
```
admin-pulpit     Pulpit              LayoutDashboard
admin-klienci    Baza klientów       Users
admin-platnosci  Płatności i faktury CreditCard
admin-archiwum   Archiwum            FolderOpen
admin-vouchery   Vouchery            Ticket
```

### CSS (`index.css`)

Custom classes:
- `.main-zoom` — `zoom: 1` default, `zoom: 0.9` on `@media (min-width: 768px)` → desktop-only scaling
- `.pb-safe` — safe area padding for mobile

### Accounts (Supabase)

Produkcyjna baza: `ramedybmybcpqvelsmxd.supabase.co` — zawiera 12 auth users, 8 z profilem w `user_profiles`.

**Konta z profilem (produkcja):**

| Email | Rola | Imię i nazwisko | Firma (company_id prefix) | Hasło tymczasowe |
|---|---|---|---|---|
| `admin@eliton-benefits.com` | `superadmin` | System Administrator | — | — |
| `natalia.kvk@stratton-prime.pl` | `superadmin` | Natalia Kvk | — | — |
| `j.jablonski@stratton-prime.pl` | `superadmin` | J. Jabłoński | — | — |
| `m.hagno@stratton-prime.pl` | `pracodawca` | Maciej Hagno | `f03ed36e` (Stratton Prime) | — |
| `t.juszkiewicz@gmail.com` | `pracodawca` | Tomasz Juszkiewicz | `f03ed36e` (Stratton Prime) | `uz7u2hq9rdpMBJLO37JHLM!` |
| `biuro@aneza.pl` | `pracodawca` | Agnieszka Cięciara | `8dbe726e` (Aneza) | — |
| `pasek.agnieszka@wp.pl` | `pracownik` | AGNIESZKA PASEK | `8dbe726e` (Aneza) | `u7fjcez88jbGJHVNE6DB64!` |
| `j.drobnikowska.bazyluk@gmail.com` | `pracownik` | JOANNA DROBNIKOWSKA-BAZYLUK | `8dbe726e` (Aneza) | `pqp51yllud3INZ0MXVDNM!` |
| `katarzynacygan@op.pl` | `pracownik` | KATARZYNA CYGAN | `8dbe726e` (Aneza) | `BF61fczv25!` |
| `maciej.hagno@gmail.com` | `pracownik` | Maciej Hagno | `f03ed36e` (Stratton Prime) | `wjohc1wcuwfR9VRL78GEVF!` |

**Konta auth BEZ profilu (testowe/nieużywane):** `k.nowak@firma.pl`, `j.kowalski@firma.pl`, `dlkso@wp.pl`, `vcx@wp.pl`

**Znane hasła (nie przechowywane w DB):**
- `admin@eliton-benefits.com` → `Password123!`
- `biuro@aneza.pl` (Agnieszka Cięciara) → `Afryka1974`
- `natalia.kvk@stratton-prime.pl` → `Stratton1.`
- `j.jablonski@stratton-prime.pl` → `Stratton1.`

> Kolumna `temp_password` w `user_profiles` przechowuje hasło jednorazowe generowane przy tworzeniu konta pracownika (plaintext — do zmiany przy pierwszym logowaniu).

### Key Types

`types.ts` is a barrel that re-exports all domain type files from `types/`:
- `types/enums.ts` — wszystkie enumy: `Role`, `VoucherStatus`, `OrderStatus`, `ContractType`, `NotificationTrigger`, `ServiceType`, `DocumentType`, `CommissionType`, itp.
- `types/user.ts` — `User`, `UserIdentity`, `UserOrganization`, `UserContract`, `UserFinance`, `UserAddress`, `IbanChangeRequest`
- `types/company.ts` — `Company`
- `types/voucher.ts` — `Voucher`, `Transaction`, `DistributionBatch`, `BuybackAgreement`
- `types/order.ts` — `Order`, `PayrollEntry`, `PayrollSnapshot`, `PayrollDecision`, `ImportRow`, `ImportHistoryEntry`
- `types/core.ts` — `EntityType`, `AuditLogEntry`, `Commission`, `QuarterlyPerformance`, `AnalyticMetric`
- `types/notification.ts` — `Notification`, `NotificationAction`, `NotificationConfig`
- `types/system.ts` — `SystemConfig`, `ServiceItem`, `DocumentTemplate`, `SupportTicket`, `IntegrationConfig`

Consumers import from `../types` or `@/types`. `types/database.ts` pozostaje osobnym plikiem Supabase schema (nie przez barrel).

### AI Integration

`DashboardEmployee` includes an AI Legal Assistant powered by Google Gemini (`@google/generative-ai`). The API key is loaded from `VITE_GEMINI_API_KEY` in `.env.local`.

`LegalAssistantDashboard` is loaded with `next/dynamic` + `ssr: false` (uses `html2pdf.js` which requires browser `self`).

### UI Components (react-bits)

Available in `components/ui/` and `components/bits/`:
- `components/ui/SoftAurora.tsx` + `SoftAurora.css` — WebGL shader aurora (OGL-based), use with `ssr: false`
- `components/ui/Orb.tsx` + `Orb.css` — animated orb
- `components/ui/MagicRings.tsx` + `MagicRings.css`
- `components/ui/ServiceCarousel.tsx` — Embla carousel, 4-column layout (`md:flex-[0_0_25%]`), `AppIconCard` min-height `220px`
- `components/bits/StarBorder/`
- `components/employee/mobile/WalletCard.tsx` — animated voucher balance card, `p-8` padding, white text

### Extracted Sub-Components & Helpers

- `utils/hrUtils.tsx` — typy i helpery HR (`HrOrder`, `STATUS_MAP`, `formatPeriod`, `buildOrderReportHtml`)
- `utils/formatters.ts` — `formatCurrency`, `formatDate`
- `lib/documents/pdfUtils.ts` — `ISSUER`, `generatePdfBuffer`, `uploadPdf`
- `lib/documents/umowaService.ts` — `createUmowaDocument`, `UmowaContext`
- `components/hr/dashboard/HRPageHeader.tsx` — nagłówek Panelu Kadrowego + definicja typu `HRTab`
- `components/hr/dashboard/documentBinderHelpers.ts` — `sanitizeFilename`, `generateClientSidePdf`, `enrichBatchWithRanges`
- `components/hr/modals/HROrderPickerModal.tsx`, `HROrderHistoryModal.tsx`, `HRAddEmployeeModal.tsx`
- `components/hr/dashboard/EmployeeCard.tsx` — `EmpDetailRow`, `EmployeeCard`
- `components/employee/dashboard/EmployeeWidgets.tsx` — `SectionDivider`, `AppIconCard`, `FloatingTabBar`
- `components/employee/dashboard/legal/constants.ts` — barrel re-export `wizardData`, `categoryConfig`, `documentTemplates`

`HRTab` jest definiowany i eksportowany z `HRPageHeader.tsx` — importuj stamtąd, nie deklaruj lokalnie.

### Path Aliases

`@/` maps to the repository root (configured in `tsconfig.json`).

### Known Issues / Gotchas

- Browser-only libraries (`html2pdf.js`, `ogl`/SoftAurora) must be loaded with `next/dynamic` + `{ ssr: false }`
- `ebs-black.svg` exists in `public/`; white version achieved via CSS `filter: brightness(0) invert(1)` — do NOT rely on `ebs-white.svg`
- `zoom` CSS property is in `.main-zoom` CSS class (not inline style) — applies desktop-only via media query
- All UI changes must work identically on **localhost:3010** AND **Vercel** — no localStorage-gated visibility

### Dead Code / Audit (2026-06-12)

Audyt repo. **Faza 1 (wykonana)** — usunięto śmieci i martwe zależności:
- Usunięto fizycznie: `dist/` (61 MB build po Vite), `ebs-stack-report.pdf`, zarejestrowany worktree `.claude/worktrees/`.
- `.gitignore`: dodano `.claude/worktrees/`, `tsconfig.tsbuildinfo` (odpięty z gita), `/ebs-stack-report.pdf`.
- Usunięto z `package.json` (0 importów): `vite`, `@vitejs/plugin-react`, `three`, `@react-three/drei`, `@react-three/fiber`, `gsap`, `@gsap/react`, `@supabase/auth-ui-react`, `@supabase/auth-ui-shared`, `@types/three`.

**Faza 2 (do zrobienia) — 49 błędów TypeScript** (dwie przyczyny):
1. Większość: route handlery używają starej, synchronicznej sygnatury `params` zamiast Next.js 15 `Promise<...>`. Wzorzec: `{ params }: { params: Promise<{ id: string }> }` + `await params`. Dotyczy m.in. `app/api/companies/[id]/**`, `app/api/users/[id]/finance`.
2. Klaster w `app/api/companies/[id]/financials/route.ts`: zapytanie Supabase wybiera kolumnę `umowa_pdf_url`, która **nie istnieje** na `voucher_orders` → kaskada `TS2339`. Sprawdź realny schemat (migracje) i popraw nazwę kolumny.

**Faza 3 (do zrobienia) — martwy kod (zweryfikowany, 0 importów)**, kandydaci do usunięcia:
- `app/actions/auth.ts` (`loginAction` nieużywany — login idzie przez `supabaseBrowser` + `/api/auth/role`)
- `hooks/useStrattonSystem.ts` (duplikat — realny w `context/StrattonContext.tsx`)
- Stary, rozbity panel HR osierocony przez monolit `views/DashboardNewHR.tsx` (3016 linii):
  - cały `components/hr/dashboard/` (`HRPageHeader`, `HRDocumentBinder`, `HRCommandCenter`, `HREmployeeTable`, `HRDistributionWidget`, `HRShortcuts`, `HRDashboardGuide`, `HREmployeeGuide`, `SettlementGuide`, `HRImportHistoryTable`)
  - `components/hr/modals/` (`EmployeeEditModal`, `EmployeeHistoryModal`, `DistributionModal`, `DistributionChoiceModal`, `DistributionEvidenceModal`, `BulkTransferModal`)
  - `components/hr/` (`EmployeeImportModal`, `HRIntegrationsManager`, `HRReportCenter`)
  - inne: `components/DocumentModal.tsx`, `components/ui/Orb.tsx`, `components/employee/dashboard/EmployeeStats.tsx`, `OrangeOfferSection`, `PZUServiceSection`, `components/employee/mobile/MobileNav.tsx`, `components/ui/EmptyState.tsx`, `components/notifications/NotificationPreferences.tsx`, `MarketplaceHero`, `ElitonBanner`, `CaseListView`
  - `services/payrollService.test.ts` (brak test runnera)

> ⚠️ Sekcja „Extracted Sub-Components & Helpers" powyżej wymienia część komponentów HR, które są teraz osierocone — przed użyciem sprawdź, czy nie są na powyższej liście Fazy 3.

**Bezpieczeństwo (osobno)**: `npm audit` zgłasza 18 podatności (1 krytyczna) — głównie `xlsx`. Rozważ migrację z `xlsx` na `exceljs` (już w projekcie).

