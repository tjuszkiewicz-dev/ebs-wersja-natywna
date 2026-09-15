# Sklep benefitów v2 — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nowy sklep benefitów w portalu pracownika (układ Immich: kategorie po potrzebach, wyszukiwarka, siatka obrazkowa, jasny motyw) z dwiema ścieżkami — zakup za punkty realizowany przez BOK i „Zapytaj o ofertę" — oraz naprawa mechanizmu zakupu, który na produkcji nigdy nie zadziałał.

**Architecture:** Katalog zostaje w kodzie (`INITIAL_SERVICES`) i dostaje kategorię/partnera/sposób realizacji. Cała logika decyzyjna (filtr, grupowanie, wybór akcji, walidacja ceny, deduplikacja zgłoszeń, treść maili) to czyste funkcje w `lib/benefits/*` z testami; komponenty w `components/employee/store/*` są prezentacyjne i dostają dane przez propsy z `DashboardEmployee`. Zakup idzie przez istniejący `RedemptionModal` → `useVoucherLogic.handleServicePurchase` → `POST /api/vouchers/purchase`, który po naprawie waliduje cenę z katalogiem i realizuje vouchery jedną atomową funkcją bazy (migracja 061). Zapytania idą przez nowy `POST /api/benefits/inquiry` z tabelą `benefit_inquiries`. Stary układ Pulpitu zostaje w kodzie pod stałą `STORE_LAYOUT = 'v1'`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, `motion`, `lucide-react`, Supabase (service_role po stronie serwera, RLS deny-all), Zod, vitest, nodemailer (`lib/mailer`), Vercel (deploy ręczny `npx vercel --prod --yes`).

**Spec:** `docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md` — czytać przy każdym tasku; ten plan go realizuje, nie zastępuje.

## Global Constraints

- Katalog **wyłącznie w kodzie** (`services/mockData.ts`); tabela `services` w bazie pozostaje nieużywana. Ceny istniejących pozycji **bez zmian**; nowe pozycje partnerskie z ceną **0**. 1 pkt = 1 zł realnego vouchera — **żadnych cen z głowy**.
- Stary układ Pulpitu i karuzele **zostają w kodzie**, wyłączone stałą `STORE_LAYOUT` (`lib/benefits/storeLayout.ts`). Nie kasować JSX karuzel ani `handlePartnerRequest`.
- 6 kategorii, dokładnie w tej kolejności: Zdrowie · Ubezpieczenia · Finanse · Rozwój · Rodzina · Codzienność.
- Adres BOK: `process.env.BOK_EMAIL ?? 'bok@stratton-prime.pl'`; termin: „2 dni roboczych" (stała `BOK_SLA_TEXT`).
- Cena 0 **nigdy** nie trafia do `/api/vouchers/purchase` — ma własną ścieżkę `/api/benefits/inquiry`.
- Nowe tabele: RLS włączone, **bez polityk** (deny-all), dostęp tylko service_role. Funkcje `SECURITY DEFINER` z `SET search_path = public, pg_temp` i `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role`.
- Brak sesji → 401, zła rola → 403, zła treść → 400 (wzorce z `app/api/vouchers/purchase`).
- Tabele spoza `types/database.ts` → `(supabase as any).from(...)` (konwencja repo).
- Komity: małe, po polsku, bez `git add -A` — zawsze konkretne ścieżki; stopka `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Przed napisaniem JSX sklepu (Task 8): wywołać `/ui-ux-pro-max` i `/design-taste-frontend` (reguła nadrzędna z globalnego `CLAUDE.md`); MotionSites/21st.dev bez OAuth — odnotować w raporcie, nie blokować.
- Testy: `npx vitest run` (36 plików, 341 testów zielonych na starcie — utrzymać zielone); `npx tsc --noEmit` = 0 błędów (build nie pilnuje typów!); `npm run build` exit 0.
- Ścieżki w tym planie względem katalogu repo `C:\Users\Użytkownik\Desktop\ebs-wersja-natywna`.

---

## Mapa plików

| Plik | Rola | Task |
|---|---|---|
| `types/enums.ts` | `BenefitCategory` | 1 |
| `types/system.ts` | `ServiceItem` += `category`, `partner?`, `fulfillment?`; `BenefitFulfillment`; `PurchaseResult` | 1 |
| `services/mockData.ts` | katalog z kategoriami + 13 nowych pozycji | 1 |
| `services/mockData.test.ts` | spójność katalogu | 1 |
| `context/StrattonContext.tsx` | klucz `ebs_services_v16`; typ `handleServicePurchase` | 1, 5 |
| `views/DashboardEmployee.tsx` | konstrukcje `ServiceItem` z kategorią (1); v2 + sklep (10) | 1, 6, 10 |
| `lib/benefits/catalog.ts` + `.test.ts` | kategorie, filtr, grupowanie, sortowanie, `resolveAction`, `findCatalogItem`, mapa zakładek aplikacji | 2 |
| `lib/benefits/constants.ts` | `BOK_EMAIL`, `BOK_SLA_TEXT`, `STORE_TITLE` | 3 |
| `lib/benefits/mails.ts` + `.test.ts` | 4 buildery e-maili | 3 |
| `lib/benefits/inquiry.ts` + `.test.ts` | okno deduplikacji | 3 |
| `app/api/contact-bok/route.ts` | użycie `BOK_EMAIL` | 3 |
| `supabase/migrations/061_sklep_benefitow.sql` | naprawa `redeem_voucher`, `redeem_vouchers_for_service`, `benefit_inquiries` | 4 |
| `lib/users/accountPurge.ts` | `benefit_inquiries` w `OWNED_TABLES` | 4 |
| `lib/benefits/purchaseValidation.ts` + `.test.ts` | walidacja `serviceId`/`amount` z katalogiem | 5 |
| `app/api/vouchers/purchase/route.ts` | walidacja, atomowa RPC, e-maile | 5 |
| `hooks/modules/useVoucherLogic.ts` | `handleServicePurchase` → `Promise<PurchaseResult>`; DEBIT dla `wykorzystanie` | 5 |
| `components/employee/RedemptionModal.tsx` | nowy kontrakt, kroki, bez QR | 6 |
| `app/api/benefits/inquiry/route.ts` | zgłoszenia | 7 |
| `components/employee/store/StoreHeader.tsx`, `StoreCategories.tsx`, `StoreGrid.tsx`, `BenefitStore.tsx` | powłoka sklepu, kategorie, siatka | 8 |
| `components/employee/store/StoreDetail.tsx` | panel szczegółów, 4 akcje | 9 |
| `lib/benefits/storeLayout.ts` | `STORE_LAYOUT` | 10 |
| `components/Sidebar.tsx` | menu pracownika v2 | 10 |
| `CLAUDE.md` | sekcja o sklepie | 11 |

---

### Task 1: Model katalogu — kategorie, partner, sposób realizacji, nowe pozycje

**Files:**
- Modify: `types/enums.ts` (koniec pliku)
- Modify: `types/system.ts:1` (import) i `types/system.ts:89-98` (`ServiceItem`)
- Modify: `services/mockData.ts:316-413` (`INITIAL_SERVICES`)
- Modify: `context/StrattonContext.tsx:112` (klucz `ebs_services_v15` → `v16`)
- Modify: `views/DashboardEmployee.tsx:147-165` (konstrukcje `ServiceItem` dostają `category`)
- Test: `services/mockData.test.ts`

**Interfaces:**
- Produces: `BenefitCategory` (enum, 6 wartości), `BenefitFulfillment = 'auto' | 'bok'`, `PurchaseResult = { ok: boolean; error?: string }`, `ServiceItem.category` (wymagane), `ServiceItem.partner?`, `ServiceItem.fulfillment?`; katalog z identyfikatorami z §4.2 specu (`SRV-P-*`, `SRV-SECURE-01`, `SRV-VAULT-01`).

- [ ] **Step 1: Test spójności katalogu (ma nie przejść — brak pola `category` i nowych pozycji)**

`services/mockData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { INITIAL_SERVICES } from './mockData';
import { BenefitCategory } from '@/types/enums';

describe('INITIAL_SERVICES — katalog sklepu benefitów', () => {
  const ids = INITIAL_SERVICES.map(s => s.id);

  it('każda pozycja ma kategorię z enumu', () => {
    const allowed = new Set(Object.values(BenefitCategory));
    for (const s of INITIAL_SERVICES) {
      expect(allowed.has(s.category), `${s.id} bez kategorii`).toBe(true);
    }
  });

  it('identyfikatory są unikalne', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('zawiera 11 nowych pozycji partnerskich z ceną 0 i Medicover', () => {
    const partnerIds = ids.filter(id => id.startsWith('SRV-P-'));
    expect(partnerIds).toHaveLength(11);
    for (const id of partnerIds) {
      const s = INITIAL_SERVICES.find(x => x.id === id)!;
      expect(s.price, `${id} ma mieć cenę 0`).toBe(0);
      expect(s.partner, `${id} bez partnera`).toBeTruthy();
    }
    expect(INITIAL_SERVICES.find(s => s.id === 'SRV-P-MEDICOVER')?.category).toBe(BenefitCategory.ZDROWIE);
  });

  it('cztery aplikacje Eliton są w katalogu z fulfillment=auto', () => {
    for (const id of ['SRV-MENTAL-01', 'SRV-LEGAL-01', 'SRV-SECURE-01', 'SRV-VAULT-01']) {
      const s = INITIAL_SERVICES.find(x => x.id === id);
      expect(s, `${id} brak w katalogu`).toBeTruthy();
      expect(s!.fulfillment).toBe('auto');
      expect(s!.price).toBeGreaterThan(0);
    }
  });

  it('ceny istniejących pozycji bez zmian (próbka)', () => {
    const price = (id: string) => INITIAL_SERVICES.find(s => s.id === id)!.price;
    expect(price('SRV-01')).toBe(20);        // Spotify
    expect(price('SRV-04')).toBe(25);        // Multikino
    expect(price('SRV-03')).toBe(200);       // porada prawna
    expect(price('SRV-MENTAL-01')).toBe(100);
  });
});
```

- [ ] **Step 2: Uruchom test — ma nie przejść**

Run: `npx vitest run services/mockData.test.ts`
Expected: FAIL (`BenefitCategory` nie istnieje / brak `SRV-P-*`).

- [ ] **Step 3: Enum i typy**

Na końcu `types/enums.ts` dopisz:
```ts
/** Kategorie sklepu benefitów — po potrzebach pracownika, nie po partnerach (spec 2026-09-15 §4.1). */
export enum BenefitCategory {
  ZDROWIE = 'ZDROWIE',
  UBEZPIECZENIA = 'UBEZPIECZENIA',
  FINANSE = 'FINANSE',
  ROZWOJ = 'ROZWOJ',
  RODZINA = 'RODZINA',
  CODZIENNOSC = 'CODZIENNOSC',
}
```

W `types/system.ts` zmień import na `import { Role, DocumentType, ServiceType, BenefitCategory } from './enums';` i zastąp interfejs `ServiceItem`:
```ts
/** 'auto' = aplikacja Eliton odblokowuje się sama po zakupie; 'bok' = BOK realizuje ręcznie (domyślnie). */
export type BenefitFulfillment = 'auto' | 'bok';

/** Wynik zakupu za punkty — zwracany przez hook i modal (spec §6.3). */
export interface PurchaseResult {
  ok: boolean;
  error?: string;
  transactionId?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;                    // punkty; 1 pkt = 1 zł vouchera; 0 = „Zapytaj o ofertę"
  type: ServiceType;
  icon: string;
  image?: string;
  isActive: boolean;
  category: BenefitCategory;
  partner?: string;                 // nazwa partnera/brokera na kafelku i w mailu do BOK
  fulfillment?: BenefitFulfillment; // brak = 'bok'
}
```

- [ ] **Step 4: Katalog — kategorie dla istniejących pozycji i nowe pozycje**

W `services/mockData.ts` dodaj `BenefitCategory` do importu z `'../types'` (barrel eksportuje enumy). Każdej istniejącej pozycji `INITIAL_SERVICES` dopisz `category` wg tabeli (ceny nietknięte):

| id | category | dodatkowo |
|---|---|---|
| `SRV-MENTAL-01` | `ZDROWIE` | `partner: 'Eliton', fulfillment: 'auto'` |
| `SRV-LEGAL-01` | `CODZIENNOSC` | `partner: 'Eliton', fulfillment: 'auto'` |
| `SRV-LEGAL-SINGLE` | `CODZIENNOSC` | `partner: 'Eliton'` |
| `SRV-ORANGE-FIBER`, `SRV-ORANGE-GSM` | `CODZIENNOSC` | `partner: 'Orange'` |
| `SRV-ORANGE-LOVE` | `RODZINA` | `partner: 'Orange'` |
| `SRV-01` Spotify, `SRV-02` Audioteka, `SRV-03` Porada prawna, `SRV-04` Multikino | `CODZIENNOSC` | `partner`: `'Spotify'`, `'Audioteka'`, `'Kancelaria partnerska'`, `'Multikino'` |
| `SRV-AI-01…05` | `ROZWOJ` | `partner: 'Eliton'` |
| `SRV-MH-01…05` | `ZDROWIE` | `partner: 'Eliton'` |
| `SRV-FIN-01`, `SRV-FIN-02`, `SRV-FIN-05` | `FINANSE` | `partner: 'Eliton'` |
| `SRV-FIN-03`, `SRV-FIN-04` | `ROZWOJ` | `partner: 'Eliton'` |
| `SRV-LIFE-01`, `SRV-LIFE-02` | `RODZINA` | `partner: 'Eliton'` |
| `SRV-LIFE-03`, `SRV-LIFE-04` | `CODZIENNOSC` | `partner: 'Eliton'` |
| `SRV-LIFE-05` | `ROZWOJ` | `partner: 'Eliton'` |

Na końcu tablicy (przed `];`) dopisz blok `// --- PARTNERZY (sklep v2, 2026-09-15) — cena 0 = „Zapytaj o ofertę" ---`. Obrazki skopiuj z odpowiednich kafelków w `views/DashboardEmployee.tsx` (sekcje Profitowi/Multipolisa/Goldman, linie ~322–420); opisy 1:1 z `desc` tych kafelków.
```ts
  { id: 'SRV-P-LUXMED',     name: 'Luxmed — Pakiet Optyka i Rehabilitacja', description: 'Szybki dostęp do specjalistów, optyka i rehabilitacja.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'HeartPulse', image: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.ZDROWIE, partner: 'Profitowi' },
  { id: 'SRV-P-TUZDROWIE',  name: 'TU Zdrowie — Pakiet badań profilaktycznych', description: 'Pakiet podstawowych badań i przeglądowy dla aktywnych.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'Stethoscope', image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.ZDROWIE, partner: 'Multipolisa.pl' },
  { id: 'SRV-P-MEDICOVER',  name: 'Medicover — Pakiet opieki medycznej', description: 'Prywatna opieka medyczna dla Ciebie i rodziny — zapytaj o ofertę dla pracowników.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'HeartPulse', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.ZDROWIE, partner: 'Medicover' },
  { id: 'SRV-P-PZU',        name: 'PZU — Ubezpieczenie NNW pracownicze', description: 'Ochrona całą dobę, w pracy i poza nią.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'ShieldCheck', image: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.UBEZPIECZENIA, partner: 'Profitowi' },
  { id: 'SRV-P-UNIGA',      name: 'Uniga — Ubezpieczenie na życie', description: 'Szerokie ubezpieczenie na życie dla rodziny.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'ShieldCheck', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.UBEZPIECZENIA, partner: 'Profitowi' },
  { id: 'SRV-P-LOYDS',      name: 'Loyds — Ubezpieczenie od utraty dochodu', description: 'Zabezpieczenie dochodu dla menedżerów i specjalistów.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'ShieldCheck', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.UBEZPIECZENIA, partner: 'Profitowi' },
  { id: 'SRV-P-ERGO',       name: 'Ergo Hestia — Pakiet Bezpieczny Dom', description: 'Ochrona domu i mieszkania od wszelkich zdarzeń.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'Shield', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.UBEZPIECZENIA, partner: 'Multipolisa.pl' },
  { id: 'SRV-P-WARTA',      name: 'Warta — Ubezpieczenie turystyczne', description: 'Na delegacje i wakacje, w Polsce i za granicą.', price: 0, type: ServiceType.ONE_TIME, icon: 'Plane', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.UBEZPIECZENIA, partner: 'Multipolisa.pl' },
  { id: 'SRV-P-LEADENHALL', name: 'Leadenhall — OC w życiu prywatnym', description: 'Chroni przed skutkami codziennych pomyłek.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'Shield', image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.UBEZPIECZENIA, partner: 'Multipolisa.pl' },
  { id: 'SRV-P-IKE',        name: 'IKE — Indywidualne Konto Emerytalne', description: 'Oszczędzanie na emeryturę z korzyściami podatkowymi.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'Landmark', image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.FINANSE, partner: 'Goldman Sachs' },
  { id: 'SRV-P-IKZE',       name: 'IKZE — Indywidualne Konto Zabezpieczenia Emerytalnego', description: 'Ulga podatkowa dziś, kapitał na emeryturę jutro.', price: 0, type: ServiceType.SUBSCRIPTION, icon: 'Landmark', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=800', isActive: true, category: BenefitCategory.FINANSE, partner: 'Goldman Sachs' },
  // Aplikacje Eliton, które do tej pory istniały tylko jako obiekty zapasowe w DashboardEmployee
  { id: 'SRV-SECURE-01',    name: 'Secure Messenger', description: 'Szyfrowana komunikacja end-to-end.', price: 200, type: ServiceType.SUBSCRIPTION, icon: 'Lock', image: '/klodka.png', isActive: true, category: BenefitCategory.CODZIENNOSC, partner: 'Eliton', fulfillment: 'auto' },
  { id: 'SRV-VAULT-01',     name: 'Digital Vault', description: 'Prywatny sejf cyfrowy 10 GB. AES-256.', price: 50, type: ServiceType.SUBSCRIPTION, icon: 'ShieldCheck', image: '/sejf.png', isActive: true, category: BenefitCategory.CODZIENNOSC, partner: 'Eliton', fulfillment: 'auto' },
```
URL-e obrazków partnerskich są przepisane 1:1 z dzisiejszych kafelków JSX. Żadnych innych zmian w istniejących wpisach.

