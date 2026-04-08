# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server on port 3005
node server/app.js   # Start PDF generation server on port 3001 (required for document export)

# Build & preview
npm run build
npm run preview

# Tests
npx jest services/payrollService.test.ts   # Run payroll service unit tests
```

## Architecture

**STRATTON PRIME: Eliton Benefits System (EBS)** — enterprise benefits management platform with role-based portals.

### State Management

All application state lives in `context/StrattonContext.tsx` (StrattonProvider). It composes modular hooks:
- `hooks/modules/useUserLogic.ts` — auth, user CRUD
- `hooks/modules/useOrderLogic.ts` — order placement & approval
- `hooks/modules/useVoucherLogic.ts` — voucher lifecycle
- `hooks/modules/useNotificationLogic.ts` — notifications

State is persisted to `localStorage` via `hooks/usePersistedState.ts`. Components access state via `hooks/useStrattonState.ts` and actions via `hooks/useStrattonSystem.ts`.

Initial demo data is seeded from `services/mockData.ts`.

### Routing

There is no router library. `App.tsx` renders views conditionally based on `currentUser.role`:
- No user → `LoginScreen`
- `SUPERADMIN` → `DashboardSuperadmin`
- `HR` → `DashboardHR`
- `EMPLOYEE` → `DashboardEmployee`
- `DIRECTOR` / `MANAGER` / `ADVISOR` → `DashboardSales`

### Backend (PDF Server)

`server/app.js` is a separate Express server (port 3001) using Puppeteer. It handles `POST /api/generate-pdf` for document types: `DEBIT_NOTE`, `VAT_INVOICE`, `BUYBACK_AGREEMENT`, `IMPORT_REPORT`, `PROTOCOL`. Must be running independently alongside the Vite dev server.

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

Consumers import from `../types` or `@/types` — bez zmian. `types/database.ts` pozostaje osobnym plikiem Supabase schema (nie przez barrel).

### AI Integration

`DashboardEmployee` includes an AI Legal Assistant powered by Google Gemini (`@google/generative-ai`). The API key is loaded from `VITE_GEMINI_API_KEY` in `.env.local`.

### Extracted Sub-Components & Helpers

Podczas refaktoryzacji wyciągnięto:
- `utils/hrUtils.tsx` — typy i helpery HR (`HrOrder`, `STATUS_MAP`, `formatPeriod`, `buildOrderReportHtml`)
- `utils/formatters.ts` — `formatCurrency`, `formatDate` (współdzielone)
- `lib/documents/pdfUtils.ts` — `ISSUER`, `generatePdfBuffer`, `uploadPdf`
- `lib/documents/umowaService.ts` — `createUmowaDocument`, `UmowaContext`
- `components/hr/dashboard/HRPageHeader.tsx` — nagłówek Panelu Kadrowego + definicja typu `HRTab`
- `components/hr/dashboard/documentBinderHelpers.ts` — `sanitizeFilename`, `generateClientSidePdf`, `enrichBatchWithRanges`
- `components/hr/modals/HROrderPickerModal.tsx` — modal wyboru zamówienia do PDF
- `components/hr/modals/HROrderHistoryModal.tsx` — modal historii zamówień HR
- `components/hr/modals/HRAddEmployeeModal.tsx` — modal dodawania pracownika
- `components/hr/dashboard/EmployeeCard.tsx` — `EmpDetailRow`, `EmployeeCard`
- `components/employee/dashboard/EmployeeWidgets.tsx` — `SectionDivider`, `AppIconCard`, `FloatingTabBar`
- `components/employee/dashboard/legal/wizardData.tsx` — `CONSUMER_WIZARD_DATA`
- `components/employee/dashboard/legal/categoryConfig.ts` — `CATEGORY_LABELS`, `CATEGORY_COLORS`
- `components/employee/dashboard/legal/documentTemplates.ts` — `DOCUMENT_TEMPLATES`
- `components/employee/dashboard/legal/constants.ts` — barrel re-export powyższych 3

`HRTab` jest definiowany i eksportowany z `HRPageHeader.tsx` — importuj stamtąd, nie deklaruj lokalnie.

### Path Aliases

`@/` maps to the repository root (configured in `tsconfig.json` and `vite.config.ts`).
