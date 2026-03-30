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

All shared TypeScript interfaces are in `types.ts`. Roles: `SUPERADMIN`, `HR`, `EMPLOYEE`, `DIRECTOR`, `MANAGER`, `ADVISOR`. Core models: `User`, `Voucher`, `Company`, `Order`, `BuybackAgreement`, `Notification`, `Commission`, `SystemConfig`.

### AI Integration

`DashboardEmployee` includes an AI Legal Assistant powered by Google Gemini (`@google/generative-ai`). The API key is loaded from `VITE_GEMINI_API_KEY` in `.env.local`.

### Path Aliases

`@/` maps to the repository root (configured in `tsconfig.json` and `vite.config.ts`).