- [ ] **Step 5: Klucz pamięci przeglądarki i konstrukcje `ServiceItem` poza katalogiem**

`context/StrattonContext.tsx:112`: `'ebs_services_v15'` → `'ebs_services_v16'`.

`views/DashboardEmployee.tsx` — dodaj `BenefitCategory` do importu z `'../types'` i dopisz `category` w czterech miejscach:
- linia 147 (`secureMessengerService` fallback): `..., icon: 'Shield', isActive: true, category: BenefitCategory.CODZIENNOSC, fulfillment: 'auto' } as ServiceItem`
- linia 148 (`vaultService` fallback): analogicznie `category: BenefitCategory.CODZIENNOSC, fulfillment: 'auto'`
- linia 151 (`handleManualSpend`): `..., icon: 'Zap', isActive: true, category: BenefitCategory.CODZIENNOSC };`
- linie 155–165 (`handlePartnerRequest`): dopisz `category: BenefitCategory.CODZIENNOSC,` po `isActive: true,`.

- [ ] **Step 6: Testy i typy**

Run: `npx vitest run services/mockData.test.ts && npx tsc --noEmit`
Expected: test PASS; `tsc` 0 błędów (jeśli `tsc` wskaże inne konstrukcje `ServiceItem` bez `category`, dopisz `category: BenefitCategory.CODZIENNOSC` — nie zmieniaj niczego więcej).

- [ ] **Step 7: Commit**

```bash
git add types/enums.ts types/system.ts services/mockData.ts services/mockData.test.ts context/StrattonContext.tsx views/DashboardEmployee.tsx
git commit -m "feat(sklep): katalog z kategoriami po potrzebach, partnerami i sposobem realizacji

Sześć kategorii (spec 2026-09-15 §4), 11 pozycji partnerskich z ceną 0 (w tym
Medicover), aplikacje Secure Messenger i Digital Vault w katalogu zamiast
obiektów zapasowych. Ceny istniejących pozycji bez zmian. Klucz localStorage
katalogu podbity do v16, żeby stare kopie bez kategorii się odświeżyły.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/benefits/catalog.ts` — czysta logika sklepu

**Files:**
- Create: `lib/benefits/catalog.ts`
- Test: `lib/benefits/catalog.test.ts`

**Interfaces:**
- Consumes: `ServiceItem`, `BenefitCategory`, `INITIAL_SERVICES` (Task 1).
- Produces:
  ```ts
  export interface CategoryDef { id: BenefitCategory; label: string; description: string; icon: string }
  export const BENEFIT_CATEGORIES: readonly CategoryDef[];            // 6, w kolejności specu
  export type CategoryFilter = BenefitCategory | 'ALL';
  export type StoreAction = 'buy' | 'inquire' | 'open' | 'insufficient';
  export type EmployeeAppTab = 'WELLBEING' | 'LEGAL' | 'SECURE_MESSENGER' | 'DIGITAL_VAULT';
  export const APP_TAB_BY_SERVICE: Readonly<Record<string, EmployeeAppTab>>;
  export function normalizeSearch(s: string): string;
  export function filterCatalog(items: ServiceItem[], opts: { category?: CategoryFilter; query?: string }): ServiceItem[];
  export function sortForSection(items: ServiceItem[]): ServiceItem[];
  export function groupByCategory(items: ServiceItem[]): { category: CategoryDef; items: ServiceItem[] }[];
  export function countByCategory(items: ServiceItem[]): { total: number; byCategory: Record<BenefitCategory, number> };
  export function resolveAction(item: ServiceItem, ownedIds: ReadonlySet<string>, balance: number): StoreAction;
  export function findCatalogItem(id: string): ServiceItem | undefined;
  export function partnerCount(items: ServiceItem[]): number;
  ```

- [ ] **Step 1: Testy**

`lib/benefits/catalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { BenefitCategory, ServiceType } from '@/types/enums';
import type { ServiceItem } from '@/types';
import {
  BENEFIT_CATEGORIES, normalizeSearch, filterCatalog, sortForSection, groupByCategory,
  countByCategory, resolveAction, findCatalogItem, partnerCount, APP_TAB_BY_SERVICE,
} from './catalog';

const item = (over: Partial<ServiceItem>): ServiceItem => ({
  id: 'X', name: 'Nazwa', description: 'Opis', price: 10, type: ServiceType.ONE_TIME,
  icon: 'Zap', isActive: true, category: BenefitCategory.CODZIENNOSC, ...over,
});

describe('BENEFIT_CATEGORIES', () => {
  it('sześć kategorii w kolejności ze specu', () => {
    expect(BENEFIT_CATEGORIES.map(c => c.id)).toEqual([
      BenefitCategory.ZDROWIE, BenefitCategory.UBEZPIECZENIA, BenefitCategory.FINANSE,
      BenefitCategory.ROZWOJ, BenefitCategory.RODZINA, BenefitCategory.CODZIENNOSC,
    ]);
    for (const c of BENEFIT_CATEGORIES) { expect(c.label).toBeTruthy(); expect(c.icon).toBeTruthy(); }
  });
});

describe('normalizeSearch / filterCatalog', () => {
  const items = [
    item({ id: 'A', name: 'PZU — Ubezpieczenie NNW', partner: 'Profitowi', category: BenefitCategory.UBEZPIECZENIA }),
    item({ id: 'B', name: 'Luxmed — Optyka', partner: 'Profitowi', category: BenefitCategory.ZDROWIE, description: 'Rehabilitacja' }),
    item({ id: 'C', name: 'Spotify', category: BenefitCategory.CODZIENNOSC }),
    item({ id: 'D', name: 'Nieaktywna', isActive: false }),
  ];

  it('normalizuje wielkość liter i diakrytyki', () => {
    expect(normalizeSearch('  UBEZPIECZENIE Życiowe ')).toBe('ubezpieczenie zyciowe');
  });

  it('szuka po nazwie, opisie i partnerze, bez rozróżniania wielkości liter i ogonków', () => {
    expect(filterCatalog(items, { query: 'ubezp' }).map(i => i.id)).toEqual(['A']);
    expect(filterCatalog(items, { query: 'REHABILIT' }).map(i => i.id)).toEqual(['B']);
    expect(filterCatalog(items, { query: 'profitowi' }).map(i => i.id).sort()).toEqual(['A', 'B']);
    expect(filterCatalog(items, { query: 'zycie' })).toEqual([]);
  });

  it('filtruje po kategorii, ALL = wszystkie aktywne', () => {
    expect(filterCatalog(items, { category: BenefitCategory.ZDROWIE }).map(i => i.id)).toEqual(['B']);
    expect(filterCatalog(items, { category: 'ALL' }).map(i => i.id).sort()).toEqual(['A', 'B', 'C']);
  });

  it('pomija nieaktywne', () => {
    expect(filterCatalog(items, {}).some(i => i.id === 'D')).toBe(false);
  });
});

describe('sortForSection', () => {
  it('cena > 0 rosnąco, potem cena 0, remisy alfabetycznie', () => {
    const sorted = sortForSection([
      item({ id: '1', name: 'Zeta', price: 0 }), item({ id: '2', name: 'Beta', price: 30 }),
      item({ id: '3', name: 'Alfa', price: 0 }), item({ id: '4', name: 'Gamma', price: 30 }),
      item({ id: '5', name: 'Delta', price: 5 }),
    ]);
    expect(sorted.map(i => i.id)).toEqual(['5', '2', '4', '3', '1']);
  });
});

describe('groupByCategory / countByCategory', () => {
  const items = [
    item({ id: 'c1', category: BenefitCategory.CODZIENNOSC }),
    item({ id: 'z1', category: BenefitCategory.ZDROWIE }),
    item({ id: 'z2', category: BenefitCategory.ZDROWIE, isActive: false }),
  ];
  it('grupuje w kolejności kategorii i pomija puste', () => {
    const groups = groupByCategory(items);
    expect(groups.map(g => g.category.id)).toEqual([BenefitCategory.ZDROWIE, BenefitCategory.CODZIENNOSC]);
    expect(groups[0].items.map(i => i.id)).toEqual(['z1']);
  });
  it('liczy tylko aktywne', () => {
    const c = countByCategory(items);
    expect(c.total).toBe(2);
    expect(c.byCategory[BenefitCategory.ZDROWIE]).toBe(1);
    expect(c.byCategory[BenefitCategory.UBEZPIECZENIA]).toBe(0);
  });
});

describe('resolveAction', () => {
  const owned = new Set(['SRV-MENTAL-01']);
  it('cena 0 → inquire, niezależnie od salda', () => {
    expect(resolveAction(item({ price: 0 }), owned, 0)).toBe('inquire');
    expect(resolveAction(item({ price: 0 }), owned, 999)).toBe('inquire');
  });
  it('kupiona aplikacja auto → open', () => {
    expect(resolveAction(item({ id: 'SRV-MENTAL-01', price: 100, fulfillment: 'auto' }), owned, 0)).toBe('open');
  });
  it('niekupiona aplikacja auto → buy / insufficient wg salda', () => {
    expect(resolveAction(item({ id: 'SRV-LEGAL-01', price: 150, fulfillment: 'auto' }), owned, 150)).toBe('buy');
    expect(resolveAction(item({ id: 'SRV-LEGAL-01', price: 150, fulfillment: 'auto' }), owned, 149)).toBe('insufficient');
  });
  it('produkt bok kupiony wcześniej nadal jest do kupienia (bilety kupuje się wiele razy)', () => {
    expect(resolveAction(item({ id: 'SRV-04', price: 25 }), new Set(['SRV-04']), 25)).toBe('buy');
  });
  it('saldo równe cenie → buy; mniejsze → insufficient', () => {
    expect(resolveAction(item({ price: 25 }), owned, 25)).toBe('buy');
    expect(resolveAction(item({ price: 25 }), owned, 24)).toBe('insufficient');
  });
});

describe('findCatalogItem / partnerCount / APP_TAB_BY_SERVICE', () => {
  it('zna Multikino, nie zna SRV-NIEMA', () => {
    expect(findCatalogItem('SRV-04')?.price).toBe(25);
    expect(findCatalogItem('SRV-NIEMA')).toBeUndefined();
  });
  it('liczy unikalnych partnerów bez Eliton', () => {
    expect(partnerCount([
      item({ partner: 'Eliton' }), item({ partner: 'Profitowi' }), item({ partner: 'Profitowi' }), item({ partner: 'Orange' }), item({}),
    ])).toBe(2);
  });
  it('mapuje cztery aplikacje na zakładki', () => {
    expect(APP_TAB_BY_SERVICE['SRV-MENTAL-01']).toBe('WELLBEING');
    expect(APP_TAB_BY_SERVICE['SRV-LEGAL-01']).toBe('LEGAL');
    expect(APP_TAB_BY_SERVICE['SRV-SECURE-01']).toBe('SECURE_MESSENGER');
    expect(APP_TAB_BY_SERVICE['SRV-VAULT-01']).toBe('DIGITAL_VAULT');
  });
});
```

- [ ] **Step 2: Uruchom — ma nie przejść**

Run: `npx vitest run lib/benefits/catalog.test.ts`
Expected: FAIL (moduł nie istnieje).

- [ ] **Step 3: Implementacja**

`lib/benefits/catalog.ts`:
```ts
// Czysta logika sklepu benefitów — bez Reacta, żeby dało się ją testować i użyć po stronie serwera.
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §4–§5.
import { BenefitCategory } from '@/types/enums';
import type { ServiceItem } from '@/types';
import { INITIAL_SERVICES } from '@/services/mockData';

export interface CategoryDef {
  id: BenefitCategory;
  label: string;
  description: string;
  icon: string; // nazwa ikony lucide, mapowana w UI
}

export const BENEFIT_CATEGORIES: readonly CategoryDef[] = [
  { id: BenefitCategory.ZDROWIE,       label: 'Zdrowie',       description: 'Opieka medyczna, badania i dobrostan psychiczny.', icon: 'HeartPulse' },
  { id: BenefitCategory.UBEZPIECZENIA, label: 'Ubezpieczenia', description: 'Ochrona Ciebie, rodziny i domu.',                   icon: 'ShieldCheck' },
  { id: BenefitCategory.FINANSE,       label: 'Finanse',       description: 'Emerytura, oszczędzanie i mądre wydawanie.',        icon: 'Landmark' },
  { id: BenefitCategory.ROZWOJ,        label: 'Rozwój',        description: 'Kursy i umiejętności na dziś i na jutro.',           icon: 'GraduationCap' },
  { id: BenefitCategory.RODZINA,       label: 'Rodzina',       description: 'Dla dzieci, domu i wspólnego czasu.',                icon: 'Users' },
  { id: BenefitCategory.CODZIENNOSC,   label: 'Codzienność',   description: 'Rozrywka, telekomunikacja i codzienne sprawy.',     icon: 'Sparkles' },
];

export type CategoryFilter = BenefitCategory | 'ALL';
export type StoreAction = 'buy' | 'inquire' | 'open' | 'insufficient';
export type EmployeeAppTab = 'WELLBEING' | 'LEGAL' | 'SECURE_MESSENGER' | 'DIGITAL_VAULT';

/** Aplikacje Eliton: id w katalogu → zakładka pełnoekranowa w DashboardEmployee. */
export const APP_TAB_BY_SERVICE: Readonly<Record<string, EmployeeAppTab>> = {
  'SRV-MENTAL-01': 'WELLBEING',
  'SRV-LEGAL-01':  'LEGAL',
  'SRV-SECURE-01': 'SECURE_MESSENGER',
  'SRV-VAULT-01':  'DIGITAL_VAULT',
};

/** Małe litery, bez diakrytyków (NFD + usunięcie znaków łączących), ł→l, przycięte spacje. */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase()
    .trim();
}

function matchesQuery(item: ServiceItem, q: string): boolean {
  if (!q) return true;
  const hay = normalizeSearch(`${item.name} ${item.description} ${item.partner ?? ''}`);
  return hay.includes(q);
}

export function filterCatalog(
  items: ServiceItem[],
  opts: { category?: CategoryFilter; query?: string },
): ServiceItem[] {
  const q = normalizeSearch(opts.query ?? '');
  const cat = opts.category ?? 'ALL';
  return items.filter(i => i.isActive && (cat === 'ALL' || i.category === cat) && matchesQuery(i, q));
}

/** Płatne rosnąco po cenie, potem „Zapytaj o ofertę"; remisy alfabetycznie (pl). */
export function sortForSection(items: ServiceItem[]): ServiceItem[] {
  const collator = new Intl.Collator('pl');
  return [...items].sort((a, b) => {
    const aFree = a.price === 0 ? 1 : 0;
    const bFree = b.price === 0 ? 1 : 0;
    if (aFree !== bFree) return aFree - bFree;
    if (a.price !== b.price) return a.price - b.price;
    return collator.compare(a.name, b.name);
  });
}

export function groupByCategory(items: ServiceItem[]): { category: CategoryDef; items: ServiceItem[] }[] {
  const active = items.filter(i => i.isActive);
  return BENEFIT_CATEGORIES
    .map(category => ({ category, items: sortForSection(active.filter(i => i.category === category.id)) }))
    .filter(g => g.items.length > 0);
}

export function countByCategory(items: ServiceItem[]): { total: number; byCategory: Record<BenefitCategory, number> } {
  const byCategory = Object.fromEntries(BENEFIT_CATEGORIES.map(c => [c.id, 0])) as Record<BenefitCategory, number>;
  let total = 0;
  for (const i of items) {
    if (!i.isActive) continue;
    total++;
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  }
  return { total, byCategory };
}

/** Jedna decyzja dla kafelka i panelu szczegółów (spec §5.3). Rola użytkownika jest sprawdzana wyżej. */
export function resolveAction(item: ServiceItem, ownedIds: ReadonlySet<string>, balance: number): StoreAction {
  if (item.fulfillment === 'auto' && ownedIds.has(item.id)) return 'open';
  if (item.price === 0) return 'inquire';
  if (item.price > balance) return 'insufficient';
  return 'buy';
}

/** Pozycja z katalogu w kodzie — używane też po stronie serwera do walidacji ceny. */
export function findCatalogItem(id: string): ServiceItem | undefined {
  return INITIAL_SERVICES.find(s => s.id === id);
}

/** Liczba unikalnych partnerów zewnętrznych (bez Eliton) — statystyka na Pulpicie. */
export function partnerCount(items: ServiceItem[]): number {
  const set = new Set(items.map(i => i.partner).filter((p): p is string => !!p && p !== 'Eliton'));
  return set.size;
}
```

- [ ] **Step 4: Testy zielone**

Run: `npx vitest run lib/benefits/catalog.test.ts`
Expected: PASS (wszystkie).

- [ ] **Step 5: Commit**

```bash
git add lib/benefits/catalog.ts lib/benefits/catalog.test.ts
git commit -m "feat(sklep): czysta logika katalogu — kategorie, filtr, sortowanie, wybór akcji

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Stałe, e-maile i okno deduplikacji

**Files:**
- Create: `lib/benefits/constants.ts`, `lib/benefits/mails.ts`, `lib/benefits/inquiry.ts`
- Test: `lib/benefits/mails.test.ts`, `lib/benefits/inquiry.test.ts`
- Modify: `app/api/contact-bok/route.ts:52` (`to: 'bok@stratton-prime.pl'` → `to: BOK_EMAIL`)

**Interfaces:**
- Produces:
  ```ts
  // constants.ts
  export const BOK_EMAIL: string;                // process.env.BOK_EMAIL ?? 'bok@stratton-prime.pl'
  export const BOK_SLA_TEXT = '2 dni roboczych';
  export const STORE_TITLE = 'Sklep benefitów';
  // inquiry.ts
  export const INQUIRY_DEDUP_DAYS = 7;
  export function isWithinDedupWindow(lastCreatedAt: string | Date, now?: Date): boolean;
  // mails.ts
  export interface MailContent { subject: string; html: string; text: string }
  export interface OrderMailInput { productName: string; partner?: string; pricePoints: number; employeeName: string; employeeEmail: string; companyName?: string; transactionId: string; when: Date; fulfillment: 'auto' | 'bok' }
  export interface InquiryMailInput { productName: string; partner?: string; employeeName: string; employeeEmail: string; companyName?: string; when: Date }
  export function escapeHtml(s: string): string;
  export function bokOrderMail(i: OrderMailInput): MailContent;
  export function employeeOrderMail(i: OrderMailInput): MailContent;
  export function bokInquiryMail(i: InquiryMailInput): MailContent;
  export function employeeInquiryMail(i: InquiryMailInput): MailContent;
  ```

- [ ] **Step 1: Testy**

`lib/benefits/inquiry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isWithinDedupWindow, INQUIRY_DEDUP_DAYS } from './inquiry';

describe('isWithinDedupWindow', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  it('okno ma 7 dni', () => expect(INQUIRY_DEDUP_DAYS).toBe(7));
  it('zgłoszenie sprzed godziny → w oknie', () => {
    expect(isWithinDedupWindow('2026-09-15T11:00:00Z', now)).toBe(true);
  });
  it('zgłoszenie sprzed 6 dni 23 h → w oknie; sprzed 7 dni 1 h → poza', () => {
    expect(isWithinDedupWindow('2026-09-08T13:00:00Z', now)).toBe(true);
    expect(isWithinDedupWindow('2026-09-08T11:00:00Z', now)).toBe(false);
  });
  it('akceptuje Date i string', () => {
    expect(isWithinDedupWindow(new Date('2026-09-14T12:00:00Z'), now)).toBe(true);
  });
});
```

`lib/benefits/mails.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { bokOrderMail, employeeOrderMail, bokInquiryMail, employeeInquiryMail, escapeHtml } from './mails';
import { BOK_SLA_TEXT } from './constants';

const when = new Date('2026-09-15T10:30:00Z');
const order = { productName: 'Multikino (Bilet) <b>x</b>', partner: 'Multikino', pricePoints: 25, employeeName: 'Jan Testowy', employeeEmail: 'jan@example.com', companyName: 'Firma Testowa', transactionId: 'abc-123', when, fulfillment: 'bok' as const };
const inquiry = { productName: 'PZU — NNW', partner: 'Profitowi', employeeName: 'Jan Testowy', employeeEmail: 'jan@example.com', companyName: 'Firma Testowa', when };

describe('escapeHtml', () => {
  it('neutralizuje znaczniki', () => expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;'));
});

describe('e-maile zamówienia', () => {
  it('BOK: temat z partnerem i produktem, treść z ceną, pracownikiem, firmą i id transakcji; HTML escapowany', () => {
    const m = bokOrderMail(order);
    expect(m.subject).toBe('[EBS Sklep] Zamówienie: Multikino: Multikino (Bilet) <b>x</b>');
    expect(m.html).toContain('25 pkt');
    expect(m.html).toContain('Jan Testowy');
    expect(m.html).toContain('Firma Testowa');
    expect(m.html).toContain('abc-123');
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(m.text).toContain('jan@example.com');
  });
  it('pracownik (bok): obietnica SLA i punkty', () => {
    const m = employeeOrderMail(order);
    expect(m.subject).toContain('Potwierdzenie zamówienia');
    expect(m.html).toContain(BOK_SLA_TEXT);
    expect(m.html).toContain('25 pkt');
  });
  it('pracownik (auto): „Aplikacja aktywna", bez SLA', () => {
    const m = employeeOrderMail({ ...order, productName: 'Wellbeing', fulfillment: 'auto' });
    expect(m.subject).toContain('Aplikacja aktywna');
    expect(m.html).not.toContain(BOK_SLA_TEXT);
  });
});

describe('e-maile zapytania', () => {
  it('BOK: temat i dane pracownika', () => {
    const m = bokInquiryMail(inquiry);
    expect(m.subject).toBe('[EBS Sklep] Zapytanie o ofertę: Profitowi: PZU — NNW');
    expect(m.html).toContain('jan@example.com');
  });
  it('pracownik: SLA', () => {
    const m = employeeInquiryMail(inquiry);
    expect(m.subject).toContain('Przyjęliśmy zapytanie');
    expect(m.html).toContain(BOK_SLA_TEXT);
  });
});
```

- [ ] **Step 2: Uruchom — ma nie przejść**

Run: `npx vitest run lib/benefits/inquiry.test.ts lib/benefits/mails.test.ts`
Expected: FAIL (moduły nie istnieją).

- [ ] **Step 3: Implementacja**

`lib/benefits/constants.ts`:
```ts
/** Skrzynka Biura Obsługi Klienta — ta sama, na którą idzie „Kontakt z BOK" z ustawień konta. */
export const BOK_EMAIL = process.env.BOK_EMAIL ?? 'bok@stratton-prime.pl';
/** Obietnica składana pracownikowi w potwierdzeniach (spec §5.4/§5.5). */
export const BOK_SLA_TEXT = '2 dni roboczych';
export const STORE_TITLE = 'Sklep benefitów';
```

`lib/benefits/inquiry.ts`:
```ts
export const INQUIRY_DEDUP_DAYS = 7;

/** Czy poprzednie zgłoszenie jest na tyle świeże, że nowe byłoby dublem (spec §5.5 pkt 2). */
export function isWithinDedupWindow(lastCreatedAt: string | Date, now: Date = new Date()): boolean {
  const last = typeof lastCreatedAt === 'string' ? new Date(lastCreatedAt) : lastCreatedAt;
  const windowMs = INQUIRY_DEDUP_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - last.getTime() < windowMs;
}
```

`lib/benefits/mails.ts`:
```ts
// Treści e-maili sklepu — czyste funkcje, szablon spójny z app/api/contact-bok.
import { BOK_EMAIL, BOK_SLA_TEXT } from './constants';

export interface MailContent { subject: string; html: string; text: string }

export interface OrderMailInput {
  productName: string; partner?: string; pricePoints: number;
  employeeName: string; employeeEmail: string; companyName?: string;
  transactionId: string; when: Date; fulfillment: 'auto' | 'bok';
}
export interface InquiryMailInput {
  productName: string; partner?: string;
  employeeName: string; employeeEmail: string; companyName?: string; when: Date;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const fmtDate = (d: Date) => d.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' });

function layout(title: string, rows: [string, string][], note: string): string {
  const tr = rows.map(([k, v]) =>
    `<tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:160px;">${escapeHtml(k)}</td><td style="padding:8px;">${escapeHtml(v)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#30df6a;">${escapeHtml(title)}</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${tr}</table>
  <div style="padding:16px;background:#f9f9f9;border-left:4px solid #30df6a;">${escapeHtml(note)}</div>
  <p style="color:#999;font-size:12px;margin-top:24px;">Wygenerowano automatycznie przez EBS — Eliton Benefits System</p>
</div>`;
}
const textOf = (title: string, rows: [string, string][], note: string) =>
  [title, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', note].join('\n');

const label = (i: { partner?: string; productName: string }) => (i.partner ? `${i.partner}: ${i.productName}` : i.productName);

export function bokOrderMail(i: OrderMailInput): MailContent {
  const rows: [string, string][] = [
    ['Produkt', i.productName], ['Partner', i.partner ?? '—'], ['Cena', `${i.pricePoints} pkt`],
    ['Pracownik', i.employeeName], ['E-mail', i.employeeEmail], ['Firma', i.companyName ?? '—'],
    ['Id transakcji', i.transactionId], ['Data', fmtDate(i.when)],
  ];
  const note = 'Punkty zostały pobrane z konta pracownika. Prosimy o realizację zamówienia i wysłanie kodu/aktywacji na e-mail pracownika.';
  const title = 'Nowe zamówienie ze sklepu benefitów';
  return { subject: `[EBS Sklep] Zamówienie: ${label(i)}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}

export function employeeOrderMail(i: OrderMailInput): MailContent {
  const rows: [string, string][] = [['Produkt', i.productName], ['Pobrano', `${i.pricePoints} pkt`], ['Data', fmtDate(i.when)]];
  if (i.fulfillment === 'auto') {
    const title = 'Aplikacja aktywna';
    const note = `Aplikacja „${i.productName}" jest już odblokowana w Twoim portalu EBS — znajdziesz ją w sekcji „Twoje Aplikacje".`;
    return { subject: `Aplikacja aktywna — ${i.productName}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
  }
  const title = 'Przyjęliśmy Twoje zamówienie';
  const note = `Biuro Obsługi Klienta prześle kod lub aktywację na ten adres w ciągu ${BOK_SLA_TEXT}. Pytania: ${BOK_EMAIL}.`;
  return { subject: `Potwierdzenie zamówienia — ${i.productName}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}

export function bokInquiryMail(i: InquiryMailInput): MailContent {
  const rows: [string, string][] = [
    ['Produkt', i.productName], ['Partner', i.partner ?? '—'],
    ['Pracownik', i.employeeName], ['E-mail', i.employeeEmail], ['Firma', i.companyName ?? '—'], ['Data', fmtDate(i.when)],
  ];
  const note = 'Pracownik prosi o ofertę. Prosimy o kontakt z pracownikiem lub przekazanie zapytania do brokera.';
  const title = 'Zapytanie o ofertę ze sklepu benefitów';
  return { subject: `[EBS Sklep] Zapytanie o ofertę: ${label(i)}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}

export function employeeInquiryMail(i: InquiryMailInput): MailContent {
  const rows: [string, string][] = [['Produkt', i.productName], ['Partner', i.partner ?? '—'], ['Data', fmtDate(i.when)]];
  const title = 'Przyjęliśmy zapytanie o ofertę';
  const note = `Biuro Obsługi Klienta skontaktuje się z Tobą w ciągu ${BOK_SLA_TEXT}. Pytania: ${BOK_EMAIL}.`;
  return { subject: `Przyjęliśmy zapytanie — ${i.productName}`, html: layout(title, rows, note), text: textOf(title, rows, note) };
}
```

`app/api/contact-bok/route.ts`: dodaj `import { BOK_EMAIL } from '@/lib/benefits/constants';` i zamień `to: 'bok@stratton-prime.pl'` na `to: BOK_EMAIL`.

- [ ] **Step 4: Testy zielone**

Run: `npx vitest run lib/benefits && npx tsc --noEmit`
Expected: PASS; 0 błędów.

- [ ] **Step 5: Commit**

```bash
git add lib/benefits/constants.ts lib/benefits/mails.ts lib/benefits/mails.test.ts lib/benefits/inquiry.ts lib/benefits/inquiry.test.ts app/api/contact-bok/route.ts
git commit -m "feat(sklep): treści e-maili do BOK i pracownika, okno deduplikacji zgłoszeń

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Migracja 061 — naprawa `redeem_voucher`, atomowa realizacja, tabela `benefit_inquiries`

**Files:**
- Create: `supabase/migrations/061_sklep_benefitow.sql`
- Modify: `lib/users/accountPurge.ts:102-115` (`OWNED_TABLES` += `benefit_inquiries`)
- Test: `lib/users/accountPurge.test.ts` (istniejący — sprawdź, czy wylicza `OWNED_TABLES`; jeśli tak, dopisz oczekiwanie)

**Interfaces:**
- Produces (baza): `redeem_vouchers_for_service(p_user_id uuid, p_amount int, p_service_id text, p_service_name text) RETURNS jsonb` → `{"transaction_id": uuid, "redeemed": int, "serials": [text]}`; wyjątki `INSUFFICIENT_VOUCHERS`, `INSUFFICIENT_BALANCE`. Tabela `benefit_inquiries(id, user_id, service_id, service_name, partner, status, created_at)`.

- [ ] **Step 1: Plik migracji**

`supabase/migrations/061_sklep_benefitow.sql`:
```sql
-- =============================================================================
-- Migracja 061: Sklep benefitów v2 (spec docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §6.1)
--   1. redeem_voucher() przyjmuje status 'distributed' — dystrybucja (019/035) nadaje ten status,
--      a funkcja z 001 wymagała 'active', przez co żaden zakup na produkcji nigdy nie przeszedł
--      (ledger: 0 wpisów 'wykorzystanie' na dzień 2026-09-15).
--   2. redeem_vouchers_for_service() — realizacja N voucherów w JEDNEJ transakcji: najkrótszy
--      termin ważności pierwszy, za mało voucherów = nic nie schodzi, JEDEN wpis w ledgerze.
--   3. benefit_inquiries — zgłoszenia „Zapytaj o ofertę" (deduplikacja 7 dni + ślad dla BOK).
-- =============================================================================

-- 1. Naprawa historycznej funkcji (zostaje dla zgodności; nowy route jej nie woła)
CREATE OR REPLACE FUNCTION public.redeem_voucher(
  p_serial_number TEXT, p_user_id UUID, p_service_id TEXT DEFAULT NULL, p_service_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_voucher_id UUID;
BEGIN
  SELECT id INTO v_voucher_id FROM vouchers
  WHERE serial_number = p_serial_number AND current_owner_id = p_user_id
    AND status IN ('active', 'distributed') AND valid_until >= CURRENT_DATE
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher niedostępny lub nieważny (serial: %)', p_serial_number; END IF;
  UPDATE vouchers SET status = 'consumed', redeemed_at = NOW(), redeemed_by_user_id = p_user_id WHERE id = v_voucher_id;
  UPDATE voucher_accounts SET balance = balance - 1 WHERE user_id = p_user_id AND balance >= 1;
  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, service_id, service_name)
  VALUES (p_user_id, p_user_id, 1, 'wykorzystanie', p_service_id, p_service_name);
  RETURN v_voucher_id;
END; $$;

-- 2. Atomowa realizacja N voucherów za usługę
CREATE OR REPLACE FUNCTION public.redeem_vouchers_for_service(
  p_user_id UUID, p_amount INT, p_service_id TEXT, p_service_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ids UUID[]; v_serials TEXT[]; v_tx_id UUID; v_found INT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT array_agg(id ORDER BY valid_until, serial_number), array_agg(serial_number ORDER BY valid_until, serial_number)
    INTO v_ids, v_serials
  FROM (
    SELECT id, serial_number, valid_until FROM vouchers
    WHERE current_owner_id = p_user_id AND status IN ('active', 'distributed') AND valid_until >= CURRENT_DATE
    ORDER BY valid_until, serial_number
    LIMIT p_amount
    FOR UPDATE SKIP LOCKED
  ) v;

  v_found := COALESCE(array_length(v_ids, 1), 0);
  IF v_found < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_VOUCHERS'; END IF;

  UPDATE voucher_accounts SET balance = balance - p_amount
  WHERE user_id = p_user_id AND balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  UPDATE vouchers SET status = 'consumed', redeemed_at = NOW(), redeemed_by_user_id = p_user_id
  WHERE id = ANY(v_ids);

  INSERT INTO voucher_transactions (from_user_id, to_user_id, amount, type, service_id, service_name, metadata)
  VALUES (p_user_id, p_user_id, p_amount, 'wykorzystanie', p_service_id, p_service_name,
          jsonb_build_object('voucher_ids', to_jsonb(v_ids), 'serials', to_jsonb(v_serials)))
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'redeemed', p_amount, 'serials', to_jsonb(v_serials));
END; $$;

REVOKE ALL ON FUNCTION public.redeem_vouchers_for_service(UUID, INT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_vouchers_for_service(UUID, INT, TEXT, TEXT) TO service_role;
COMMENT ON FUNCTION public.redeem_vouchers_for_service IS
  'Sklep benefitów: realizacja N voucherów za usługę w jednej transakcji (FIFO po valid_until). Jeden wpis w ledgerze.';

-- 3. Zgłoszenia „Zapytaj o ofertę"
CREATE TABLE IF NOT EXISTS public.benefit_inquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  service_id   TEXT NOT NULL,
  service_name TEXT NOT NULL,
  partner      TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benefit_inquiries_user_service ON public.benefit_inquiries (user_id, service_id, created_at DESC);
ALTER TABLE public.benefit_inquiries ENABLE ROW LEVEL SECURITY;  -- bez polityk: dostęp tylko service_role
DROP TRIGGER IF EXISTS trg_audit_benefit_inquiries ON public.benefit_inquiries;
CREATE TRIGGER trg_audit_benefit_inquiries
  AFTER INSERT OR UPDATE OR DELETE ON public.benefit_inquiries
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
COMMENT ON TABLE public.benefit_inquiries IS 'Zapytania o ofertę ze sklepu benefitów (cena 0). BOK pracuje z maili; tabela = deduplikacja + ślad.';
```

- [ ] **Step 2: Zastosuj na produkcji przez MCP**

Narzędzie `mcp__supabase__apply_migration` z `project_id: ramedybmybcpqvelsmxd`, `name: 061_sklep_benefitow`, `query` = treść pliku. Następnie sprawdź:
```sql
select proname, prosecdef from pg_proc where proname in ('redeem_voucher','redeem_vouchers_for_service');
select relname, relrowsecurity from pg_class where relname = 'benefit_inquiries';
```
Expected: dwie funkcje (nowa `prosecdef = true`), tabela z `relrowsecurity = true`.

- [ ] **Step 3: Audyt bezpieczeństwa**

Uruchom agenta `rls-auditor` (Agent tool, `subagent_type: "rls-auditor"`) z zadaniem: „Projekt EBS `ramedybmybcpqvelsmxd`, migracja 061: tabela `benefit_inquiries` i funkcja `redeem_vouchers_for_service`. Sprawdź RLS, search_path, uprawnienia SECURITY DEFINER i ekspozycję przez klucz anon." Wynik wklej w commit message (skrót) — jeśli agent znajdzie problem, popraw migrację **kolejną** migracją `061a_...`, nie edytując zastosowanej.

- [ ] **Step 4: `accountPurge` — nowa tabela w `OWNED_TABLES`**

W `lib/users/accountPurge.ts` w `OWNED_TABLES` po wpisie `chat_push_subscriptions` dopisz:
```ts
  // SKLEP BENEFITÓW (061). Zapytania o ofertę martwego konta nie mają wartości księgowej;
  // FK ma ON DELETE CASCADE, ale przy ANONIMIZACJI profil zostaje — kasujemy jawnie.
  { table: 'benefit_inquiries',        column: 'user_id',        label: 'zapytania o ofertę w sklepie benefitów' },
```
Sprawdź `lib/users/accountPurge.test.ts` — jeśli test wylicza tabele `OWNED_TABLES` po nazwie, dopisz `'benefit_inquiries.user_id'` do oczekiwań.

- [ ] **Step 5: Testy i commit**

Run: `npx vitest run lib/users && npx tsc --noEmit`
Expected: PASS.

```bash
git add supabase/migrations/061_sklep_benefitow.sql lib/users/accountPurge.ts lib/users/accountPurge.test.ts
git commit -m "feat(sklep): migracja 061 — atomowa realizacja voucherów, naprawa statusu, tabela zapytań

redeem_voucher przyjmuje 'distributed' (dotąd wymagał 'active', więc zakup nigdy
nie przeszedł). Nowa redeem_vouchers_for_service realizuje N voucherów w jednej
transakcji z jednym wpisem w ledgerze. benefit_inquiries z RLS deny-all i audytem.
Zastosowane na produkcji przez MCP; rls-auditor: <skrót wyniku>.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Zakup — walidacja ceny, atomowa RPC, e-maile, wynik do klienta

**Files:**
- Create: `lib/benefits/purchaseValidation.ts`, `lib/benefits/purchaseValidation.test.ts`
- Modify: `app/api/vouchers/purchase/route.ts` (cały plik)
- Modify: `hooks/modules/useVoucherLogic.ts:50-60` (`dbTransactionToFrontend`), `:285-324` (`handleServicePurchase`)
- Modify: `context/StrattonContext.tsx` (typ `handleServicePurchase` w interfejsie akcji — znajdź przez `grep -n handleServicePurchase`)
- Modify: `views/DashboardEmployee.tsx:46` (`Props.onPurchaseService` → `Promise<PurchaseResult>`)

**Interfaces:**
- Consumes: `findCatalogItem` (Task 2), `bokOrderMail`/`employeeOrderMail`, `BOK_EMAIL` (Task 3), RPC `redeem_vouchers_for_service` (Task 4).
- Produces:
  ```ts
  // purchaseValidation.ts
  export type PurchaseValidation =
    | { ok: true; kind: 'catalog'; item: ServiceItem }
    | { ok: true; kind: 'internal' }
    | { ok: false; error: 'invalid_id' | 'unknown_service' | 'not_purchasable' | 'price_mismatch' };
  export function validatePurchase(serviceId: string, amount: number): PurchaseValidation;
  // route: 200 { redeemed, serviceName, transactionId } | 400 { error } | 403 | 500
  // hook: handleServicePurchase(service): Promise<PurchaseResult>
  ```

- [ ] **Step 1: Test walidacji**

`lib/benefits/purchaseValidation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validatePurchase } from './purchaseValidation';

describe('validatePurchase', () => {
  it('pozycja katalogowa: kwota musi równać się cenie', () => {
    expect(validatePurchase('SRV-04', 25)).toMatchObject({ ok: true, kind: 'catalog' });
    expect(validatePurchase('SRV-04', 1)).toEqual({ ok: false, error: 'price_mismatch' });
  });
  it('cena 0 nie jest do kupienia za punkty', () => {
    expect(validatePurchase('SRV-P-PZU', 0)).toEqual({ ok: false, error: 'not_purchasable' });
    expect(validatePurchase('SRV-P-PZU', 10)).toEqual({ ok: false, error: 'not_purchasable' });
  });
  it('nieznane SRV → unknown_service', () => {
    expect(validatePurchase('SRV-NIEMA', 5)).toEqual({ ok: false, error: 'unknown_service' });
  });
  it('INTERNAL-* (wydatki wewnątrz aplikacji) przechodzi bez katalogu', () => {
    expect(validatePurchase('INTERNAL-1726000000', 3)).toEqual({ ok: true, kind: 'internal' });
  });
  it('stare PARTNER-* i śmieci → invalid_id', () => {
    expect(validatePurchase('PARTNER-123', 0)).toEqual({ ok: false, error: 'invalid_id' });
    expect(validatePurchase('', 5)).toEqual({ ok: false, error: 'invalid_id' });
  });
});
```

- [ ] **Step 2: Uruchom — ma nie przejść**

Run: `npx vitest run lib/benefits/purchaseValidation.test.ts` → FAIL.

- [ ] **Step 3: Implementacja walidacji**

`lib/benefits/purchaseValidation.ts`:
```ts
import type { ServiceItem } from '@/types';
import { findCatalogItem } from './catalog';

export type PurchaseValidation =
  | { ok: true; kind: 'catalog'; item: ServiceItem }
  | { ok: true; kind: 'internal' }
  | { ok: false; error: 'invalid_id' | 'unknown_service' | 'not_purchasable' | 'price_mismatch' };

/**
 * Serwer nie ufa cenie z przeglądarki (spec §6.2): pozycja katalogowa musi istnieć, być aktywna,
 * mieć cenę > 0 i dokładnie taką kwotę. INTERNAL-* to mikrowydatki wewnątrz aplikacji Eliton
 * (AI Coach, biblioteka premium) — kwota pochodzi z aplikacji, jak dotąd.
 */
export function validatePurchase(serviceId: string, amount: number): PurchaseValidation {
  if (serviceId.startsWith('INTERNAL-')) return { ok: true, kind: 'internal' };
  if (!serviceId.startsWith('SRV-')) return { ok: false, error: 'invalid_id' };
  const item = findCatalogItem(serviceId);
  if (!item) return { ok: false, error: 'unknown_service' };
  if (!item.isActive || item.price <= 0) return { ok: false, error: 'not_purchasable' };
  if (amount !== item.price) return { ok: false, error: 'price_mismatch' };
  return { ok: true, kind: 'catalog', item };
}
```

Run: `npx vitest run lib/benefits/purchaseValidation.test.ts` → PASS.

- [ ] **Step 4: Route zakupu**

Zastąp całą treść `app/api/vouchers/purchase/route.ts`:
```ts
// POST /api/vouchers/purchase — zakup za punkty w sklepie benefitów (pracownik).
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §6.2.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { sendEmail } from '@/lib/mailer';
import { validatePurchase } from '@/lib/benefits/purchaseValidation';
import { bokOrderMail, employeeOrderMail } from '@/lib/benefits/mails';
import { BOK_EMAIL } from '@/lib/benefits/constants';

const Schema = z.object({
  serviceId:   z.string().min(1).max(100),
  serviceName: z.string().min(1).max(200),
  amount:      z.number().int().positive().max(10_000),
});

const ERROR_TEXT: Record<string, string> = {
  invalid_id:      'Nieprawidłowy identyfikator usługi.',
  unknown_service: 'Ta usługa nie istnieje w katalogu.',
  not_purchasable: 'Tej usługi nie kupuje się za punkty — użyj „Zapytaj o ofertę".',
  price_mismatch:  'Cena usługi zmieniła się — odśwież stronę i spróbuj ponownie.',
};

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'pracownik') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { serviceId, amount } = parsed.data;

  const validation = validatePurchase(serviceId, amount);
  if (!validation.ok) return NextResponse.json({ error: ERROR_TEXT[validation.error], code: validation.error }, { status: 400 });
  // Nazwa z katalogu, nie z przeglądarki — trafia do ledgera i do BOK.
  const serviceName = validation.kind === 'catalog' ? validation.item.name : parsed.data.serviceName;

  const supabase = supabaseServer();
  const { data, error } = await (supabase as any).rpc('redeem_vouchers_for_service', {
    p_user_id: auth.id, p_amount: amount, p_service_id: serviceId, p_service_name: serviceName,
  });
  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('INSUFFICIENT_VOUCHERS') || msg.includes('INSUFFICIENT_BALANCE')) {
      return NextResponse.json({ error: `Niewystarczające środki (wymagane: ${amount} pkt).`, code: 'insufficient' }, { status: 400 });
    }
    console.error('[purchase] rpc failed', msg);
    return NextResponse.json({ error: 'Nie udało się zrealizować zakupu.' }, { status: 500 });
  }
  const transactionId: string = data?.transaction_id ?? '';

  // E-maile — awaria poczty NIE cofa zakupu (vouchery już umorzone).
  if (validation.kind === 'catalog') {
    try {
      const { data: profile } = await supabase.from('user_profiles').select('full_name, company_id').eq('id', auth.id).single();
      let companyName: string | undefined;
      if (profile?.company_id) {
        const { data: c } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
        companyName = c?.name ?? undefined;
      }
      const input = {
        productName: validation.item.name, partner: validation.item.partner, pricePoints: amount,
        employeeName: profile?.full_name ?? 'Pracownik', employeeEmail: auth.email, companyName,
        transactionId, when: new Date(), fulfillment: validation.item.fulfillment ?? 'bok' as const,
      };
      if (input.fulfillment === 'bok') {
        const m = bokOrderMail(input);
        await sendEmail({ to: BOK_EMAIL, replyTo: auth.email, subject: m.subject, html: m.html });
      }
      const e = employeeOrderMail(input);
      await sendEmail({ to: auth.email, subject: e.subject, html: e.html });
    } catch (e: any) {
      console.error('[purchase] mail failed', e?.message ?? e);
    }
  }

  return NextResponse.json({ redeemed: amount, serviceName, transactionId });
}
```

- [ ] **Step 5: Hook i typy po stronie klienta**

`hooks/modules/useVoucherLogic.ts`:
- `dbTransactionToFrontend` (linia ~54): `type: (t.type === 'wykorzystanie' || t.transaction_type === 'redemption') ? 'DEBIT' : 'CREDIT',` — bez tego zakup pokazywałby się w Historii jako „+25".
- Dodaj `PurchaseResult` do importu typów z `'@/types'` (lub `'../../types'` — jak reszta pliku).
- Zastąp `handleServicePurchase` (linie 285–324):
```ts
  const handleServicePurchase = useCallback(async (service: ServiceItem): Promise<PurchaseResult> => {
    if ((currentUser.voucherBalance ?? 0) < service.price) {
      addToast('Transakcja Odrzucona', 'Niewystarczające środki.', 'ERROR');
      return { ok: false, error: 'Niewystarczające środki.' };
    }

    // Optymistycznie
    setUsers(prev => prev.map(u =>
      u.id === currentUser.id ? { ...u, voucherBalance: u.voucherBalance - service.price } : u
    ));

    const res = await fetch('/api/vouchers/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: service.id, serviceName: service.name, amount: service.price }),
    });

    if (!res.ok) {
      setUsers(prev => prev.map(u =>
        u.id === currentUser.id ? { ...u, voucherBalance: u.voucherBalance + service.price } : u
      ));
      let message = 'Nie udało się zrealizować zakupu.';
      try { const body = await res.json(); if (typeof body?.error === 'string') message = body.error; } catch { /* brak treści */ }
      addToast('Transakcja Odrzucona', message, 'ERROR');
      return { ok: false, error: message };
    }

    const body = await res.json().catch(() => ({}));
    const transactionId: string = body?.transactionId || `TRX-${Date.now()}`;
    const newTx: Transaction = {
      id: transactionId, userId: currentUser.id, type: 'DEBIT',
      serviceId: service.id, serviceName: service.name, amount: service.price, date: new Date().toISOString(),
    };
    setTransactions(prev => [newTx, ...prev]);

    logEvent('SERVICE_CONSUMPTION', `Zakup usługi: ${service.name}.`, currentUser.id, 'USER');
    notifyUser(currentUser.id, `Zakupiono: ${service.name}.`, 'SUCCESS');
    addToast('Zakup przyjęty', `Pobrano ${service.price} pkt.`, 'SUCCESS');
    return { ok: true, transactionId };
  }, [currentUser, logEvent, notifyUser, addToast]);
```
- `context/StrattonContext.tsx`: w interfejsie akcji zmień typ `handleServicePurchase` na `(service: ServiceItem) => Promise<PurchaseResult>` (dopisz `PurchaseResult` do importu typów).
- `views/DashboardEmployee.tsx:46`: `onPurchaseService: (service: ServiceItem) => Promise<PurchaseResult>;` (import `PurchaseResult` z `'../types'`).
- `views/DashboardEmployee.tsx:150-153` (`handleManualSpend`): `const r = await onPurchaseService(s); return r.ok;` — Wellbeing/Prawnik oczekują `Promise<boolean|void>`; sprawdź typ propsa `onSpend` w `MentalHealthDashboard.tsx:23` (`Promise<void>`) — zostaw `void` (zwrócenie boolean nie psuje `void`), a `LegalAssistantDashboard` sam sprowadza do boolean.

- [ ] **Step 6: Typy, testy**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 błędów; wszystkie testy zielone. Jeśli `tsc` wskaże inne wywołania `onPurchaseService`/`handleServicePurchase`, które zakładają `void`, zostaw je (Promise można zignorować) — tylko `RedemptionModal.onConfirm` w Task 6 ma czekać na wynik.

- [ ] **Step 7: Commit**

```bash
git add lib/benefits/purchaseValidation.ts lib/benefits/purchaseValidation.test.ts app/api/vouchers/purchase/route.ts hooks/modules/useVoucherLogic.ts context/StrattonContext.tsx views/DashboardEmployee.tsx
git commit -m "fix(sklep): zakup za punkty — cena z katalogu, jedna transakcja, e-maile, wynik do klienta

Serwer nie ufa już kwocie z przeglądarki (pozycja SRV-* musi istnieć i mieć tę
cenę), realizuje vouchery jedną funkcją bazy (jeden wpis w ledgerze, FIFO po
ważności, za mało = nic nie schodzi) i wysyła potwierdzenia do BOK i pracownika.
Hook zwraca {ok, error}; wpis 'wykorzystanie' w Historii jest DEBIT-em.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `RedemptionModal` — czeka na wynik, bez zmyślonego QR

**Files:**
- Modify: `components/employee/RedemptionModal.tsx` (cały plik)
- Modify: `views/DashboardEmployee.tsx:726-735` i `:798-807` (dwa wywołania `<RedemptionModal>`)

**Interfaces:**
- Produces:
  ```ts
  interface RedemptionModalProps {
    isOpen: boolean; onClose: () => void; service: ServiceItem;
    onConfirm: () => Promise<PurchaseResult>;
    userEmail?: string;              // do treści „prześle na {email}"
    onOpenApp?: () => void;          // dla fulfillment 'auto' — przycisk „Otwórz"
  }
  ```

- [ ] **Step 1: Przepisz modal**

Zachowaj układ (nagłówek z ikoną, karta ceny, suwak „Przesuń aby zapłacić"); zmień maszynę stanów i ekran końcowy. Kluczowe fragmenty do wstawienia (reszta pliku bez zmian poza usunięciem `redemptionCode`, `qrUrl`, `isDigitalContent` i ich użyć):
```tsx
import { X, ShoppingCart, CheckCircle, ChevronRight, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { ServiceItem, PurchaseResult } from '../../types';
import { BOK_SLA_TEXT } from '../../lib/benefits/constants';

type Step = 'REVIEW' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

interface RedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceItem;
  onConfirm: () => Promise<PurchaseResult>;
  userEmail?: string;
  onOpenApp?: () => void;
}

// ...w komponencie:
const [step, setStep] = useState<Step>('REVIEW');
const [errorText, setErrorText] = useState<string>('');
const isProcessing = step === 'PROCESSING';

const handlePurchase = async () => {
  if (step !== 'REVIEW') return;
  setStep('PROCESSING');
  setSliderValue(100);
  const result = await onConfirm();
  if (result.ok) { setStep('SUCCESS'); }
  else { setErrorText(result.error ?? 'Nie udało się zrealizować zakupu.'); setStep('ERROR'); }
};
```
W `useEffect` resetującym po `isOpen` ustaw `setStep('REVIEW'); setSliderValue(0); setErrorText('');`. `handleSliderChange` woła `handlePurchase()` przy `val >= 98` tylko gdy `step === 'REVIEW'`.

Ekran końcowy (zamiast bloku `{step === 'SUCCESS' && (...)}`):
```tsx
{step === 'SUCCESS' && (
  <div className="flex flex-col h-full">
    <div className="bg-emerald-600 p-8 text-center text-white shrink-0">
      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
      <h2 className="text-2xl font-bold">{service.fulfillment === 'auto' ? 'Aplikacja aktywna' : 'Zamówienie przyjęte'}</h2>
      <p className="text-emerald-100 text-sm mt-1">Pobraliśmy {service.price} pkt z Twojego portfela.</p>
    </div>
    <div className="bg-white flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
      {service.fulfillment === 'auto' ? (
        <>
          <p className="text-slate-600 text-sm max-w-xs">„{service.name}" jest już odblokowana. Znajdziesz ją też w sekcji „Twoje Aplikacje".</p>
          {onOpenApp && (
            <button onClick={onOpenApp} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition flex items-center justify-center gap-2">
              <ExternalLink size={18} /> Otwórz
            </button>
          )}
        </>
      ) : (
        <p className="text-slate-600 text-sm max-w-xs">
          Biuro Obsługi Klienta prześle kod lub aktywację na <span className="font-semibold text-slate-800">{userEmail ?? 'Twój e-mail'}</span> w ciągu {BOK_SLA_TEXT}.
        </p>
      )}
      <button onClick={onClose} className="w-full py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition">Wróć do sklepu</button>
    </div>
  </div>
)}
{step === 'ERROR' && (
  <div className="flex flex-col h-full">
    <div className="bg-rose-600 p-8 text-center text-white shrink-0">
      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
      <h2 className="text-2xl font-bold">Zakup nie przeszedł</h2>
      <p className="text-rose-100 text-sm mt-1">Punkty nie zostały pobrane.</p>
    </div>
    <div className="bg-white flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
      <p className="text-slate-600 text-sm max-w-xs">{errorText}</p>
      <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition">Zamknij</button>
    </div>
  </div>
)}
```
W kroku `REVIEW` warunek `{step === 'REVIEW' && (...)}` zmień na `{(step === 'REVIEW' || step === 'PROCESSING') && (...)}`, a napis suwaka na `{isProcessing ? 'Przetwarzanie...' : 'Przesuń aby zapłacić'}` (już tak jest — tylko `isProcessing` pochodzi teraz ze stanu `step`).

- [ ] **Step 2: Dwa wywołania w `DashboardEmployee`**

W obu miejscach (`:726` i `:798`) zastąp `onConfirm`:
```tsx
onConfirm={() => onPurchaseService(selectedService)}
userEmail={user.email}
onOpenApp={APP_TAB_BY_SERVICE[selectedService.id] ? () => { setSelectedService(null); setActiveTab(APP_TAB_BY_SERVICE[selectedService.id]); } : undefined}
```
Import: `import { APP_TAB_BY_SERVICE } from '../lib/benefits/catalog';`. Usuń dotychczasowe `setTimeout(() => setActiveTab('WELLBEING'), 1000)` / `'LEGAL'` — zastępuje je przycisk „Otwórz". `User.email` jest polem wymaganym w `types/user.ts`.

- [ ] **Step 3: Typy i ręczna kontrola**

Run: `npx tsc --noEmit` → 0 błędów. Uruchom `npx next dev --port 3010`, zaloguj się kontem pracownika testowego (jeśli jeszcze go nie ma — patrz Task 11; na tym etapie wystarczy sprawdzić, że modal otwiera się z kafelka „Wellbeing" na Pulpicie i po przesunięciu suwaka **bez środków** pokazuje ekran „Zakup nie przeszedł", nie „Zakup udany").

- [ ] **Step 4: Commit**

```bash
git add components/employee/RedemptionModal.tsx views/DashboardEmployee.tsx
git commit -m "fix(sklep): modal zakupu czeka na wynik API, bez zmyślonego kodu QR

Sukces tylko gdy punkty faktycznie zeszły; błąd pokazany w modalu. Ekran końcowy
mówi, że BOK prześle kod na e-mail (2 dni robocze) albo — dla aplikacji Eliton —
daje przycisk Otwórz. Usunięte: kod odbioru, QR z api.qrserver.com, link example.com.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `POST /api/benefits/inquiry` — „Zapytaj o ofertę"

**Files:**
- Create: `app/api/benefits/inquiry/route.ts`

**Interfaces:**
- Consumes: `findCatalogItem` (Task 2), `isWithinDedupWindow`, `bokInquiryMail`, `employeeInquiryMail`, `BOK_EMAIL` (Task 3), tabela `benefit_inquiries` (Task 4).
- Produces: `POST {serviceId}` → `200 {ok:true, inquiryId, mailSkipped?}` | `409 {error:'already_reported', reportedAt}` | `400 {error}` | `403` | `401`.

- [ ] **Step 1: Route**

`app/api/benefits/inquiry/route.ts`:
```ts
// POST /api/benefits/inquiry — „Zapytaj o ofertę" dla pozycji z ceną 0 (pracownik).
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §5.5.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { sendEmail } from '@/lib/mailer';
import { findCatalogItem } from '@/lib/benefits/catalog';
import { isWithinDedupWindow } from '@/lib/benefits/inquiry';
import { bokInquiryMail, employeeInquiryMail } from '@/lib/benefits/mails';
import { BOK_EMAIL } from '@/lib/benefits/constants';

const Schema = z.object({ serviceId: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'pracownik') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = findCatalogItem(parsed.data.serviceId);
  if (!item || !item.isActive) return NextResponse.json({ error: 'Ta pozycja nie istnieje w katalogu.' }, { status: 400 });
  if (item.price !== 0) return NextResponse.json({ error: 'Ta pozycja ma cenę — kup ją za punkty.' }, { status: 400 });

  const db = supabaseServer() as any;
  const { data: last } = await db.from('benefit_inquiries')
    .select('created_at').eq('user_id', auth.id).eq('service_id', item.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last?.created_at && isWithinDedupWindow(last.created_at)) {
    return NextResponse.json({ error: 'already_reported', reportedAt: last.created_at }, { status: 409 });
  }

  const { data: row, error } = await db.from('benefit_inquiries')
    .insert({ user_id: auth.id, service_id: item.id, service_name: item.name, partner: item.partner ?? null })
    .select('id, created_at').single();
  if (error || !row) {
    console.error('[inquiry] insert failed', error?.message);
    return NextResponse.json({ error: 'Nie udało się zapisać zgłoszenia.' }, { status: 500 });
  }

  const { data: profile } = await db.from('user_profiles').select('full_name, company_id').eq('id', auth.id).single();
  let companyName: string | undefined;
  if (profile?.company_id) {
    const { data: c } = await db.from('companies').select('name').eq('id', profile.company_id).single();
    companyName = c?.name ?? undefined;
  }
  const input = { productName: item.name, partner: item.partner, employeeName: profile?.full_name ?? 'Pracownik', employeeEmail: auth.email, companyName, when: new Date() };

  let mailSkipped = false;
  try {
    const b = bokInquiryMail(input);
    const r1 = await sendEmail({ to: BOK_EMAIL, replyTo: auth.email, subject: b.subject, html: b.html });
    const e = employeeInquiryMail(input);
    const r2 = await sendEmail({ to: auth.email, subject: e.subject, html: e.html });
    mailSkipped = !!(r1.skipped || r2.skipped);
    if (mailSkipped) console.warn('[inquiry] SMTP nieskonfigurowany — zgłoszenie zapisane bez e-maila', row.id);
  } catch (e: any) {
    console.error('[inquiry] mail failed', e?.message ?? e);
    mailSkipped = true;
  }

  return NextResponse.json({ ok: true, inquiryId: row.id, ...(mailSkipped ? { mailSkipped: true } : {}) });
}
```

- [ ] **Step 2: Sprawdzenie bez sesji i typów**

Run: `npx tsc --noEmit` → 0 błędów. `npx next dev --port 3010` i `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3010/api/benefits/inquiry -H "Content-Type: application/json" -d '{"serviceId":"SRV-P-PZU"}'` → `401` (route istnieje, bramka działa). Pełny scenariusz 200/409 — w smoke-teście (Task 11).

- [ ] **Step 3: Commit**

```bash
git add app/api/benefits/inquiry/route.ts
git commit -m "feat(sklep): zapytanie o ofertę — zapis, deduplikacja 7 dni, e-maile do BOK i pracownika

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Sklep — powłoka, kategorie, siatka kafelków

**Files:**
- Create: `components/employee/store/StoreHeader.tsx`, `components/employee/store/StoreCategories.tsx`, `components/employee/store/StoreGrid.tsx`, `components/employee/store/BenefitStore.tsx`

**Interfaces:**
- Consumes: Task 2 (`BENEFIT_CATEGORIES`, `filterCatalog`, `groupByCategory`, `countByCategory`, `resolveAction`, `StoreAction`, `CategoryFilter`, `EmployeeAppTab`), `PurchaseResult`, `STORE_TITLE`.
- Produces:
  ```tsx
  export interface BenefitStoreProps {
    services: ServiceItem[]; transactions: Transaction[]; balance: number;
    userEmail?: string; canTransact: boolean;      // canTransact = rola pracownika
    initialCategory?: BenefitCategory | null;
    onPurchase: (item: ServiceItem) => Promise<PurchaseResult>;
    onOpenApp: (tab: EmployeeAppTab) => void;
    onExit: () => void;
  }
  export function BenefitStore(props: BenefitStoreProps): JSX.Element;
  // StoreGrid: { groups: {category, items}[]; ownedIds: ReadonlySet<string>; balance: number; onSelect: (item) => void }
  // StoreCategories: { value: CategoryFilter; counts: {total, byCategory}; onChange: (c: CategoryFilter) => void; balance: number; variant: 'sidebar' | 'chips' }
  // StoreHeader: { query: string; onQuery: (q: string) => void; balance: number; onExit: () => void }
  ```
- `StoreDetail` powstaje w Task 9 — w tym tasku `BenefitStore` trzyma `selected` w stanie i renderuje **tymczasowo** `null` w jego miejscu (jedna linia do podmiany w Task 9).

- [ ] **Step 1: Kierunek wizualny (reguła nadrzędna)**

Wywołaj `/ui-ux-pro-max` z zapytaniem „sklep benefitów pracowniczych, jasny motyw, siatka kafelków z obrazkami, lewy pasek kategorii, Tailwind + lucide, styl jak 21st.dev Immich app gallery" i `/design-taste-frontend`. Zapisz w komentarzu na górze `BenefitStore.tsx` wybrane: paletę (tło `slate-50`/karty białe + akcent `primary-*` EBS), typografię (nagłówki sekcji `text-lg font-bold tracking-tight`, kafelki `text-sm font-semibold`), promienie (`rounded-2xl`), cienie (`shadow-sm`, hover `shadow-md` + `-translate-y-0.5`). MotionSites/21st.dev wymagają OAuth — jeśli nadal niedostępne, napisz to w raporcie z taska i jedź dalej. Kod niżej to **struktura i stany**; klasy wizualne dopasuj do wyniku skilli, nie odwrotnie.

- [ ] **Step 2: `StoreHeader.tsx`**

```tsx
'use client';
import React from 'react';
import { Search, X, Wallet } from 'lucide-react';
import { STORE_TITLE } from '@/lib/benefits/constants';

interface Props { query: string; onQuery: (q: string) => void; balance: number; onExit: () => void }

export function StoreHeader({ query, onQuery, balance, onExit }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center gap-3 md:gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <img src="/ebs-black.svg" alt="EBS" className="h-6 w-auto" />
          <span className="hidden sm:inline font-bold text-slate-900 tracking-tight">{STORE_TITLE}</span>
        </div>
        <label className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search" value={query} onChange={e => onQuery(e.target.value)}
            placeholder="Szukaj benefitu…" aria-label="Szukaj benefitu"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white"
          />
        </label>
        <div className="hidden md:flex items-center gap-2 px-3 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold shrink-0" aria-label={`Saldo ${balance} punktów`}>
          <Wallet size={16} /> {balance} pkt
        </div>
        <button onClick={onExit} aria-label="Zamknij sklep" className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition shrink-0">
          <X size={20} />
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `StoreCategories.tsx`**

```tsx
'use client';
import React from 'react';
import { HeartPulse, ShieldCheck, Landmark, GraduationCap, Users, Sparkles, LayoutGrid, type LucideIcon } from 'lucide-react';
import { BENEFIT_CATEGORIES, type CategoryFilter } from '@/lib/benefits/catalog';
import type { BenefitCategory } from '@/types/enums';

export const CATEGORY_ICONS: Record<string, LucideIcon> = { HeartPulse, ShieldCheck, Landmark, GraduationCap, Users, Sparkles };

interface Props {
  value: CategoryFilter;
  counts: { total: number; byCategory: Record<BenefitCategory, number> };
  onChange: (c: CategoryFilter) => void;
  balance: number;
  variant: 'sidebar' | 'chips';
}

export function StoreCategories({ value, counts, onChange, balance, variant }: Props) {
  const entries: { id: CategoryFilter; label: string; icon: LucideIcon; count: number }[] = [
    { id: 'ALL', label: 'Wszystkie', icon: LayoutGrid, count: counts.total },
    ...BENEFIT_CATEGORIES.map(c => ({ id: c.id as CategoryFilter, label: c.label, icon: CATEGORY_ICONS[c.icon] ?? Sparkles, count: counts.byCategory[c.id] })),
  ];

  if (variant === 'chips') {
    return (
      <nav aria-label="Kategorie" className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 -mx-4 snap-x">
        {entries.map(e => (
          <button key={e.id} onClick={() => onChange(e.id)} aria-pressed={value === e.id}
            className={`snap-start shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium border transition ${value === e.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}>
            <e.icon size={15} /> {e.label} <span className={`text-xs ${value === e.id ? 'text-white/70' : 'text-slate-400'}`}>{e.count}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col gap-1 sticky top-20 self-start" aria-label="Kategorie">
      {entries.map(e => (
        <button key={e.id} onClick={() => onChange(e.id)} aria-current={value === e.id ? 'page' : undefined}
          className={`flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition ${value === e.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
          <e.icon size={18} className={value === e.id ? 'text-primary-300' : 'text-slate-400'} />
          <span className="flex-1 text-left">{e.label}</span>
          <span className={`text-xs tabular-nums ${value === e.id ? 'text-white/70' : 'text-slate-400'}`}>{e.count}</span>
        </button>
      ))}
      <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
        <p className="text-xs uppercase tracking-wider text-white/60">Twoje saldo</p>
        <p className="text-2xl font-black mt-1">{balance} <span className="text-base font-semibold text-white/70">pkt</span></p>
        <p className="text-xs text-white/50 mt-1">1 pkt = 1 zł</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: `StoreGrid.tsx` (siatka + kafelek)**

```tsx
'use client';
import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { ServiceItem } from '@/types';
import { resolveAction, type CategoryDef, type StoreAction } from '@/lib/benefits/catalog';
import { CATEGORY_ICONS } from './StoreCategories';

export function badgeFor(action: StoreAction, item: ServiceItem, balance: number): { text: string; tone: 'price' | 'inquire' | 'open' | 'muted' } {
  switch (action) {
    case 'open':         return { text: 'Otwórz', tone: 'open' };
    case 'inquire':      return { text: 'Zapytaj o ofertę', tone: 'inquire' };
    case 'insufficient': return { text: `Brakuje ${item.price - balance} pkt`, tone: 'muted' };
    default:             return { text: `${item.price} pkt`, tone: 'price' };
  }
}

const TONE: Record<string, string> = {
  price:   'bg-white/95 text-slate-900',
  inquire: 'bg-amber-100 text-amber-900',
  open:    'bg-emerald-500 text-white',
  muted:   'bg-slate-200 text-slate-600',
};

function StoreTile({ item, action, balance, onSelect }: { item: ServiceItem; action: StoreAction; balance: number; onSelect: (i: ServiceItem) => void }) {
  const [broken, setBroken] = useState(false);
  const badge = badgeFor(action, item, balance);
  return (
    <button onClick={() => onSelect(item)} className="group text-left rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition focus:outline-none focus:ring-2 focus:ring-primary-400">
      <div className="relative aspect-[4/3] bg-slate-100">
        {item.image && !broken
          ? <img src={item.image} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center text-slate-300"><ImageOff size={28} /></div>}
        <span className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold shadow-sm ${TONE[badge.tone]}`}>{badge.text}</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{item.name}</p>
        {item.partner && <p className="text-xs text-slate-500 mt-1">{item.partner}</p>}
      </div>
    </button>
  );
}

interface Props {
  groups: { category: CategoryDef; items: ServiceItem[] }[];
  ownedIds: ReadonlySet<string>;
  balance: number;
  onSelect: (item: ServiceItem) => void;
  query: string;
  onClearQuery: () => void;
}

export function StoreGrid({ groups, ownedIds, balance, onSelect, query, onClearQuery }: Props) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600">Nic nie znaleźliśmy dla „{query}".</p>
        <button onClick={onClearQuery} className="mt-4 px-4 h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold">Wyczyść</button>
      </div>
    );
  }
  return (
    <div className="space-y-10">
      {groups.map(({ category, items }) => {
        const Icon = CATEGORY_ICONS[category.icon];
        return (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-center gap-3">
                {Icon && <span className="w-9 h-9 rounded-xl bg-slate-900 text-primary-300 flex items-center justify-center"><Icon size={18} /></span>}
                <div>
                  <h2 id={`cat-${category.id}`} className="text-lg font-bold tracking-tight text-slate-900">{category.label}</h2>
                  <p className="text-xs text-slate-500">{category.description}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 tabular-nums">{items.length}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(item => (
                <StoreTile key={item.id} item={item} action={resolveAction(item, ownedIds, balance)} balance={balance} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: `BenefitStore.tsx`**

```tsx
'use client';
// Sklep benefitów v2 — pełnoekranowa nakładka (spec 2026-09-15 §5).
// Kierunek wizualny: <wynik /ui-ux-pro-max + /design-taste-frontend — wpisz tu paletę/typografię>.
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { ServiceItem, Transaction, PurchaseResult } from '@/types';
import type { BenefitCategory } from '@/types/enums';
import { filterCatalog, groupByCategory, countByCategory, type CategoryFilter, type EmployeeAppTab } from '@/lib/benefits/catalog';
import { StoreHeader } from './StoreHeader';
import { StoreCategories } from './StoreCategories';
import { StoreGrid } from './StoreGrid';

export interface BenefitStoreProps {
  services: ServiceItem[];
  transactions: Transaction[];
  balance: number;
  userEmail?: string;
  canTransact: boolean;
  initialCategory?: BenefitCategory | null;
  onPurchase: (item: ServiceItem) => Promise<PurchaseResult>;
  onOpenApp: (tab: EmployeeAppTab) => void;
  onExit: () => void;
}

export function BenefitStore({ services, transactions, balance, userEmail, canTransact, initialCategory, onPurchase, onOpenApp, onExit }: BenefitStoreProps) {
  const [category, setCategory] = useState<CategoryFilter>(initialCategory ?? 'ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ServiceItem | null>(null);

  const ownedIds = useMemo(() => new Set(transactions.map(t => t.serviceId).filter((x): x is string => !!x)), [transactions]);
  const counts = useMemo(() => countByCategory(filterCatalog(services, { query })), [services, query]);
  const groups = useMemo(() => groupByCategory(filterCatalog(services, { category, query })), [services, category, query]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] bg-slate-50 text-slate-900 overflow-y-auto" role="dialog" aria-label="Sklep benefitów">
      <StoreHeader query={query} onQuery={setQuery} balance={balance} onExit={onExit} />
      <div className="md:hidden px-4">
        <StoreCategories variant="chips" value={category} counts={counts} onChange={setCategory} balance={balance} />
      </div>
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 flex gap-8">
        <StoreCategories variant="sidebar" value={category} counts={counts} onChange={setCategory} balance={balance} />
        <main className="flex-1 min-w-0">
          <StoreGrid groups={groups} ownedIds={ownedIds} balance={balance} onSelect={setSelected} query={query} onClearQuery={() => setQuery('')} />
        </main>
      </div>
      {/* TASK 9: tu wchodzi <StoreDetail …/> */}
      {selected && null}
    </motion.div>
  );
}
```

- [ ] **Step 6: Typy i podgląd**

Run: `npx tsc --noEmit` → 0 błędów. Tymczasowo (bez commitowania) podepnij `<BenefitStore>` w `DashboardEmployee` pod `activeTab === 'CATALOG'` (pełne wpięcie robi Task 10) i obejrzyj na `localhost:3010` desktop + 390 px: pasek/chipy, liczniki, siatka pogrupowana, wyszukiwarka „ubezp" zawęża do Ubezpieczeń, pusty wynik pokazuje „Wyczyść". Cofnij tymczasowe wpięcie (`git checkout -- views/DashboardEmployee.tsx`) jeśli nie idziesz od razu do Task 10.

- [ ] **Step 7: Commit**

```bash
git add components/employee/store/StoreHeader.tsx components/employee/store/StoreCategories.tsx components/employee/store/StoreGrid.tsx components/employee/store/BenefitStore.tsx
git commit -m "feat(sklep): powłoka sklepu — nagłówek z wyszukiwarką, kategorie, siatka kafelków

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Panel szczegółów — cztery akcje

**Files:**
- Create: `components/employee/store/StoreDetail.tsx`
- Modify: `components/employee/store/BenefitStore.tsx` (linia `{selected && null}`)

**Interfaces:**
- Consumes: `resolveAction`, `APP_TAB_BY_SERVICE`, `RedemptionModal` (Task 6), `POST /api/benefits/inquiry` (Task 7), `BOK_SLA_TEXT`.
- Produces: `StoreDetail({ item, action, balance, canTransact, userEmail, onClose, onPurchase, onOpenApp })`.

- [ ] **Step 1: `StoreDetail.tsx`**

```tsx
'use client';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import type { ServiceItem, PurchaseResult } from '@/types';
import { APP_TAB_BY_SERVICE, type StoreAction, type EmployeeAppTab } from '@/lib/benefits/catalog';
import { BOK_SLA_TEXT } from '@/lib/benefits/constants';
import { RedemptionModal } from '../RedemptionModal';

interface Props {
  item: ServiceItem;
  action: StoreAction;
  balance: number;
  canTransact: boolean;
  userEmail?: string;
  onClose: () => void;
  onPurchase: (item: ServiceItem) => Promise<PurchaseResult>;
  onOpenApp: (tab: EmployeeAppTab) => void;
}

type InquiryState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; reportedAt?: string } | { kind: 'error'; message: string };

export function StoreDetail({ item, action, balance, canTransact, userEmail, onClose, onPurchase, onOpenApp }: Props) {
  const [buying, setBuying] = useState(false);
  const [inquiry, setInquiry] = useState<InquiryState>({ kind: 'idle' });

  const sendInquiry = async () => {
    setInquiry({ kind: 'sending' });
    try {
      const res = await fetch('/api/benefits/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId: item.id }) });
      if (res.ok) { setInquiry({ kind: 'done' }); return; }
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) { setInquiry({ kind: 'done', reportedAt: body.reportedAt }); return; }
      setInquiry({ kind: 'error', message: typeof body.error === 'string' ? body.error : 'Nie udało się wysłać zapytania.' });
    } catch {
      setInquiry({ kind: 'error', message: 'Brak połączenia. Spróbuj ponownie.' });
    }
  };

  const tab = APP_TAB_BY_SERVICE[item.id];

  const cta = () => {
    if (!canTransact && action !== 'open') {
      return <button disabled className="w-full h-12 rounded-xl bg-slate-200 text-slate-500 font-semibold">Tylko dla pracowników</button>;
    }
    switch (action) {
      case 'open':
        return <button onClick={() => tab && onOpenApp(tab)} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition">Otwórz</button>;
      case 'insufficient':
        return <button disabled className="w-full h-12 rounded-xl bg-slate-200 text-slate-500 font-semibold">Brakuje {item.price - balance} pkt</button>;
      case 'buy':
        return <button onClick={() => setBuying(true)} className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition">Kup za {item.price} pkt</button>;
      case 'inquire':
        if (inquiry.kind === 'done') {
          const when = inquiry.reportedAt ? new Date(inquiry.reportedAt).toLocaleDateString('pl-PL') : null;
          return (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 flex gap-3">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
              <span>{when ? `Zgłoszone ${when}.` : 'Zgłoszone ✓'} BOK odezwie się w ciągu {BOK_SLA_TEXT}.</span>
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <button onClick={sendInquiry} disabled={inquiry.kind === 'sending'} className="w-full h-12 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {inquiry.kind === 'sending' ? <><Loader2 size={18} className="animate-spin" /> Wysyłanie…</> : 'Zapytaj o ofertę'}
            </button>
            {inquiry.kind === 'error' && <p className="text-sm text-rose-600">{inquiry.message}</p>}
            <p className="text-xs text-slate-500">Jedno kliknięcie — BOK skontaktuje się z Tobą w ciągu {BOK_SLA_TEXT}.</p>
          </div>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-slate-900/40" onClick={onClose} aria-hidden />
      <motion.aside
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.2 }}
        role="dialog" aria-label={item.name}
        className="fixed z-[120] inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-[440px] bg-white rounded-t-3xl md:rounded-none md:rounded-l-3xl shadow-2xl overflow-y-auto max-h-[92vh] md:max-h-none">
        <div className="relative aspect-[16/9] bg-slate-100">
          {item.image && <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <button onClick={onClose} aria-label="Zamknij" className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            {item.partner && <p className="text-xs uppercase tracking-wider text-slate-500">{item.partner}</p>}
            <h2 className="text-xl font-bold text-slate-900 mt-1">{item.name}</h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.description}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-400">Cena</span>
            <span className="text-lg font-bold text-slate-900">{item.price > 0 ? `${item.price} pkt` : 'Zapytaj o ofertę'}</span>
          </div>
          {cta()}
        </div>
      </motion.aside>
      {buying && (
        <RedemptionModal isOpen service={item} onClose={() => { setBuying(false); onClose(); }}
          onConfirm={() => onPurchase(item)} userEmail={userEmail}
          onOpenApp={tab ? () => { setBuying(false); onClose(); onOpenApp(tab); } : undefined} />
      )}
    </>
  );
}
```
Uwaga na warstwy: `RedemptionModal` ma `z-[100]`, panel `z-[120]` — podnieś w modalu `z-[100]` do `z-[130]` (jedna klasa w `RedemptionModal.tsx`), inaczej modal schowa się pod panelem.

- [ ] **Step 2: Wpięcie w `BenefitStore`**

Zastąp `{selected && null}` (i usuń komentarz TASK 9):
```tsx
      <AnimatePresence>
        {selected && (
          <StoreDetail key={selected.id} item={selected} action={resolveAction(selected, ownedIds, balance)}
            balance={balance} canTransact={canTransact} userEmail={userEmail}
            onClose={() => setSelected(null)} onPurchase={onPurchase} onOpenApp={onOpenApp} />
        )}
      </AnimatePresence>
```
Importy: `AnimatePresence` z `'motion/react'`, `resolveAction` z `'@/lib/benefits/catalog'`, `StoreDetail` z `'./StoreDetail'`.

- [ ] **Step 3: Typy i podgląd**

Run: `npx tsc --noEmit` → 0 błędów. Na `localhost:3010` (z tymczasowym wpięciem jak w Task 8 Step 6): kafelek z ceną → panel → „Kup za N pkt" → modal; kafelek z ceną 0 → „Zapytaj o ofertę" → bez sesji pracownika 401/403 pokazuje komunikat błędu (to oczekiwane do smoke-testu).

- [ ] **Step 4: Commit**

```bash
git add components/employee/store/StoreDetail.tsx components/employee/store/BenefitStore.tsx components/employee/RedemptionModal.tsx
git commit -m "feat(sklep): panel szczegółów — kup, zapytaj o ofertę, otwórz, brakuje punktów

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Wpięcie w portal — `STORE_LAYOUT`, Pulpit v2, menu boczne

**Files:**
- Create: `lib/benefits/storeLayout.ts`
- Modify: `views/DashboardEmployee.tsx` (import, stan `storeInitialCategory`, `renderWallet`, gałąź `CATALOG`, scroll-spy, szybkie akcje, licznik partnerów, `displayServices`)
- Modify: `components/Sidebar.tsx:140-152` (menu `Role.EMPLOYEE`)

**Interfaces:**
- Produces: `STORE_LAYOUT: 'v1' | 'v2'`; widok `emp-catalog` w menu pracownika.

- [ ] **Step 1: Stała**

`lib/benefits/storeLayout.ts`:
```ts
/**
 * Przełącznik układu Pulpitu pracownika. 'v2' = sklep benefitów (spec 2026-09-15);
 * 'v1' = dawne karuzele partnerów. Kod v1 zostaje w DashboardEmployee/Sidebar — wyłączony, nie usunięty
 * (decyzja właściciela). Jedno miejsce prawdy dla DashboardEmployee i Sidebar.
 */
export const STORE_LAYOUT: 'v1' | 'v2' = 'v2';
```

- [ ] **Step 2: `DashboardEmployee.tsx`**

1. Importy: `import { BenefitStore } from '../components/employee/store/BenefitStore';`, `import { STORE_LAYOUT } from '../lib/benefits/storeLayout';`, do importu z `'../lib/benefits/catalog'` dopisz `partnerCount`, z `'../types'` — `BenefitCategory` (jest od Task 1), `Role`.
2. Stan: `const [storeInitialCategory, setStoreInitialCategory] = useState<BenefitCategory | null>(null);` i helper:
```tsx
  const openStore = (category: BenefitCategory | null = null) => {
    setStoreInitialCategory(category);
    setActiveTab('CATALOG');
    onViewChange?.('emp-catalog');
  };
```
3. `displayServices` (linie ~136–143): warunek `if (s.id.startsWith('SRV-ORANGE')) return false;` zamień na `if (STORE_LAYOUT === 'v1' && s.id.startsWith('SRV-ORANGE')) return false;`.
4. Scroll-spy `useEffect` (linia ~98): pierwszą linią `handle` dodaj `if (STORE_LAYOUT === 'v2') return;`.
5. Pełnoekranowe nakładki (po bloku `DIGITAL_VAULT`, przed `renderWallet`):
```tsx
  if (STORE_LAYOUT === 'v2' && activeTab === 'CATALOG') {
    return (
      <BenefitStore
        services={services}
        transactions={transactions}
        balance={user.voucherBalance ?? 0}
        userEmail={user.email}
        canTransact={user.role === Role.EMPLOYEE}
        initialCategory={storeInitialCategory}
        onPurchase={onPurchaseService}
        onOpenApp={(tab) => setActiveTab(tab)}
        onExit={() => { setActiveTab('WALLET'); onViewChange?.('emp-dashboard'); }}
      />
    );
  }
```
(`User.email` istnieje w `types/user.ts` — pole wymagane.)
6. Szybkie akcje (`onClick` w `quickActions.map`, linie ~259–264): przed dotychczasowymi `if` dodaj
```tsx
                if (STORE_LAYOUT === 'v2') {
                  if (id === 'health' || id === 'wellbeing') openStore(BenefitCategory.ZDROWIE);
                  else if (id === 'insurance') openStore(BenefitCategory.UBEZPIECZENIA);
                  else if (id === 'telecom') openStore(BenefitCategory.CODZIENNOSC);
                  return;
                }
```
7. Statystyka „Partnerzy: 14" (linia ~239): `value: STORE_LAYOUT === 'v2' ? partnerCount(services) : 14`.
8. W `renderWallet`, zaraz po sekcji **Twoje Aplikacje** (po zamykającym `</div>` tej sekcji), wstaw:
```tsx
      {STORE_LAYOUT === 'v2' && (
        <button onClick={() => openStore(null)}
          className="w-full rounded-3xl p-6 md:p-8 text-left relative overflow-hidden border border-white/10 hover:border-primary-300/40 transition group"
          style={{ background: 'linear-gradient(135deg, rgba(48,223,106,.18), rgba(66,151,205,.12))' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Sklep benefitów</p>
          <p className="text-2xl md:text-3xl font-black text-white mt-2">Przeglądaj benefity →</p>
          <p className="text-white/70 text-sm mt-2 max-w-md">Zdrowie, ubezpieczenia, finanse, rozwój, rodzina i codzienność — {services.filter(s => s.isActive).length} pozycji w jednym miejscu.</p>
        </button>
      )}
```
9. Sekcje karuzel Profitowi / Multipolisa / Goldman / Wellbeing / Poradniki / E-booki (każdy `<div id="sec-emp-…">`) opakuj: `{STORE_LAYOUT === 'v1' && ( <div id="sec-emp-profitowi"> … </div> )}` — **JSX w środku bez zmian**. Separator „Katalog Usług" (`#catalog-anchor`) też pod `STORE_LAYOUT === 'v1'`.
10. Gałęzie renderujące `(activeTab === 'WALLET' || activeTab === 'CATALOG')` zostają — w v2 `CATALOG` nigdy tu nie dociera (przechwycony wyżej).

- [ ] **Step 3: `Sidebar.tsx` — menu pracownika**

Import `STORE_LAYOUT` z `'@/lib/benefits/storeLayout'` i `ShoppingBag` z `lucide-react`. Gałąź `case Role.EMPLOYEE:` zastąp:
```tsx
      case Role.EMPLOYEE:
        if (STORE_LAYOUT === 'v2') {
          return [
            { id: 'emp-twoje-aplikacje', label: 'Twoje Aplikacje', icon: <Smartphone size={20} /> },
            { id: 'emp-catalog', label: 'Sklep benefitów', icon: <ShoppingBag size={20} /> },
            { id: 'emp-history', label: 'Historia', icon: <History size={20} /> },
            { id: 'emp-support', label: 'Centrum Pomocy', icon: <HelpCircle size={20} /> },
            { id: 'emp-active-services', label: 'Aktywne usługi', icon: <ShieldCheck size={20} /> },
          ];
        }
        return [ /* dotychczasowa lista v1 — bez zmian */ ];
```
`DashboardEmployee` mapuje `emp-catalog` na `CATALOG` przez istniejące `currentView.startsWith('emp-')` (linia ~90) — sprawdź, że `emp-twoje-aplikacje` nadal scrolluje do sekcji (nie jest przechwycone przez sklep: warunek `if (activeTab !== 'CATALOG') setActiveTab('CATALOG')` w tym `useEffect` musi w v2 dotyczyć tylko `emp-catalog`; dla `emp-twoje-aplikacje` w v2 ustaw `WALLET` i scroll do `sec-emp-twoje-aplikacje`). Zmień ten fragment na:
```tsx
    else if (currentView === 'emp-catalog' && STORE_LAYOUT === 'v2') { setActiveTab('CATALOG'); }
    else if (currentView.startsWith('emp-')) {
      const target = STORE_LAYOUT === 'v2' ? 'WALLET' : 'CATALOG';
      if (activeTab !== target) setActiveTab(target);
      /* dotychczasowy scroll do sekcji bez zmian */
    }
```

- [ ] **Step 4: Typy, testy, podgląd**

Run: `npx tsc --noEmit && npx vitest run` → 0 błędów, testy zielone. `localhost:3010`, desktop i 390 px: Pulpit bez karuzel, kafelek „Przeglądaj benefity →" i szybkie akcje otwierają sklep (właściwa kategoria), X wraca na Pulpit, menu boczne ma „Sklep benefitów", zakładka „Katalog" na dole otwiera sklep, „Twoje Aplikacje" w menu scrolluje do sekcji. Przełącz chwilowo `STORE_LAYOUT = 'v1'` → stary Pulpit i stare menu wracają; przywróć `'v2'`.

- [ ] **Step 5: Commit**

```bash
git add lib/benefits/storeLayout.ts views/DashboardEmployee.tsx components/Sidebar.tsx
git commit -m "feat(sklep): sklep wpięty w portal pracownika, stare karuzele wyłączone stałą STORE_LAYOUT

Zakładka Katalog, menu Sklep benefitów, kafelek na Pulpicie i szybkie akcje
otwierają sklep (w kategorii). Karuzele partnerów zostają w kodzie pod 'v1'.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: QA wizualne, deploy, smoke na produkcji, sprzątanie, dokumentacja

**Files:**
- Modify: `CLAUDE.md` (nowa sekcja „Sklep benefitów v2" po sekcji „Employee Dashboard Content")
- Temporary: `scripts/_smoke-sklep.mts` (usunąć po teście)

- [ ] **Step 1: QA wizualne (reguła nadrzędna)**

Na `localhost:3010` z widokiem sklepu: `/impeccable audit` → napraw wskazane; `/design-review` → napraw w kodzie; `/review-animations` (wejście nakładki i panelu). Zmiany commituj osobno: `git commit -m "polish(sklep): poprawki po audycie wizualnym"`. Zapisz w raporcie, że MotionSites/21st.dev były niedostępne (OAuth), jeśli nadal są.

- [ ] **Step 2: Pełna weryfikacja statyczna**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: 0 błędów, wszystkie testy zielone (≥ 341 + nowe), build exit 0.

- [ ] **Step 3: Deploy**

Migracja 061 jest już na produkcji (Task 4). `npx vercel --prod --yes`; potem `npx vercel ls --prod | head -3` → najnowszy `● Ready`. `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://ebs.elitonbenefits.pl/api/benefits/inquiry -H "Content-Type: application/json" -d '{"serviceId":"SRV-P-PZU"}'` → `401`.

- [ ] **Step 4: Dane testowe (tymczasowy pracownik + 30 voucherów)**

`scripts/_smoke-sklep.mts` (uruchamiany `npx tsx --env-file=.env.local scripts/_smoke-sklep.mts seed|link|cleanup`; **ścieżkę `next` przekazuj jako `%2Fdashboard%2Femployee` — Git Bash zamienia `/x` na ścieżkę Windows**):
```ts
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const EMAIL = 'smoke-sklep-2026-09@example.com';
const cmd = process.argv[2];

if (cmd === 'seed') {
  const { data: company } = await admin.from('companies').insert({ name: 'FIRMA TESTOWA SKLEP (usunąć)', nip: '0000000000' } as any).select('id').single();
  const { data: u, error } = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, password: crypto.randomUUID() + 'Aa1!' });
  if (error) throw error;
  await admin.from('user_profiles').insert({ id: u.user!.id, role: 'pracownik', full_name: 'Smoke Sklep', company_id: company!.id } as any);
  await admin.from('voucher_accounts').upsert({ user_id: u.user!.id, balance: 30 } as any);
  const valid = new Date(Date.now() + 30 * 864e5).toISOString();
  // Sprawdź w information_schema kolumny NOT NULL tabeli vouchers i uzupełnij poniższy obiekt, jeśli insert odrzuci.
  const rows = Array.from({ length: 30 }, (_, i) => ({ serial_number: `SMOKE-SKLEP-${String(i + 1).padStart(3, '0')}`, status: 'distributed', valid_until: valid, current_owner_id: u.user!.id, face_value_pln: 1 }));
  const { error: vErr } = await admin.from('vouchers').insert(rows as any);
  if (vErr) throw vErr;
  console.log('seed ok', u.user!.id, company!.id);
}
if (cmd === 'link') {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (error) throw error;
  console.log(`https://ebs.elitonbenefits.pl/auth/confirm?token_hash=${(data.properties as any).hashed_token}&type=magiclink&next=%2Fdashboard%2Femployee`);
}
if (cmd === 'cleanup') {
  const { data: prof } = await admin.from('user_profiles').select('id, company_id').eq('full_name', 'Smoke Sklep').single();
  console.log('anonimizuj przez lib/users/accountPurge (tryb wymuszony przez ślad w ledgerze), potem:');
  console.log(`delete from benefit_inquiries where user_id = '${prof!.id}'; delete from vouchers where serial_number like 'SMOKE-SKLEP-%'; delete from companies where id = '${prof!.company_id}';`);
}
```
Run: `npx tsx --env-file=.env.local scripts/_smoke-sklep.mts seed` → `seed ok`. Sprawdź SQL: `select count(*) from vouchers where serial_number like 'SMOKE-SKLEP-%' and status='distributed'` → 30.

- [ ] **Step 5: Scenariusze na produkcji (Claude Browser / Playwright MCP)**

Wygeneruj link (`… link`), otwórz w przeglądarce (popup Orange zamknij X). Kolejno:
1. Zakładka **Katalog** → sklep; saldo 30 pkt w nagłówku i w pasku.
2. „Multikino (Bilet)" (25 pkt) → „Kup za 25 pkt" → suwak → ekran „Zamówienie przyjęte … w ciągu 2 dni roboczych". SQL: `select amount, type, service_id, metadata->'serials' from voucher_transactions where type='wykorzystanie' order by created_at desc limit 1` → `25, wykorzystanie, SRV-04, 25 seriali`; `select count(*) from vouchers where serial_number like 'SMOKE-SKLEP-%' and status='consumed'` → 25; saldo 5.
3. „Audioteka" (35) → plakietka „Brakuje 30 pkt", przycisk nieaktywny (bez wywołania API — sprawdź w `read_network_requests`).
4. „PZU — Ubezpieczenie NNW" → „Zapytaj o ofertę" → stan „Zgłoszone ✓". SQL: `select service_id, status from benefit_inquiries` → 1 wiersz `SRV-P-PZU, new`. Drugi klik po odświeżeniu → 409 → „Zgłoszone {data}" i nadal 1 wiersz.
5. „EBS Wellbeing Premium" (100) przy saldzie 5 → „Brakuje 95 pkt". Dla ścieżki błędu API: w devtools nie — zamiast tego `curl` z ciasteczkiem sesji jest niepraktyczny; wystarczy test jednostkowy walidacji + scenariusz 2. Odnotuj to w raporcie.
6. Historia → wpis „Multikino (Bilet)" z „−25" (DEBIT).
7. E-maile: w skrzynce BOK (`bok@stratton-prime.pl`) tematy `[EBS Sklep] Zamówienie: Multikino: Multikino (Bilet)` i `[EBS Sklep] Zapytanie o ofertę: Profitowi: PZU — Ubezpieczenie NNW pracownicze`; jeśli brak dostępu do skrzynki — sprawdź logi Vercela (`npx vercel logs` / panel) pod kątem `[purchase] mail failed` (brak = wysłane) i odnotuj, że skrzynki nie oglądano.
8. Mobile 390 px: chipy kategorii, siatka 2 kolumny, panel od dołu. Zrzuty do raportu.
Wyloguj sesję testową.

- [ ] **Step 6: Sprzątanie danych testowych**

`npx tsx --env-file=.env.local scripts/_smoke-sklep.mts cleanup` → wykonaj wypisane kroki: anonimizacja konta przez istniejącą ścieżkę `POST /api/users/[id]/purge` (jako owner; ledger niepusty → tryb ANONIMIZACJA) albo bezpośrednio funkcją z `lib/users/accountPurge.ts` w skrypcie; potem SQL z wydruku (`benefit_inquiries`, `vouchers SMOKE-*`, firma testowa). Sprawdź: `select count(*) from vouchers where serial_number like 'SMOKE-SKLEP-%'` → 0; `select count(*) from companies where name like 'FIRMA TESTOWA SKLEP%'` → 0. **Zostaje**: zanonimizowany profil + 1 wpis `wykorzystanie` w ledgerze (niezmienny) + `audit_log` — zapisz to w handoffie. Usuń `scripts/_smoke-sklep.mts`.

- [ ] **Step 7: `CLAUDE.md`**

Po sekcji „Employee Dashboard Content (`DashboardEmployee.tsx`)" dodaj:
```markdown
### Sklep benefitów v2 (2026-09-15)

Spec: `docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md`. Pełnoekranowy sklep
(`components/employee/store/*`) pod `activeTab === 'CATALOG'`; katalog **w kodzie**
(`INITIAL_SERVICES` + `category`/`partner`/`fulfillment`, klucz localStorage `ebs_services_v16`);
logika w `lib/benefits/*` (czyste funkcje z testami). Dwie ścieżki: cena > 0 → `RedemptionModal` →
`POST /api/vouchers/purchase` (serwer **waliduje cenę z katalogiem** i realizuje vouchery jedną
funkcją `redeem_vouchers_for_service`, migracja 061 — jeden wpis w ledgerze, e-maile do BOK
i pracownika); cena 0 → `POST /api/benefits/inquiry` (tabela `benefit_inquiries`, deduplikacja
7 dni, e-maile). Aplikacje Eliton (`fulfillment: 'auto'`) odblokowują się same.
**Stary Pulpit z karuzelami zostaje w kodzie pod `STORE_LAYOUT = 'v1'`
(`lib/benefits/storeLayout.ts`) — nie usuwać.** Do 15.09.2026 zakup za punkty **nigdy nie zadziałał
na produkcji** (`redeem_voucher` wymagał statusu `active`, dystrybucja nadaje `distributed`); ledger
nie miał ani jednego wpisu `wykorzystanie`. Zgłoszenia `SupportTicketSystem` w portalu to nadal
tylko `localStorage` — BOK pracuje z e-maili (`BOK_EMAIL`, dom. `bok@stratton-prime.pl`).
```

- [ ] **Step 8: Commit, push, handoff**

```bash
git add CLAUDE.md
git commit -m "docs: sklep benefitów v2 w CLAUDE.md — architektura, ścieżki, pułapki

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```
Następnie `/handoff` (wynik smoke-testu, co zostało w bazie po sprzątaniu, otwarte decyzje właściciela ze specu §10).
